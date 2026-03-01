import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getProfile, rotateKey } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { handleValidationErrors } from '../utils/errors';

const router = Router();

/**
 * POST /api/v1/register
 * Register a new user
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    handleValidationErrors,
  ],
  register
);

/**
 * POST /api/v1/login
 * Login user
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],
  login
);

/**
 * GET /api/v1/profile
 * Get user profile (requires JWT)
 */
router.get('/profile', authenticateJWT, getProfile);

/**
 * POST /api/v1/profile/rotate-key
 * Rotate API key (requires JWT)
 */
router.post('/profile/rotate-key', authenticateJWT, rotateKey);

export default router;
