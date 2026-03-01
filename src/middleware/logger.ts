import { Request, Response, NextFunction } from 'express';
import loggingService from '../services/loggingService';

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Capture original end function
  const originalEnd = res.end;

  // Override end function to log after response
  res.end = function(chunk?: any, encoding?: any, callback?: any): any {
    res.end = originalEnd;
    
    const result = res.end(chunk, encoding, callback);
    
    // Only log if we have an API key (authenticated requests)
    if (req.apiKeyId) {
      const latencyMs = Date.now() - startTime;
      
      loggingService.logRequest({
        timestamp: new Date().toISOString(),
        apiKeyId: req.apiKeyId,
        endpoint: req.path,
        httpMethod: req.method,
        statusCode: res.statusCode,
        latencyMs,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      });
    }
    
    return result;
  };

  next();
};
