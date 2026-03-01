export type UserTier = 'free' | 'paid' | 'enterprise';

export type ApiKeyStatus = 'active' | 'disabled' | 'suspended';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  status: ApiKeyStatus;
  rateLimitOverride?: number;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface RequestLog {
  id?: number;
  apiKeyId: string;
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  latencyMs: number;
  ipAddress: string;
  timestamp: string;
  createdAt?: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  degradedMode?: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  tier: UserTier;
  iat?: number;
  exp?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}
