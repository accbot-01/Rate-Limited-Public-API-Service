import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import config from '../config';

/**
 * Global error handler
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  // Default error
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: unknown = undefined;

  // Handle operational errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // Log unexpected errors
    console.error('Unexpected error:', err);
  }

  // Don't leak stack traces in production
  if (config.env === 'production') {
    details = undefined;
  } else {
    details = err.stack;
  }

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    details,
  });
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
};
