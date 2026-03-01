import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';
import config from '../config';
import { User, JWTPayload, UserTier } from '../types';
import { generateApiKey, hashApiKey } from '../utils/apiKey';
import { AppError } from '../utils/errors';

const SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<{ user: User; apiKey: string; token: string }> {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const tier: UserTier = 'free';

    const userResult = await db.query(
      `INSERT INTO users (id, email, password_hash, name, tier, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, name, tier, created_at, updated_at`,
      [userId, email.toLowerCase(), passwordHash, name, tier]
    );

    const user = userResult.rows[0] as User;

    // Generate API key
    const { key, hash, prefix } = generateApiKey();

    await db.query(
      `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), userId, hash, prefix, 'active']
    );

    // Generate JWT
    const token = this.generateToken(user);

    return { user, apiKey: key, token };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0] as User;

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT
    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * Generate JWT token
   */
  generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      tier: user.tier,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '24h',
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await db.query(
      'SELECT id, email, name, tier, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as User;
  }

  /**
   * Validate API key and return user info
   */
  async validateApiKey(apiKey: string): Promise<{ userId: string; tier: UserTier; apiKeyId: string; status: string } | null> {
    const keyHash = hashApiKey(apiKey);

    const result = await db.query(
      `SELECT ak.id, ak.user_id, ak.status, u.tier, ak.rate_limit_override
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const keyData = result.rows[0];

    // Update last_used_at (async, non-blocking)
    db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyData.id]
    ).catch(err => console.error('Failed to update last_used_at:', err));

    return {
      userId: keyData.user_id,
      tier: keyData.tier,
      apiKeyId: keyData.id,
      status: keyData.status,
    };
  }

  /**
   * Rotate API key
   */
  async rotateApiKey(userId: string): Promise<string> {
    // Generate new API key
    const { key, hash, prefix } = generateApiKey();

    // Get current API key
    const currentKey = await db.query(
      'SELECT id FROM api_keys WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    if (currentKey.rows.length === 0) {
      throw new AppError('No active API key found', 404);
    }

    // Disable old key
    await db.query(
      'UPDATE api_keys SET status = $1 WHERE user_id = $2 AND status = $3',
      ['disabled', userId, 'active']
    );

    // Create new key
    await db.query(
      `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), userId, hash, prefix, 'active']
    );

    return key;
  }
}

export const authService = new AuthService();
export default authService;
