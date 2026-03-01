import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import rateLimitService from '../services/rateLimitService';
import { AppError } from '../utils/errors';
import { isValidApiKeyFormat } from '../utils/apiKey';
import { UserTier } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      userId?: string;
      tier?: UserTier;
    }
  }
}

/**
 * API Key authentication middleware
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError('API key is required', 401);
    }

    // Validate format
    if (!isValidApiKeyFormat(apiKey)) {
      throw new AppError('Invalid API key format', 401);
    }

    // Validate API key
    const keyData = await authService.validateApiKey(apiKey);

    if (!keyData) {
      throw new AppError('Invalid API key', 401);
    }

    // Check if key is disabled
    if (keyData.status === 'disabled') {
      throw new AppError('API key has been disabled by administrator', 403);
    }

    if (keyData.status === 'suspended') {
      throw new AppError('API key is currently suspended', 403);
    }

    // Attach to request
    req.apiKeyId = keyData.apiKeyId;
    req.userId = keyData.userId;
    req.tier = keyData.tier;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: 'Authentication Error',
        message: error.message,
      });
    }

    console.error('API key authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const tier = req.tier || 'free';

    if (!apiKey) {
      throw new AppError('API key is required for rate limiting', 401);
    }

    // Check rate limit
    const result = await rateLimitService.checkRateLimit(apiKey, tier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitService['getTierLimit'](tier));
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt);

    if (result.degradedMode) {
      res.setHeader('X-RateLimit-Mode', 'degraded');
    }

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter || 60);
      
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `You have exceeded the rate limit for your tier (${rateLimitService['getTierLimit'](tier)} requests/minute)`,
        retryAfter: result.retryAfter,
        tier,
        limit: rateLimitService['getTierLimit'](tier),
        resetAt: new Date(result.resetAt).toISOString(),
      });
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: 'Rate Limit Error',
        message: error.message,
      });
    }

    console.error('Rate limiting error:', error);
    
    // On error, allow request but log the issue
    console.warn('[RATE LIMIT] Error during rate limit check, allowing request');
    next();
  }
};
