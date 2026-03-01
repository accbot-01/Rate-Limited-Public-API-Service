import { Request, Response } from 'express';
import authService from '../services/authService';
import db from '../models/database';
import { maskApiKey } from '../utils/apiKey';
import { asyncHandler } from '../utils/errors';
import loggingService from '../services/loggingService';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  const result = await authService.register(email, password, name);

  res.status(201).json({
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      tier: result.user.tier,
      apiKey: result.apiKey,
      createdAt: result.user.createdAt,
    },
    token: result.token,
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await authService.login(email, password);

  res.status(200).json({
    token: result.token,
    expiresIn: 86400, // 24 hours in seconds
    user: {
      id: result.user.id,
      email: result.user.email,
      tier: result.user.tier,
    },
  });
});

/**
 * Get user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await authService.getUserById(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get API key info
  const apiKeyResult = await db.query(
    'SELECT key_prefix, created_at FROM api_keys WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );

  const apiKey = apiKeyResult.rows[0];
  const maskedKey = apiKey ? `${apiKey.key_prefix}****` : 'No active key';

  // Get usage stats
  const apiKeyIdResult = await db.query(
    'SELECT id FROM api_keys WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );
  
  const apiKeyId = apiKeyIdResult.rows[0]?.id;

  let usage = { today: 0, thisMonth: 0 };

  if (apiKeyId) {
    const stats = await loggingService.getUsageStats(apiKeyId, 1);
    const monthStats = await loggingService.getUsageStats(apiKeyId, 30);
    
    usage = {
      today: stats.totalRequests,
      thisMonth: monthStats.totalRequests,
    };
  }

  res.status(200).json({
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    apiKey: maskedKey,
    createdAt: user.createdAt,
    usage,
  });
});

/**
 * Rotate API key
 */
export const rotateKey = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const newApiKey = await authService.rotateApiKey(userId);

  res.status(200).json({
    apiKey: newApiKey,
    message: "API key rotated successfully. Save this key - it won't be shown again.",
  });
});
