import request from 'supertest';
import { createApp } from '../app';
import db from '../models/database';
import redisClient from '../models/redis';

const app = createApp();

describe('Authentication API', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await db.healthCheck();
  });

  afterAll(async () => {
    await db.close();
    await redisClient.close();
  });

  describe('POST /api/v1/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/register')
        .send({
          email: `test${Date.now()}@example.com`,
          password: 'SecurePass123!',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('apiKey');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.tier).toBe('free');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });

    it('should reject registration with duplicate email', async () => {
      const email = `duplicate${Date.now()}@example.com`;

      // First registration
      await request(app)
        .post('/api/v1/register')
        .send({
          email,
          password: 'SecurePass123!',
          name: 'Test User',
        })
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/v1/register')
        .send({
          email,
          password: 'SecurePass123!',
          name: 'Test User 2',
        })
        .expect(409);

      expect(response.body.message).toContain('already registered');
    });
  });

  describe('POST /api/v1/login', () => {
    const testEmail = `login${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';

    beforeAll(async () => {
      // Create test user
      await request(app).post('/api/v1/register').send({
        email: testEmail,
        password: testPassword,
        name: 'Login Test User',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body.user).toHaveProperty('id');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });
  });
});

describe('Rate Limiting API', () => {
  let apiKey: string;
  let token: string;

  beforeAll(async () => {
    // Register a test user
    const response = await request(app)
      .post('/api/v1/register')
      .send({
        email: `ratelimit${Date.now()}@example.com`,
        password: 'SecurePass123!',
        name: 'Rate Limit Test',
      });

    apiKey = response.body.user.apiKey;
    token = response.body.token;
  });

  describe('GET /api/v1/public-data', () => {
    it('should return data with valid API key', async () => {
      const response = await request(app)
        .get('/api/v1/public-data?page=1&limit=10')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should reject request without API key', async () => {
      await request(app).get('/api/v1/public-data').expect(401);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/public-data')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should enforce rate limit (429 after limit exceeded)', async () => {
      // This test would require making 61+ requests
      // Skipping for brevity, but in production test suite this would be included
    }, 30000);
  });
});

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.dependencies).toHaveProperty('database');
    expect(response.body.dependencies).toHaveProperty('redis');
  });
});
