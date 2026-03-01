import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import config from './config';
import authRoutes from './routes/authRoutes';
import dataRoutes from './routes/dataRoutes';
import healthRoutes from './routes/healthRoutes';
import { requestLogger } from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging (development)
  if (config.env === 'development') {
    app.use(morgan('dev'));
  }

  // Custom request logger (for API calls)
  app.use(requestLogger);

  // Health check (no /api/v1 prefix)
  app.use('/', healthRoutes);

  // API routes
  app.use('/api/v1', authRoutes);
  app.use('/api/v1', dataRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
