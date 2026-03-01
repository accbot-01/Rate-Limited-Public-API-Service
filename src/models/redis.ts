import Redis from 'ioredis';
import config from '../config';

class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      enableReadyCheck: config.redis.enableReadyCheck,
      connectTimeout: config.redis.connectTimeout,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('Redis ready');
      this.isConnected = true;
    });

    this.client.on('error', (err: Error) => {
      console.error('Redis error:', err.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  // Sliding window rate limiter using Redis ZSET
  async checkRateLimit(
    apiKey: string,
    limit: number,
    windowMs: number = 60000
  ): Promise<{ allowed: boolean; count: number; resetAt: number }> {
    const now = Date.now();
    const key = `ratelimit:${apiKey}`;
    const windowStart = now - windowMs;

    try {
      const pipeline = this.client.pipeline();

      // Remove old entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      pipeline.zcard(key);

      // Add current request
      const requestId = `${now}:${Math.random().toString(36).substr(2, 9)}`;
      pipeline.zadd(key, now, requestId);

      // Set TTL
      pipeline.expire(key, 120);

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline failed');
      }

      // Get count from zcard result (index 1, second element is the value)
      const count = (results[1][1] as number) || 0;

      const resetAt = now + (windowMs - (now % windowMs));

      return {
        allowed: count < limit,
        count: count + 1,
        resetAt,
      };
    } catch (error) {
      console.error('Redis rate limit check error:', error);
      throw error;
    }
  }

  // Track violations for auto-suspension
  async trackViolation(apiKey: string, windowMs: number): Promise<number> {
    const key = `violations:${apiKey}`;
    const now = Date.now();

    try {
      const pipeline = this.client.pipeline();

      // Remove old violations
      pipeline.zremrangebyscore(key, 0, now - windowMs);

      // Add new violation
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).substr(2, 9)}`);

      // Count violations
      pipeline.zcard(key);

      // Set TTL
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline failed');
      }

      return (results[2][1] as number) || 0;
    } catch (error) {
      console.error('Redis violation tracking error:', error);
      throw error;
    }
  }

  // Suspend API key
  async suspendKey(apiKey: string, durationMs: number): Promise<void> {
    const key = `suspended:${apiKey}`;
    const expiresAt = Date.now() + durationMs;

    try {
      await this.client.set(key, expiresAt.toString(), 'PX', durationMs);
    } catch (error) {
      console.error('Redis suspension error:', error);
      throw error;
    }
  }

  // Check if key is suspended
  async isSuspended(apiKey: string): Promise<{ suspended: boolean; expiresAt?: number }> {
    const key = `suspended:${apiKey}`;

    try {
      const expiresAt = await this.client.get(key);

      if (!expiresAt) {
        return { suspended: false };
      }

      return {
        suspended: true,
        expiresAt: parseInt(expiresAt, 10),
      };
    } catch (error) {
      console.error('Redis suspension check error:', error);
      throw error;
    }
  }
}

export const redisClient = new RedisClient();
export default redisClient;
