# Test Plan — Module 1 (Complete API Service)
**Project:** Rate-Limited Public API Service  
**Project ID:** proj-1772344501  
**Test Round:** 1  
**Date:** 2026-03-01  
**Tester:** Tester Agent (Principal QA Engineer, 15+ years)

---

## 1. Test Scope

### 1.1 System Under Test
- **Node.js + Express + TypeScript** API service
- **PostgreSQL** database (user data, API keys, request logs)
- **Redis** rate limiting with sliding window
- **Docker Compose** local deployment

### 1.2 Critical Requirements from PM/Architect Docs
- ✅ **20,000 req/min peak capacity** (must support under load)
- ✅ **99.9% uptime** (robust error handling, graceful degradation)
- ✅ **< 200ms P95 latency** (async logging, optimized queries)
- ✅ **True sliding window rate limiting** (NO minute-boundary exploit)
- ✅ **In-memory fallback** when Redis down (fail-safe, not fail-open)
- ✅ **Auto-suspension** after 10 violations in 5 minutes (abuse prevention)
- ✅ **SOC2-ready logging** (every request logged, immutable audit trail)
- ✅ **Security-first** (bcrypt passwords, SHA-256 API keys, no SQL injection)

### 1.3 Modules Tested
**All code in:** `/Users/accuser/.openclaw/workspace/projects/proj-1772344501/code/src/`
- Services: `authService`, `rateLimitService`, `loggingService`
- Middleware: `auth`, `rateLimit`, `logger`, `errorHandler`
- Controllers: `authController`, `dataController`
- Models: `database`, `redis`
- Utilities: `apiKey`, `logBuffer`, `errors`
- Routes: `authRoutes`, `dataRoutes`, `healthRoutes`
- Configuration: `config/index.ts`
- Database: Migration script, schema design

---

## 2. Testing Methodology: 5-Gate Quality Process

### Gate 1: Reconnaissance (Complete)
**Duration:** 30 minutes  
**Objective:** Understand system architecture, identify attack surface, map data flows

**Activities:**
- ✅ Read PM requirements (BRD, SOW, FSD)
- ✅ Read Architecture V2 (revised design with sliding window)
- ✅ Read ALL source code files (23 TypeScript files examined)
- ✅ Map authentication flows (JWT + API key)
- ✅ Map rate limiting logic (Redis ZSET sliding window)
- ✅ Map logging pipeline (async buffer → PostgreSQL batch writes)
- ✅ Identify external dependencies (PostgreSQL, Redis)
- ✅ Identify user input vectors (req.body, req.query, req.headers)

---

### Gate 2: Security Scan (OWASP Top 10)
**Duration:** 90 minutes  
**Objective:** Find security vulnerabilities that could lead to data breach, abuse, or unauthorized access

#### 2.1 SQL Injection (A01:2021)
**Risk:** HIGH — Database breach, data exfiltration  
**Testing Approach:**
- ✅ Audit all `db.query()` calls for parameterized queries
- ✅ Check for string concatenation with user input
- ✅ Test malicious inputs: `'; DROP TABLE users; --`, `1' OR '1'='1`

#### 2.2 Broken Authentication (A07:2021)
**Risk:** CRITICAL — Account takeover, unauthorized access  
**Testing Approach:**
- ✅ JWT token expiration validation
- ✅ API key format validation
- ✅ Password strength enforcement
- ✅ bcrypt hashing (cost factor ≥ 12)
- ✅ Brute force protection (rate limiting on login)

#### 2.3 Sensitive Data Exposure (A02:2021)
**Risk:** HIGH — Password leaks, API key exposure  
**Testing Approach:**
- ✅ Check for plaintext passwords in database
- ✅ Check for API keys stored unhashed
- ✅ Check for secrets in code (hardcoded JWT secret)
- ✅ Error messages don't leak sensitive info

#### 2.4 Broken Access Control (A01:2021)
**Risk:** CRITICAL — Privilege escalation, unauthorized data access  
**Testing Approach:**
- ✅ Test API key can't access other users' data
- ✅ Test JWT can't access other users' profiles
- ✅ Test disabled API keys are rejected
- ✅ Test suspended API keys are rejected

#### 2.5 Security Misconfiguration (A05:2021)
**Risk:** MEDIUM — Attack surface exposure  
**Testing Approach:**
- ✅ CORS configuration (not wildcard in production)
- ✅ Helmet.js headers enabled
- ✅ Environment variables used (not hardcoded secrets)
- ✅ Database connection pooling limits
- ✅ Error stack traces not exposed to client

#### 2.6 Input Validation (A03:2021)
**Risk:** HIGH — XSS, injection attacks, DoS  
**Testing Approach:**
- ✅ Email validation on registration
- ✅ Password strength validation
- ✅ API key format validation
- ✅ Pagination parameters validation (page ≥ 1, limit ≤ 100)
- ✅ Test malformed JSON, missing fields, wrong types

---

### Gate 3: Type Safety & Code Quality
**Duration:** 60 minutes  
**Objective:** Find runtime errors caused by type issues, null handling, or unsafe code

#### 3.1 TypeScript Strict Mode
- ✅ Check `tsconfig.json` has `strict: true`
- ✅ No `any` types without justification
- ✅ No `@ts-ignore` or `@ts-expect-error` abuse
- ✅ All functions have explicit return types

#### 3.2 Null/Undefined Handling
- ✅ Database query results checked for empty (`.rows.length === 0`)
- ✅ `req.user`, `req.apiKeyId` checked before access
- ✅ Redis client health checked before use
- ✅ Optional properties handled safely (`?.` operator)

#### 3.3 Async Error Handling
- ✅ All `async` functions have `try-catch` or use `asyncHandler`
- ✅ Promises have `.catch()` or `await` inside try-catch
- ✅ Database transactions use `BEGIN`/`COMMIT`/`ROLLBACK`
- ✅ Background workers log errors (log buffer flush)

---

### Gate 4: Edge Case Assault
**Duration:** 90 minutes  
**Objective:** Find bugs that occur with extreme, unusual, or malicious inputs

#### 4.1 Rate Limiting Edge Cases
- ✅ Minute-boundary exploit (60 req at :59, 60 req at :00)
- ✅ Burst allowance boundary (exactly 120 req in 10s for free tier)
- ✅ Auto-suspension threshold (exactly 10 violations in 5 min)
- ✅ Suspended key expires after exactly 15 minutes
- ✅ Redis down → in-memory fallback enforces limits
- ✅ Multiple ECS tasks with sticky sessions (1.5× limit max)

#### 4.2 Authentication Edge Cases
- ✅ Register with duplicate email (409 Conflict)
- ✅ Login with wrong password (401 Unauthorized)
- ✅ JWT token expires after 24 hours (401)
- ✅ API key rotation invalidates old key immediately
- ✅ Disabled API key returns 403
- ✅ Suspended API key returns 403

#### 4.3 Pagination Edge Cases
- ✅ `page=0` (should reject or default to 1)
- ✅ `page=-1` (should return 400)
- ✅ `limit=0` (should reject or default)
- ✅ `limit=1000` (should cap at 100)
- ✅ `limit=-5` (should return 400)
- ✅ Last page with partial results

#### 4.4 Database Edge Cases
- ✅ Connection pool exhaustion (20 max connections)
- ✅ Query timeout (slow queries)
- ✅ Transaction rollback on error
- ✅ Foreign key constraint violations
- ✅ Unique constraint violations (duplicate email, API key hash)

#### 4.5 Logging Edge Cases
- ✅ Log buffer full (10,000 entries)
- ✅ Batch flush fails (write to disk backup)
- ✅ PostgreSQL insert fails (log is dropped or retried)
- ✅ High throughput (20k req/min = 333 req/sec)

---

### Gate 5: Performance & Load Verification
**Duration:** 60 minutes  
**Objective:** Prove system meets non-functional requirements under load

#### 5.1 Latency Targets
- **Target:** P95 < 200ms, P50 < 100ms
- **Test:** 10,000 requests, measure response times
- **Critical:** Async logging must not block response

#### 5.2 Throughput Targets
- **Target:** 20,000 req/min peak, 10,000 req/min sustained
- **Test:** Load test for 10 minutes
- **Critical:** No errors, no rate limit failures

#### 5.3 Rate Limit Accuracy
- **Target:** ±1% accuracy under load
- **Test:** Send 60 req/min for free tier, expect 61st to fail
- **Critical:** No false positives, no false negatives

#### 5.4 Database Performance
- **Target:** Query P95 < 50ms
- **Test:** 10,000 queries with connection pooling
- **Critical:** No connection pool exhaustion

#### 5.5 Redis Performance
- **Target:** Rate limit check < 10ms P95
- **Test:** 20,000 rate limit checks
- **Critical:** Sliding window ZSET operations don't degrade

---

## 3. Test Cases by Feature

### 3.1 User Registration
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-001 | Valid registration | 201 Created, API key returned | P0 |
| TC-002 | Duplicate email | 409 Conflict | P0 |
| TC-003 | Invalid email format | 400 Bad Request | P1 |
| TC-004 | Weak password (< 8 chars) | 400 Bad Request | P1 |
| TC-005 | Missing required field | 400 Bad Request | P1 |
| TC-006 | Password stored as bcrypt hash | bcrypt hash in DB | P0 |
| TC-007 | API key stored as SHA-256 hash | SHA-256 hash in DB | P0 |

### 3.2 User Authentication (Login)
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-010 | Valid credentials | 200 OK, JWT token returned | P0 |
| TC-011 | Invalid password | 401 Unauthorized | P0 |
| TC-012 | Non-existent email | 401 Unauthorized (no user enumeration) | P0 |
| TC-013 | JWT expires after 24h | 401 on expired token use | P0 |
| TC-014 | JWT payload contains userId, email, tier | Correct payload | P1 |

### 3.3 API Key Authentication
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-020 | Valid API key | Request succeeds | P0 |
| TC-021 | Invalid API key | 401 Unauthorized | P0 |
| TC-022 | Missing X-API-Key header | 401 Unauthorized | P0 |
| TC-023 | Disabled API key | 403 Forbidden | P0 |
| TC-024 | Suspended API key | 403 Forbidden | P0 |
| TC-025 | API key rotation | Old key fails, new key works | P0 |

### 3.4 Rate Limiting
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-030 | 60 req/min free tier | All succeed | P0 |
| TC-031 | 61st request free tier | 429 Too Many Requests | P0 |
| TC-032 | Minute-boundary exploit | Prevented by sliding window | P0 |
| TC-033 | Burst allowance (120 req in 10s) | All succeed | P0 |
| TC-034 | 10 violations in 5 min | Auto-suspend for 15 min | P0 |
| TC-035 | Redis down | In-memory fallback enforces limits | P0 |
| TC-036 | Rate limit headers present | X-RateLimit-* headers | P1 |
| TC-037 | 429 response has Retry-After | Retry-After header | P1 |

### 3.5 Public Data Endpoint
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-040 | Valid request with pagination | 200 OK, paginated data | P0 |
| TC-041 | Invalid page number (0, -1) | 400 Bad Request | P1 |
| TC-042 | Limit exceeds max (>100) | Cap at 100 or return 400 | P1 |
| TC-043 | Missing API key | 401 Unauthorized | P0 |
| TC-044 | Last page | hasMore: false | P1 |

### 3.6 Logging & Monitoring
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-050 | Every request logged | Log entry in request_logs | P0 |
| TC-051 | Log includes all required fields | timestamp, apiKeyId, endpoint, status, latency, IP | P0 |
| TC-052 | Async logging doesn't block response | P95 latency < 200ms | P0 |
| TC-053 | Batch flush every 5 seconds | 1000 logs flushed | P1 |
| TC-054 | Log buffer overflow | Oldest dropped or rejected | P1 |

### 3.7 Health Check
| Case ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| TC-060 | Health check with DB + Redis up | 200 OK, both healthy | P1 |
| TC-061 | Health check with Redis down | 200 OK, Redis unhealthy warning | P1 |
| TC-062 | Health check with DB down | 500 Internal Server Error | P0 |

---

## 4. Security Test Matrix

| OWASP Category | Test | Pass/Fail | Notes |
|----------------|------|-----------|-------|
| A01: Broken Access Control | API key can't access other users' data | TBD | |
| A01: SQL Injection | All queries parameterized | TBD | |
| A02: Cryptographic Failures | Passwords hashed with bcrypt (≥12) | TBD | |
| A02: Cryptographic Failures | API keys hashed with SHA-256 | TBD | |
| A03: Injection | Input validation on all endpoints | TBD | |
| A04: Insecure Design | Rate limiting prevents abuse | TBD | |
| A05: Security Misconfiguration | No hardcoded secrets | TBD | |
| A05: Security Misconfiguration | CORS not wildcard | TBD | |
| A07: Identification/Auth Failures | JWT expires after 24h | TBD | |
| A09: Security Logging Failures | Every request logged | TBD | |

---

## 5. Performance Test Plan

### 5.1 Load Test Scenarios
| Scenario | Duration | Target RPS | Objective |
|----------|----------|------------|-----------|
| Warmup | 2 min | 50 req/sec | Establish baseline |
| Sustained Load | 10 min | 166 req/sec (10k/min) | Prove sustained capacity |
| Peak Load | 5 min | 333 req/sec (20k/min) | Prove peak capacity |
| Spike Test | 2 min | 500 req/sec (30k/min) | Observe failure mode |

### 5.2 Metrics to Collect
- ✅ Response time: P50, P95, P99
- ✅ Error rate (target: <1%)
- ✅ Rate limit accuracy (false positive/negative rate)
- ✅ Database query time (P95 < 50ms)
- ✅ Redis operation time (P95 < 10ms)
- ✅ Connection pool utilization (max 20)
- ✅ Log buffer size (should not exceed 10,000)

---

## 6. Known Limitations (Out of Scope)
- ❌ No admin endpoints (FR-010 deferred)
- ❌ No email verification (registration works without verification)
- ❌ No password reset flow
- ❌ No comprehensive unit test suite (only integration tests)
- ❌ No CloudWatch integration (stub exists)
- ❌ No load testing on actual infrastructure (local Docker only)

---

## 7. Test Environment

### 7.1 Local Docker Compose
- **Node.js:** 18+
- **PostgreSQL:** 14+ (via Docker)
- **Redis:** 7+ (via Docker)
- **Network:** Bridge network, all services communicate

### 7.2 Test Data
- **Users:** 0 (will create during testing)
- **API Keys:** 0 (generated during testing)
- **Public Data:** 1000 sample records (seeded via migration)

### 7.3 Test Tools
- **Manual Testing:** `curl` commands
- **Load Testing:** Custom Node.js script or `k6` (if available)
- **Code Analysis:** Manual code review (already complete)
- **Database Queries:** `psql` CLI

---

## 8. Exit Criteria

### 8.1 Functional Acceptance
- ✅ All P0 test cases pass (100%)
- ✅ All P1 test cases pass (≥90%)
- ✅ No CRITICAL or HIGH severity bugs unresolved

### 8.2 Security Acceptance
- ✅ No SQL injection vulnerabilities
- ✅ No XSS vulnerabilities
- ✅ No hardcoded secrets in code
- ✅ Passwords hashed with bcrypt (≥12 rounds)
- ✅ API keys hashed with SHA-256
- ✅ Rate limiting prevents abuse

### 8.3 Performance Acceptance
- ✅ P95 latency < 200ms
- ✅ 20k req/min peak capacity proven
- ✅ Rate limit accuracy ≥99%
- ✅ No database connection pool exhaustion

### 8.4 Code Quality Acceptance
- ✅ No `any` types without justification
- ✅ All async errors handled
- ✅ All database queries parameterized
- ✅ TypeScript strict mode enabled

---

## 9. Test Execution Schedule

**Total Duration:** 5-6 hours

| Phase | Duration | Activities |
|-------|----------|------------|
| **Gate 1: Reconnaissance** | 30 min | ✅ COMPLETE |
| **Gate 2: Security Scan** | 90 min | IN PROGRESS |
| **Gate 3: Type Safety** | 60 min | Pending |
| **Gate 4: Edge Cases** | 90 min | Pending |
| **Gate 5: Performance** | 60 min | Pending |
| **Bug Report Writing** | 60 min | Pending |
| **Test Results Report** | 30 min | Pending |

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cannot run local Docker environment | HIGH | Test on staging/dev server |
| Redis not available | MEDIUM | Test in-memory fallback thoroughly |
| Database migration fails | HIGH | Review migration script manually |
| Load testing tools not available | LOW | Manual testing with `curl` in loops |
| Time constraint (must complete in 1 day) | HIGH | Prioritize CRITICAL/HIGH bugs first |

---

**Status:** Gate 1 COMPLETE, Gate 2 IN PROGRESS  
**Next Step:** Complete security scan, document bugs, move to Gate 3
