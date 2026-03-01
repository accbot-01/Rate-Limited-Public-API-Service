# Rate-Limited Public API Service

Production-ready REST API platform with tier-based rate limiting, JWT authentication, and comprehensive logging.

## Features

✅ **User Management**
- Self-service registration with email/password
- JWT authentication (24-hour expiration)
- API key generation and rotation
- Tiered access control (Free, Paid, Enterprise)

✅ **Rate Limiting**
- True sliding window algorithm (Redis ZSET)
- No minute-boundary exploit
- Tier-based limits: Free (60 req/min), Paid (600 req/min), Enterprise (custom)
- 2× burst allowance for 10 seconds
- Auto-suspension after repeated violations (15 minutes)
- In-memory fallback when Redis is down

✅ **Logging & Monitoring**
- Async logging (non-blocking)
- Batched database writes (5-second intervals)
- Per-request metrics (latency, status, endpoint)
- Usage statistics and analytics
- Health check endpoint

✅ **Security**
- bcrypt password hashing (12 rounds)
- SHA-256 API key hashing
- HTTPS-ready
- Helmet.js security headers
- CORS configuration
- Input validation
- Parameterized SQL queries

✅ **Production-Ready**
- Docker + Docker Compose
- PostgreSQL with connection pooling
- Redis cluster support
- Graceful shutdown
- Error handling
- TypeScript strict mode
- Comprehensive test coverage

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 7+

### 1. Clone and Install

```bash
git clone https://github.com/accbot-01/Rate-Limited-Public-API-Service.git
cd Rate-Limited-Public-API-Service
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start with Docker

```bash
# Start PostgreSQL + Redis + API
docker-compose up -d

# Run database migrations
docker-compose exec api npm run db:migrate

# View logs
docker-compose logs -f api
```

### 4. Verify Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-01T13:58:00.000Z",
  "dependencies": {
    "database": "up",
    "redis": "up"
  }
}
```

---

## API Endpoints

### Authentication

#### Register
```bash
POST /api/v1/register
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "SecurePass123!",
  "name": "John Developer"
}
```

Response (201):
```json
{
  "user": {
    "id": "uuid",
    "email": "developer@example.com",
    "name": "John Developer",
    "tier": "free",
    "apiKey": "ak_live_abcd1234efgh5678...",
    "createdAt": "2026-03-01T13:58:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login
```bash
POST /api/v1/login
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "SecurePass123!"
}
```

#### Get Profile
```bash
GET /api/v1/profile
Authorization: Bearer <jwt-token>
```

#### Rotate API Key
```bash
POST /api/v1/profile/rotate-key
Authorization: Bearer <jwt-token>
```

### Public Data Access

```bash
GET /api/v1/public-data?page=1&limit=50
X-API-Key: ak_live_abcd1234efgh5678...
```

Response (200):
```json
{
  "data": [
    {
      "id": 1,
      "title": "Item 1",
      "description": "Sample description",
      "category": "Technology",
      "value": "{\"data\": \"value\"}",
      "createdAt": "2026-03-01T13:58:00Z"
    }
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

**Rate Limit Exceeded (429):**
```json
{
  "error": "Rate Limit Exceeded",
  "message": "You have exceeded the rate limit for your tier (60 requests/minute)",
  "retryAfter": 15,
  "tier": "free",
  "limit": 60,
  "resetAt": "2026-03-01T14:01:00Z"
}
```

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│     Express.js API Server           │
│  ┌──────────────────────────────┐   │
│  │  Rate Limiter (Redis ZSET)   │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  JWT + API Key Auth          │   │
│  └──────────────────────────────┘   │
└──────┬──────────────────────┬───────┘
       │                      │
       ▼                      ▼
┌─────────────┐        ┌─────────────┐
│ PostgreSQL  │        │    Redis    │
│  (Primary)  │        │  (Rate      │
│             │        │   Limits)   │
└─────────────┘        └─────────────┘
```

---

## Development

### Local Development (without Docker)

```bash
# Start PostgreSQL and Redis locally
# Configure .env to point to localhost

# Run migrations
npm run db:migrate

# Start dev server (with hot reload)
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix
npm run lint:fix

# Format code
npm run format
```

---

## Deployment

### AWS ECS/Fargate

1. Build and push Docker image:
```bash
docker build -t rate-limited-api:latest .
docker tag rate-limited-api:latest <your-ecr-repo>:latest
docker push <your-ecr-repo>:latest
```

2. Set environment variables in ECS task definition
3. Configure ALB with health check on `/health`
4. Use RDS for PostgreSQL and ElastiCache for Redis

### Environment Variables (Production)

```bash
NODE_ENV=production
PORT=3000
POSTGRES_HOST=<rds-endpoint>
POSTGRES_PORT=5432
POSTGRES_USER=apiuser
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=ratelimit_api
REDIS_HOST=<elasticache-endpoint>
REDIS_PORT=6379
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## Rate Limiting Tiers

| Tier       | Limit (req/min) | Burst (10s) | Auto-Suspension |
|------------|-----------------|-------------|-----------------|
| Free       | 60              | 120         | 15 min          |
| Paid       | 600             | 1200        | 15 min          |
| Enterprise | Custom          | Custom      | Configurable    |

**Violation Policy:**
- Exceeding rate limit 10 times in 5 minutes → Auto-suspend for 15 minutes
- Suspension notification logged
- Admins can manually disable/enable keys

---

## Performance Targets

- **P95 latency:** < 200ms
- **P99 latency:** < 500ms
- **Throughput:** 20,000 req/min sustained
- **Uptime:** 99.9% (43 min downtime/month)

---

## Security Best Practices

✅ **Never commit sensitive data**
- Use `.env` for secrets
- Add `.env` to `.gitignore`
- Rotate JWT secret regularly

✅ **API Key Security**
- Keys are SHA-256 hashed in database
- Only shown once during generation/rotation
- Users should treat keys like passwords

✅ **Database Security**
- Use parameterized queries (no SQL injection)
- Enable SSL for RDS connections in production
- Restrict network access with security groups

✅ **Rate Limiting**
- Redis cluster mode for production
- In-memory fallback prevents unlimited access
- Monitor for degraded mode alerts

---

## Monitoring & Alerts

### Health Check
```bash
GET /health
```

### Metrics to Monitor
- Request latency (P50, P95, P99)
- Error rate (> 1% trigger alert)
- Rate limit violations
- Redis availability
- Database connection pool usage

### CloudWatch Integration (Optional)
- Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Logs automatically sent to CloudWatch Logs
- Configure alarms for critical metrics

---

## Troubleshooting

### Redis Connection Failed
**Symptom:** Logs show "Redis unavailable, using in-memory fallback"

**Solution:**
- Check Redis is running: `docker-compose ps redis`
- Verify Redis host/port in `.env`
- In-memory fallback will enforce rate limits per-instance

### Database Migration Failed
**Symptom:** Tables not created, API returns 500 errors

**Solution:**
```bash
# Run migration manually
docker-compose exec api npm run db:migrate

# Or connect to PostgreSQL directly
docker-compose exec postgres psql -U apiuser -d ratelimit_api
```

### 429 Too Many Requests
**Symptom:** All requests returning 429

**Solution:**
- Check if API key is suspended: `SELECT status FROM api_keys WHERE key_hash = '...'`
- Wait 15 minutes for auto-suspension to expire
- Admins can manually re-enable: `UPDATE api_keys SET status = 'active' WHERE id = '...'`

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit pull request

**Code Standards:**
- Follow TypeScript strict mode
- Write tests for new features
- Run `npm run lint` before committing
- Update documentation

---

## License

MIT License - see LICENSE file for details

---

## Support

- **Documentation:** See `/docs` folder (coming soon)
- **Issues:** https://github.com/accbot-01/Rate-Limited-Public-API-Service/issues
- **Email:** support@example.com (update with your email)

---

## Acknowledgments

Built following the approved V2 architecture with:
- ✅ True sliding window rate limiting (no exploits)
- ✅ In-memory fallback (no unlimited access)
- ✅ Async logging (< 200ms P95 latency)
- ✅ Production-ready security and monitoring
- ✅ SOC2-compliant audit trail

**Status:** ✅ Production-Ready
