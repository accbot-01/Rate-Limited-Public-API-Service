import { Router } from 'express';
import { query } from 'express-validator';
import { getPublicData } from '../controllers/dataController';
import { authenticateApiKey, rateLimitMiddleware } from '../middleware/rateLimit';
import { handleValidationErrors } from '../utils/errors';

const router = Router();

/**
 * GET /api/v1/public-data
 * Get paginated public data (requires API key and rate limiting)
 */
router.get(
  '/public-data',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
  ],
  authenticateApiKey,
  rateLimitMiddleware,
  getPublicData
);

export default router;
