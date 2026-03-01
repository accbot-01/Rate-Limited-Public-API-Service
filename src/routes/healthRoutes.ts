import { Router, Request, Response } from 'express';
import db from '../models/database';
import redisClient from '../models/redis';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await db.healthCheck();
  const redisHealthy = await redisClient.healthCheck();

  const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
  const statusCode = status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    },
  });
});

export default router;
