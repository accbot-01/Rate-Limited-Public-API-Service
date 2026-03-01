import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Database
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'apiuser',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'ratelimit_api',
    max: 20, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Rate Limiting
  rateLimiting: {
    tiers: {
      free: parseInt(process.env.RATE_LIMIT_FREE_TIER || '60', 10),
      paid: parseInt(process.env.RATE_LIMIT_PAID_TIER || '600', 10),
    },
    burstMultiplier: parseInt(process.env.RATE_LIMIT_BURST_MULTIPLIER || '2', 10),
    burstDurationMs: parseInt(process.env.RATE_LIMIT_BURST_DURATION_MS || '10000', 10),
    violationThreshold: parseInt(process.env.RATE_LIMIT_VIOLATION_THRESHOLD || '10', 10),
    violationWindowMs: parseInt(process.env.RATE_LIMIT_VIOLATION_WINDOW_MS || '300000', 10),
    suspensionDurationMs: parseInt(process.env.RATE_LIMIT_SUSPENSION_DURATION_MS || '900000', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    batchSize: parseInt(process.env.LOG_BATCH_SIZE || '1000', 10),
    batchIntervalMs: parseInt(process.env.LOG_BATCH_INTERVAL_MS || '5000', 10),
  },

  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  // CloudWatch (optional)
  cloudwatch: {
    region: process.env.AWS_REGION || 'us-east-1',
    logGroup: process.env.CLOUDWATCH_LOG_GROUP || '/api/rate-limited-service',
    logStream: process.env.CLOUDWATCH_LOG_STREAM || 'production',
  },
};

export default config;
