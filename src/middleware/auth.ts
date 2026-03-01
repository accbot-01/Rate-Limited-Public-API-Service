import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { AppError } from '../utils/errors';
import { JWTPayload } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT authentication middleware
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const payload = authService.verifyToken(token);
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: 'Authentication Error',
        message: error.message,
      });
    }

    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid or expired token',
    });
  }
};
