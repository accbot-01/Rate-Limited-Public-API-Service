# Bug Report - Round 1
## Rate-Limited Public API Service

**Project ID:** proj-1772344501  
**Test Round:** 1  
**Report Date:** 2026-03-01  
**Reported By:** Tester Agent (Principal QA Engineer)

---

## Bug Summary

| Bug ID | Severity | Priority | Component | Status | ETA Fix |
|--------|----------|----------|-----------|--------|---------|
| BUG-001 | Critical | P0 | Authentication/Login | Open | 1 hour |
| BUG-002 | Medium | P1 | Health Check Route | Open | 30 minutes |

---

## BUG-001: Login Fails Due to Password Hash Field Name Mismatch

### Severity: **CRITICAL** 🔴
### Priority: **P0 (Must fix before delivery)**
### Component: **src/services/authService.ts (line 73)**

### Description
User login fails with HTTP 500 error due to a field name mismatch when accessing the password hash from the database query result. The code attempts to access `user.passwordHash` (camelCase) but PostgreSQL returns `password_hash` (snake_case).

### Impact
- **Login completely broken** for all users
- **Cannot authenticate** to test protected endpoints
- **Blocks all workflows** that require JWT authentication
- **Production blocker** - users cannot access their accounts

### Affected Endpoints
- `POST /api/v1/login` - Returns HTTP 500 instead of 200

### Root Cause
**File:** `src/services/authService.ts`  
**Line:** 73  
**Code:**
```typescript
const isValidPassword = await bcrypt.compare(password, user.passwordHash);
```

**Issue:** PostgreSQL returns column names in snake_case (`password_hash`) but the TypeScript code expects camelCase (`passwordHash`).

**Error Message:**
```
Error: data and hash arguments required
    at Object.compare (/app/node_modules/bcrypt/bcrypt.js:208:17)
```

### Reproduction Steps

1. Register a new user:
```bash
curl -X POST http://localhost:3000/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

2. Attempt to login with valid credentials:
```bash
curl -X POST http://localhost:3000/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

3. **Expected Result:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "tier": "free"
  }
}
```

4. **Actual Result:**
```json
{
  "error": "Error",
  "message": "Internal Server Error",
  "details": "Error: data and hash arguments required..."
}
```

### Technical Analysis

The database query returns:
```javascript
{
  id: 'uuid',
  email: 'test@example.com',
  password_hash: '$2b$12$...',  // snake_case
  name: 'Test User',
  tier: 'free',
  created_at: '2026-03-01T...',
  updated_at: '2026-03-01T...'
}
```

But the code attempts to access:
```javascript
user.passwordHash  // camelCase - UNDEFINED
```

This results in `user.passwordHash` being `undefined`, which bcrypt rejects.

### Recommended Fix

**Option 1: Use snake_case field name (Quick Fix)**
```typescript
// Line 73 - Change from:
const isValidPassword = await bcrypt.compare(password, user.passwordHash);

// To:
const isValidPassword = await bcrypt.compare(password, (user as any).password_hash);
```

**Option 2: Map database result to camelCase (Better Fix)**

Add a mapper function in `src/models/database.ts`:
```typescript
export function mapUserFromDb(dbUser: any): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    passwordHash: dbUser.password_hash,  // Map here
    name: dbUser.name,
    tier: dbUser.tier,
    createdAt: new Date(dbUser.created_at),
    updatedAt: new Date(dbUser.updated_at)
  };
}
```

Then in `authService.ts`:
```typescript
import { mapUserFromDb } from '../models/database';

// Line 67-71
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email.toLowerCase()]
);

if (result.rows.length === 0) {
  throw new AppError('Invalid credentials', 401);
}

const user = mapUserFromDb(result.rows[0]);  // Map here

// Now user.passwordHash works correctly
const isValidPassword = await bcrypt.compare(password, user.passwordHash);
```

**Recommended:** Option 2 (consistent with TypeScript type definitions)

### Testing After Fix

1. Run existing test: `TC-002.1: Login with valid credentials`
2. Verify HTTP 200 and JWT token returned
3. Run test: `TC-002.2: Reject login with invalid password`
4. Verify HTTP 401 (not 500)
5. Regression test: Verify registration still works (uses `password_hash` correctly)

### Related Issues
- Same pattern may exist in other database queries (check for other snake_case fields)
- Consider adding a database result mapper for all entities
- Update TypeScript interfaces to match actual database schema

---

## BUG-002: Health Check Endpoint Incorrectly Mounted

### Severity: **MEDIUM** 🟡
### Priority: **P1 (High)**
### Component: **src/app.ts (line 43)**

### Description
The health check endpoint is accessible at `/health/health` instead of `/health` as specified in the FSD. This is due to incorrect route mounting where the health route already defines `/health` and is then mounted at `/health`.

### Impact
- **Monitoring tools** will fail to reach health check at expected URL
- **Load balancers** configured with `/health` will mark service as unhealthy
- **Docker health check** will fail (container health check uses `/health`)
- **Inconsistent with API documentation** and FSD specification

### Affected Endpoints
- `GET /health` - Returns HTTP 404 (expected to return 200)
- `GET /health/health` - Returns HTTP 200 (incorrect URL)

### Root Cause
**File:** `src/app.ts`  
**Line:** 43

**Current Code:**
```typescript
// Health check (no /api/v1 prefix)
app.use('/health', healthRoutes);
```

**File:** `src/routes/healthRoutes.ts`  
**Line:** 10
```typescript
router.get('/health', async (req: Request, res: Response) => {
  // ...
});
```

**Issue:** The route defines `/health` and is mounted at `/health`, resulting in `/health/health`.

### Reproduction Steps

1. Query the expected health endpoint:
```bash
curl -i http://localhost:3000/health
```

**Expected:**
```
HTTP/1.1 200 OK
{"status":"healthy",...}
```

**Actual:**
```
HTTP/1.1 404 Not Found
{"error":"Not Found","message":"Cannot GET /health"}
```

2. Query the incorrect endpoint:
```bash
curl -i http://localhost:3000/health/health
```

**Actual Result:**
```
HTTP/1.1 200 OK
{"status":"healthy","timestamp":"...","dependencies":{...}}
```

### Recommended Fix

**Option 1: Mount at root (Preferred)**

**File:** `src/app.ts`, Line 43
```typescript
// Change from:
app.use('/health', healthRoutes);

// To:
app.use('/', healthRoutes);
```

Keep `src/routes/healthRoutes.ts` unchanged:
```typescript
router.get('/health', async (req: Request, res: Response) => {
  // ...
});
```

**Option 2: Change route path**

**File:** `src/routes/healthRoutes.ts`, Line 10
```typescript
// Change from:
router.get('/health', async (req: Request, res: Response) => {

// To:
router.get('/', async (req: Request, res: Response) => {
```

Keep mounting in `src/app.ts`:
```typescript
app.use('/health', healthRoutes);
```

**Recommended:** Option 1 (clearer separation of concerns)

### Docker Impact

The `Dockerfile` includes a health check that will currently fail:

**File:** `Dockerfile`, Line 38
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

This health check will fail because `/health` returns 404. **After fix, Docker container health will report correctly.**

### Testing After Fix

1. Verify GET `/health` returns HTTP 200
2. Verify response includes `status`, `timestamp`, and `dependencies`
3. Verify `dependencies.database` and `dependencies.redis` are "up"
4. Verify Docker health check passes: `docker inspect ratelimit-api-service | jq '.[0].State.Health'`
5. Regression test: Verify other routes still work

### Related Issues
- Update API documentation if health endpoint was documented as `/health/health`
- Review all other route mountings for similar issues
- Consider using route prefixes consistently

---

## Additional Observations

### Code Quality Issues (Non-blocking)

#### 1. TypeScript Type Safety
**Location:** Multiple files  
**Issue:** Using `as any` or missing proper type mappings between database and TypeScript  
**Recommendation:** Create strict database-to-model mappers for all entities

#### 2. Error Handling Consistency
**Location:** Various controllers  
**Issue:** Some errors return stack traces in development mode  
**Recommendation:** Ensure `NODE_ENV=production` disables stack traces

#### 3. Test Database Configuration
**Location:** `src/__tests__/api.test.ts`  
**Issue:** Tests try to connect to localhost instead of Docker network  
**Recommendation:** Use separate test database or mock database connections

### Security Observations (Informational)

✅ **Good:**
- bcrypt with 12 salt rounds
- API keys hashed in database
- JWT with reasonable expiration
- Generic error messages for auth failures
- Helmet security headers

⚠️ **Consider:**
- Rate limiting on login endpoint (prevent brute force)
- Password complexity requirements (currently only length checked)
- Account lockout after N failed login attempts
- HTTPS enforcement in production
- Environment variable validation at startup

### Performance Observations

✅ **Good:**
- Database queries use indexes
- Redis for rate limiting (fast)
- Response times < 200ms

⚠️ **Consider:**
- Connection pooling configuration (not tested under load)
- Redis key expiration for rate limits
- Database query optimization for `request_logs` table (will grow large)

---

## Testing Recommendations for Round 2

### After Bug Fixes

1. **Re-run all failed tests:**
   - TC-002.1: Login with valid credentials
   - TC-002.2: Reject login with invalid password
   - NFR-001: Health check endpoint

2. **Regression testing:**
   - Verify all previously passing tests still pass
   - Test edge cases around password hash field access

3. **Additional testing:**
   - Test with paid tier users (requires tier upgrade feature)
   - Test abuse detection and auto-suspension
   - Verify request logging in database
   - Load testing: 20,000 req/min sustained (per FSD)

### Before Production Deployment

1. **Security audit:**
   - OWASP ZAP scan
   - SQL injection testing
   - XSS prevention validation
   - HTTPS enforcement check

2. **Performance testing:**
   - Load test with 20k req/min
   - Database connection pool under stress
   - Redis failover testing
   - Response time percentiles (P50, P95, P99)

3. **Operational readiness:**
   - Verify health check works with monitoring tools
   - Test log aggregation
   - Verify metrics collection
   - Database backup/restore procedures

---

## Developer Action Items

### Immediate (Blocking Delivery)

- [ ] **Fix BUG-001:** Password hash field name mismatch
  - Estimated time: 1 hour
  - Files to modify: `src/services/authService.ts` (and optionally `src/models/database.ts`)
  - Add unit tests to prevent regression

- [ ] **Fix BUG-002:** Health check endpoint mounting
  - Estimated time: 30 minutes
  - Files to modify: `src/app.ts` OR `src/routes/healthRoutes.ts`
  - Verify Docker health check passes after fix

### High Priority (Should Fix Before Delivery)

- [ ] Add database result mappers for type safety
- [ ] Review all snake_case vs camelCase field accesses
- [ ] Add integration test for login flow
- [ ] Document actual health check URL in README

### Medium Priority (Nice to Have)

- [ ] Add rate limiting on login endpoint
- [ ] Implement account lockout after failed attempts
- [ ] Add password complexity validation
- [ ] Configure test database for unit tests

---

## Appendix: Test Environment Details

### Docker Compose Stack
```yaml
services:
  postgres: PostgreSQL 14-alpine (port 5432)
  redis: Redis 7-alpine (port 6379)
  api: Node.js 18-alpine (port 3000)
```

### Environment Variables
```env
NODE_ENV=development
POSTGRES_HOST=postgres
POSTGRES_USER=apiuser
POSTGRES_DB=ratelimit_api
REDIS_HOST=redis
JWT_SECRET=dev_jwt_secret_change_in_production
```

### Sample Data
- 1000 records in `public_data` table
- 3 test users created during testing
- 4 API keys generated (including rotations)

---

**Report Prepared By:** Tester Agent  
**Role:** Principal QA Engineer (15+ years experience)  
**Date:** 2026-03-01  
**Contact:** Forward to Developer Agent for bug fixes  
**Status:** Ready for Round 2 after fixes applied
