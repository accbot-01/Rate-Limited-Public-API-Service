# Functional Specification Document (FSD)
# Rate-Limited Public API Service

**Project:** Rate-Limited Public API Service  
**Project ID:** proj-1772344501  
**Version:** 1.0  
**Date:** 2026-03-01  
**Status:** DRAFT  

---

## Table of Contents
1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [Functional Requirements](#functional-requirements)
4. [API Endpoints](#api-endpoints)
5. [Rate Limiting](#rate-limiting)
6. [Authentication & Authorization](#authentication--authorization)
7. [Data Models](#data-models)
8. [Acceptance Criteria](#acceptance-criteria)

---

## 1. Introduction

This document specifies the functional requirements for a production-ready Rate-Limited Public API Service that enables third-party developers to access structured public data through a RESTful API with tiered rate limiting.

### 1.1 Purpose
Enable external developers to integrate with our platform via API keys and JWT authentication, with usage-based rate limiting across free, paid, and enterprise tiers.

### 1.2 Scope
- User registration and authentication
- API key management
- Rate-limited data access endpoints
- Usage tracking and monitoring
- Admin controls for key management

---

## 2. System Overview

### 2.1 Architecture
```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│     Express.js API Server           │
│  ┌──────────────────────────────┐   │
│  │  Rate Limiter Middleware     │   │
│  │  (Redis-backed)              │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  Auth Middleware             │   │
│  │  (JWT + API Key validation)  │   │
│  └──────────────────────────────┘   │
└──────┬──────────────────────┬───────┘
       │                      │
       ▼                      ▼
┌─────────────┐        ┌─────────────┐
│ PostgreSQL  │        │    Redis    │
│  (Primary)  │        │  (Cache &   │
│             │        │   Rate      │
│             │        │   Limits)   │
└─────────────┘        └─────────────┘
```

### 2.2 Technology Stack
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 14+
- **Cache:** Redis 7+
- **Auth:** JSON Web Tokens (JWT)
- **Containerization:** Docker + Docker Compose

---

## 3. Functional Requirements

### FR-001: User Registration
**Priority:** P0 (Critical)

**Description:**  
Developers must be able to self-register for an account and receive an API key.

**Acceptance Criteria:**
```gherkin
Given a new developer wants to register
When they POST to /api/v1/register with valid email, password, name
Then the system creates a new account
And generates a unique API key
And returns HTTP 201 with user details and API key
And sends a welcome email

Given a developer tries to register with an existing email
When they POST to /api/v1/register
Then the system returns HTTP 409 Conflict
And provides error message "Email already registered"

Given a developer submits invalid password (< 8 chars)
When they POST to /api/v1/register
Then the system returns HTTP 400 Bad Request
And provides error message "Password must be at least 8 characters"
```

---

### FR-002: User Authentication
**Priority:** P0 (Critical)

**Description:**  
Registered users must authenticate with email/password to receive a JWT for session management.

**Acceptance Criteria:**
```gherkin
Given a registered user with valid credentials
When they POST to /api/v1/login with email and password
Then the system validates credentials
And returns HTTP 200 with JWT token (expires in 24 hours)
And JWT payload includes: userId, email, tier

Given a user provides incorrect password
When they POST to /api/v1/login
Then the system returns HTTP 401 Unauthorized
And does not reveal whether email exists (security)

Given a JWT token is expired
When user makes authenticated request
Then the system returns HTTP 401 Unauthorized
And error message "Token expired, please log in again"
```

---

### FR-003: API Key Management
**Priority:** P0 (Critical)

**Description:**  
Users must be able to view, rotate, and manage their API keys.

**Acceptance Criteria:**
```gherkin
Given an authenticated user
When they GET /api/v1/profile
Then the system returns HTTP 200 with user profile
And includes: name, email, tier, apiKey (masked), created_at

Given an authenticated user wants to rotate their API key
When they POST to /api/v1/profile/rotate-key
Then the system generates a new API key
And invalidates the old key
And returns HTTP 200 with new API key (unmasked, shown once)
And logs the rotation event

Given an API key is manually disabled by admin
When a request uses that key
Then the system returns HTTP 403 Forbidden
And error message "API key has been disabled"
```

---

### FR-004: Public Data Access
**Priority:** P0 (Critical)

**Description:**  
Authenticated API consumers can access structured public data with pagination.

**Acceptance Criteria:**
```gherkin
Given a valid API key in Free tier
When they GET /api/v1/public-data?page=1&limit=50
Then the system validates the API key
And checks rate limit (60 req/min)
And returns HTTP 200 with paginated data
And response includes: data[], page, limit, total, hasMore

Given a request with invalid API key
When they GET /api/v1/public-data
Then the system returns HTTP 401 Unauthorized
And error message "Invalid API key"

Given pagination parameters out of range
When they GET /api/v1/public-data?page=-1&limit=1000
Then the system returns HTTP 400 Bad Request
And error message "page must be >= 1, limit must be between 1 and 100"
```

---

### FR-005: Rate Limiting (Free Tier)
**Priority:** P0 (Critical)

**Description:**  
Free tier users are limited to 60 requests per minute with 2x burst allowance for 10 seconds.

**Acceptance Criteria:**
```gherkin
Given a Free tier API key
When user makes 60 requests in 60 seconds
Then all 60 requests succeed (HTTP 200)

Given a Free tier API key
When user makes 61st request within the same minute
Then the system returns HTTP 429 Too Many Requests
And response includes header Retry-After: <seconds>
And response body includes: error, retryAfter, tier, limit

Given a Free tier API key with burst allowance
When user makes 120 requests in 10 seconds (2x rate)
Then all 120 requests succeed (burst allowed)

Given a Free tier API key exceeds burst
When user continues making requests
Then the system returns HTTP 429
And logs the burst violation
```

---

### FR-006: Rate Limiting (Paid Tier)
**Priority:** P0 (Critical)

**Description:**  
Paid tier users are limited to 600 requests per minute with 2x burst allowance.

**Acceptance Criteria:**
```gherkin
Given a Paid tier API key
When user makes 600 requests in 60 seconds
Then all 600 requests succeed (HTTP 200)

Given a Paid tier API key
When user makes 601st request within the same minute
Then the system returns HTTP 429 Too Many Requests

Given a Paid tier API key with burst
When user makes 1200 requests in 10 seconds
Then all 1200 requests succeed (burst allowed)
```

---

### FR-007: Rate Limiting (Enterprise Tier)
**Priority:** P1 (High)

**Description:**  
Enterprise tier users have custom rate limits configured per account.

**Acceptance Criteria:**
```gherkin
Given an Enterprise tier API key with custom limit 5000 req/min
When user makes 5000 requests in 60 seconds
Then all 5000 requests succeed

Given an Enterprise tier API key
When admin updates custom limit to 10000 req/min
Then the new limit takes effect immediately
And is reflected in rate limit headers
```

---

### FR-008: Abuse Detection & Auto-Suspension
**Priority:** P0 (Critical)

**Description:**  
API keys that repeatedly violate rate limits are automatically suspended for 15 minutes.

**Acceptance Criteria:**
```gherkin
Given a Free tier API key
When user exceeds rate limit 5 times in 5 minutes
Then the system auto-suspends the API key for 15 minutes
And returns HTTP 403 Forbidden
And error message "API key suspended due to repeated abuse. Try again in 15 minutes."
And sends email notification to user

Given a suspended API key after 15 minutes
When suspension period expires
Then the API key is automatically re-enabled
And user can make requests again
```

---

### FR-009: Usage Logging
**Priority:** P0 (Critical)

**Description:**  
Every API request must be logged with timestamp, key, endpoint, status, and latency.

**Acceptance Criteria:**
```gherkin
Given any API request to /api/v1/public-data
When the request is processed
Then the system logs to PostgreSQL:
  - timestamp (ISO 8601)
  - api_key_id (foreign key)
  - endpoint ("/api/v1/public-data")
  - http_method ("GET")
  - status_code (200, 429, etc.)
  - latency_ms (response time)
  - ip_address (client IP)

Given admin queries usage logs
When they GET /api/v1/admin/usage?key=<api_key>&days=7
Then the system returns aggregated usage data per day
And includes: total_requests, status_breakdown, avg_latency
```

---

### FR-010: Admin Key Management
**Priority:** P1 (High)

**Description:**  
Administrators can manually disable or enable API keys.

**Acceptance Criteria:**
```gherkin
Given an admin authenticated with admin role
When they POST /api/v1/admin/keys/:keyId/disable
Then the system sets key status to "disabled"
And returns HTTP 200
And logs the admin action (who, when, reason)

Given a disabled API key
When a user tries to use it
Then the system returns HTTP 403 Forbidden
And error message "API key has been disabled by administrator"

Given an admin wants to re-enable a key
When they POST /api/v1/admin/keys/:keyId/enable
Then the system sets key status to "active"
And logs the admin action
```

---

## 4. API Endpoints

### 4.1 Public Endpoints (No Auth Required)

#### POST /api/v1/register
**Description:** Register a new developer account

**Request Body:**
```json
{
  "email": "developer@example.com",
  "password": "SecurePass123",
  "name": "John Developer"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "developer@example.com",
    "name": "John Developer",
    "tier": "free",
    "apiKey": "ak_live_abcd1234efgh5678",
    "createdAt": "2026-03-01T10:00:00Z"
  }
}
```

#### POST /api/v1/login
**Description:** Authenticate and receive JWT

**Request Body:**
```json
{
  "email": "developer@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid-v4",
    "email": "developer@example.com",
    "tier": "free"
  }
}
```

---

### 4.2 Authenticated Endpoints (JWT Required)

#### GET /api/v1/profile
**Description:** Get current user profile

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "id": "uuid-v4",
  "email": "developer@example.com",
  "name": "John Developer",
  "tier": "free",
  "apiKey": "ak_live_****5678",
  "createdAt": "2026-03-01T10:00:00Z",
  "usage": {
    "today": 1234,
    "thisMonth": 45678
  }
}
```

#### POST /api/v1/profile/rotate-key
**Description:** Rotate API key

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "apiKey": "ak_live_new_key_xyz789",
  "message": "API key rotated successfully. Save this key - it won't be shown again."
}
```

---

### 4.3 API Key Endpoints

#### GET /api/v1/public-data
**Description:** Access paginated public data

**Headers:**
```
X-API-Key: ak_live_abcd1234efgh5678
```

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 50, max: 100)

**Response (200 OK):**
```json
{
  "data": [
    { "id": 1, "title": "Item 1", "value": "data" },
    { "id": 2, "title": "Item 2", "value": "data" }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "hasMore": true
  }
}
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709294400
```

---

### 4.4 Admin Endpoints (Admin Role Required)

#### POST /api/v1/admin/keys/:keyId/disable
**Description:** Manually disable an API key

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

**Response (200 OK):**
```json
{
  "message": "API key disabled successfully",
  "keyId": "uuid-v4",
  "disabledBy": "admin@example.com",
  "disabledAt": "2026-03-01T12:00:00Z"
}
```

#### GET /api/v1/admin/usage
**Description:** Get usage statistics

**Query Parameters:**
- `keyId` (optional) - specific key
- `days` (integer, default: 7)

**Response (200 OK):**
```json
{
  "period": "last_7_days",
  "totalRequests": 123456,
  "byTier": {
    "free": 100000,
    "paid": 20000,
    "enterprise": 3456
  },
  "byEndpoint": {
    "/api/v1/public-data": 120000,
    "/api/v1/profile": 3456
  }
}
```

---

## 5. Rate Limiting

### 5.1 Implementation Strategy
- **Token Bucket Algorithm** via Redis
- **Sliding Window Counter** for accurate per-minute limits
- **Distributed Rate Limiting** for multi-instance deployments

### 5.2 Rate Limit Tiers

| Tier       | Limit (req/min) | Burst Multiplier | Burst Duration |
|------------|-----------------|------------------|----------------|
| Free       | 60              | 2x (120 req)     | 10 seconds     |
| Paid       | 600             | 2x (1200 req)    | 10 seconds     |
| Enterprise | Custom          | Custom           | Custom         |

### 5.3 Response Headers
All API responses include:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709294400
```

### 5.4 429 Response Format
```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the rate limit for your tier (60 requests/minute)",
  "retryAfter": 15,
  "tier": "free",
  "limit": 60,
  "resetAt": "2026-03-01T12:01:00Z"
}
```

---

## 6. Authentication & Authorization

### 6.1 JWT Authentication
- **Algorithm:** HS256
- **Expiration:** 24 hours
- **Payload:** `{ userId, email, tier, iat, exp }`
- **Secret:** Stored in environment variable `JWT_SECRET`

### 6.2 API Key Format
- **Prefix:** `ak_live_` (production), `ak_test_` (sandbox)
- **Length:** 32 characters (alphanumeric)
- **Example:** `ak_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4`

### 6.3 Security Best Practices
- All passwords hashed with **bcrypt** (salt rounds: 12)
- API keys stored as SHA-256 hashes in database
- HTTPS enforced in production
- CORS configured for specific domains
- Rate limiting on auth endpoints (10 req/min for login)

---

## 7. Data Models

### 7.1 Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'enterprise')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 API Keys Table
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
  rate_limit_override INT,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7.3 Request Logs Table
```sql
CREATE TABLE request_logs (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  endpoint VARCHAR(255) NOT NULL,
  http_method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,
  latency_ms INT NOT NULL,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_api_key ON request_logs(api_key_id, created_at DESC);
CREATE INDEX idx_logs_created_at ON request_logs(created_at DESC);
```

---

## 8. Acceptance Criteria Summary

### 8.1 Functional Acceptance
- ✅ Users can register and receive API keys
- ✅ JWT authentication works for all protected endpoints
- ✅ API key authentication works for public-data endpoint
- ✅ Rate limiting enforces tier-based limits accurately
- ✅ Burst allowance works for 10-second windows
- ✅ Repeated abuse triggers 15-minute auto-suspension
- ✅ All requests are logged to database
- ✅ Admins can disable/enable keys manually

### 8.2 Non-Functional Acceptance
- ✅ P95 latency < 200ms for all endpoints
- ✅ System handles 20,000 req/min peak load
- ✅ 99.9% uptime (SLO)
- ✅ SOC2-ready logging and audit trails
- ✅ Docker deployment works on AWS/EC2
- ✅ PostgreSQL and Redis are containerized
- ✅ Environment variables used for all secrets

### 8.3 Security Acceptance
- ✅ All passwords hashed with bcrypt
- ✅ API keys hashed in database
- ✅ HTTPS enforced in production
- ✅ Rate limiting on authentication endpoints
- ✅ Input validation on all endpoints
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (JSON responses only)

---

## 9. Out of Scope (Future Enhancements)
- OAuth2 integration
- Webhook notifications
- GraphQL endpoint
- WebSocket support
- Multi-region deployment
- API key auto-expiration
- Usage-based billing integration

---

**Document Status:** READY FOR REVIEW  
**Next Step:** Architecture Design Phase  
**Estimated Implementation:** 4 weeks
