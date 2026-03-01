import config from '../config';
import redisClient from '../models/redis';
import { RateLimitResult, UserTier } from '../types';
import { AppError } from '../utils/errors';

// In-memory fallback for when Redis is down
interface InMemoryRateLimit {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, InMemoryRateLimit>();

export class RateLimitService {
  /**
   * Get rate limit for tier
   */
  private getTierLimit(tier: UserTier, override?: number): number {
    if (override) return override;
    
    switch (tier) {
      case 'free':
        return config.rateLimiting.tiers.free;
      case 'paid':
        return config.rateLimiting.tiers.paid;
      case 'enterprise':
        return override || 5000; // Default for enterprise
      default:
        return config.rateLimiting.tiers.free;
    }
  }

  /**
   * Check rate limit (with Redis and in-memory fallback)
   */
  async checkRateLimit(
    apiKey: string,
    tier: UserTier,
    override?: number
  ): Promise<RateLimitResult> {
    const limit = this.getTierLimit(tier, override);
    const windowMs = 60000; // 1 minute

    // Check if key is suspended
    try {
      const suspension = await redisClient.isSuspended(apiKey);
      if (suspension.suspended) {
        const retryAfter = suspension.expiresAt
          ? Math.ceil((suspension.expiresAt - Date.now()) / 1000)
          : 900; // 15 minutes default

        throw new AppError(
          `API key suspended due to repeated abuse. Try again in ${retryAfter} seconds.`,
          403
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Failed to check suspension status:', error);
    }

    try {
      // Try Redis first (accurate sliding window)
      if (redisClient.isHealthy()) {
        const result = await redisClient.checkRateLimit(apiKey, limit, windowMs);

        if (!result.allowed) {
          // Track violation
          const violationCount = await redisClient.trackViolation(
            apiKey,
            config.rateLimiting.violationWindowMs
          );

          // Auto-suspend if threshold exceeded
          if (violationCount >= config.rateLimiting.violationThreshold) {
            await redisClient.suspendKey(apiKey, config.rateLimiting.suspensionDurationMs);
            
            console.warn(
              `[AUTO-SUSPEND] API key ${apiKey.substring(0, 15)}... suspended for ${config.rateLimiting.suspensionDurationMs / 1000}s`
            );
          }

          const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
          return {
            allowed: false,
            remaining: 0,
            resetAt: result.resetAt,
            retryAfter,
          };
        }

        return {
          allowed: true,
          remaining: limit - result.count,
          resetAt: result.resetAt,
        };
      } else {
        throw new Error('Redis is not healthy');
      }
    } catch (error) {
      // Fallback to in-memory (less accurate, per-instance)
      console.warn('[DEGRADED MODE] Redis unavailable, using in-memory rate limiter');
      return this.checkRateLimitInMemory(apiKey, limit, windowMs);
    }
  }

  /**
   * In-memory rate limiter (fallback when Redis is down)
   */
  private checkRateLimitInMemory(
    apiKey: string,
    limit: number,
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    const key = apiKey;

    let record = inMemoryStore.get(key);

    // Reset window if expired
    if (!record || record.resetAt < now) {
      record = {
        count: 0,
        resetAt: now + windowMs,
      };
      inMemoryStore.set(key, record);
    }

    record.count++;

    if (record.count > limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
        retryAfter,
        degradedMode: true,
      };
    }

    return {
      allowed: true,
      remaining: limit - record.count,
      resetAt: record.resetAt,
      degradedMode: true,
    };
  }

  /**
   * Clean up in-memory store periodically
   */
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, record] of inMemoryStore.entries()) {
        if (record.resetAt < now) {
          inMemoryStore.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[IN-MEMORY CLEANUP] Removed ${cleaned} expired rate limit records`);
      }
    }, 60000); // Every minute
  }
}

export const rateLimitService = new RateLimitService();
export default rateLimitService;
