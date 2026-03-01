import { createApp } from './app';
import config from './config';
import db from './models/database';
import redisClient from './models/redis';
import loggingService from './services/loggingService';
import rateLimitService from './services/rateLimitService';

async function startServer() {
  try {
    // Check database connection
    console.log('Connecting to PostgreSQL...');
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✓ PostgreSQL connected');

    // Check Redis connection
    console.log('Connecting to Redis...');
    const redisHealthy = await redisClient.healthCheck();
    if (!redisHealthy) {
      console.warn('⚠ Redis connection failed - rate limiting will use in-memory fallback');
    } else {
      console.log('✓ Redis connected');
    }

    // Start log auto-flush worker
    loggingService.startAutoFlush();
    console.log('✓ Log buffer auto-flush started');

    // Start in-memory rate limit cleanup
    rateLimitService.startCleanup();
    console.log('✓ In-memory rate limit cleanup started');

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║  Rate-Limited Public API Service                          ║
║  Environment: ${config.env.padEnd(45)}║
║  Port: ${config.port.toString().padEnd(51)}║
║  Database: ${config.database.host}:${config.database.port.toString().padEnd(39)}║
║  Redis: ${config.redis.host}:${config.redis.port.toString().padEnd(42)}║
╚════════════════════════════════════════════════════════════╝
      `);
      console.log(`Server is running on http://localhost:${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(() => {
        console.log('✓ HTTP server closed');
      });

      // Stop background workers
      loggingService.stopAutoFlush();
      console.log('✓ Log buffer auto-flush stopped');

      // Close database connections
      await db.close();
      console.log('✓ Database connections closed');

      // Close Redis connection
      await redisClient.close();
      console.log('✓ Redis connection closed');

      console.log('Shutdown complete. Goodbye!');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
