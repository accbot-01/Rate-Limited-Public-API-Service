# Business Requirements Document (BRD)
## Rate-Limited Public API Service

**Project ID:** proj-1772344501  
**Document Version:** 2.0  
**Date:** March 1, 2026  
**Status:** Production-Ready  
**Stakeholders:** Engineering Lead, Founder

---

## 1. Executive Summary

### 1.1 Project Overview
This project delivers a production-grade REST API platform enabling third-party developers to register, authenticate, and access structured public data with tier-based rate limiting. The service is designed to handle **20,000 requests per minute peak load** with 99.9% uptime, SOC2-ready logging, and operational visibility.

### 1.2 Business Objectives
- **Enable Third-Party Integration**: Provide a secure, self-service API platform for external developers
- **Freemium Business Model**: Free tier → Paid monthly subscription → Enterprise custom contracts
- **Data Distribution**: Deliver structured public data efficiently and reliably at scale
- **Operational Excellence**: Monitor usage, prevent abuse, maintain system health with enterprise-grade reliability
- **SOC2 Compliance Path**: Audit-ready logging and security controls

### 1.3 Success Criteria
- Developer onboarding time < 5 minutes (registration to first API call)
- API availability **≥ 99.9% uptime** (43 minutes downtime/month max)
- **P95 latency < 200ms** for all endpoints
- Rate limiting accuracy ≥ 99% (correct enforcement)
- Zero unauthorized data access incidents
- Per-key and per-endpoint usage tracking with < 1 minute delay
- Successful handling of **20,000 requests per minute peak load** without degradation
- SOC2-ready audit trail for all operations

---

## 2. Business Context

### 2.1 Problem Statement
External developers need programmatic access to our structured public data. Manual data sharing is not scalable. Without a formal API platform:
- No controlled access mechanism
- No usage visibility or abuse prevention
- No ability to differentiate service tiers or monetize access
- No developer self-service
- No compliance-ready audit trail

### 2.2 Target Users
**Primary**: External third-party software developers and engineering teams building integrations

**Personas**:
1. **Independent Developer**: Building side projects, open-source tools → needs free tier
2. **Startup/SMB**: Commercial use, moderate volume → willing to pay monthly subscription for higher limits
3. **Enterprise Integrator**: High-volume production systems → requires custom contracts, dedicated support, and SLA guarantees

### 2.3 Business Model
**Freemium to Enterprise Progression**:
- **Free Tier**: 60 req/min → Developer acquisition, proof of concept
- **Paid Tier**: 600 req/min → Monthly subscription (price TBD) → Revenue generation
- **Enterprise Tier**: Custom limits → Annual contracts → High-touch sales, dedicated support

### 2.4 Business Value
- **Market Expansion**: Opens data access to broader developer ecosystem
- **Revenue Generation**: Paid and Enterprise tiers establish sustainable monetization
- **Competitive Position**: Professional API offering with enterprise-grade reliability increases platform credibility
- **Operational Efficiency**: Self-service reduces support burden, SOC2-ready design enables enterprise sales

---

## 3. Functional Requirements

### 3.1 Developer Registration & Account Management
**BR-001**: System shall allow developers to self-register with email and password  
**BR-002**: System shall validate email format and enforce password strength:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 number
  - At least 1 special character  
**BR-003**: System shall hash passwords using bcrypt (cost factor ≥ 12) or stronger algorithm  
**BR-004**: System shall generate unique API key upon successful registration using cryptographically secure randomness (min 32 bytes)  
**BR-005**: System shall assign default "Free" tier (60 req/min) to new registrations  
**BR-006**: System shall allow developers to retrieve their profile information  
**BR-007**: System shall support API key rotation (developers can generate new key, invalidating old key)  
**BR-008**: API keys shall have **no automatic expiration** (manual revocation only)

### 3.2 Authentication & Authorization
**BR-009**: System shall authenticate developers via JWT for account operations (login, profile access)  
**BR-010**: System shall authenticate API calls via API key header (`X-API-Key`) for public data access  
**BR-011**: JWT tokens shall expire after 24 hours  
**BR-012**: System shall reject requests with invalid/expired tokens or API keys  
**BR-013**: System shall validate API key is active (not suspended/revoked) on every request

### 3.3 Data Access
**BR-014**: System shall provide paginated access to structured public data  
**BR-015**: System shall return data in JSON format only  
**BR-016**: System shall support pagination with configurable page size (default 20, max 100 items)  
**BR-017**: System shall include pagination metadata (total, page, pageSize, totalPages) in responses  

### 3.4 Rate Limiting (UPDATED)
**BR-018**: System shall enforce per-API-key rate limits based on tier:
  - **Free tier**: 60 requests per minute
  - **Paid tier**: 600 requests per minute
  - **Enterprise tier**: Custom limits (configurable per key)  
**BR-019**: System shall allow **burst allowances**: 2x per-minute limit for 10 seconds  
  - Example: Free tier can burst to 120 req/min for 10 seconds, then enforce 60 req/min average  
**BR-020**: System shall return **HTTP 429 (Too Many Requests)** when limit exceeded with:
  - `Retry-After` header (seconds until rate limit resets)
  - JSON error body with clear message  
**BR-021**: System shall include rate limit headers in all responses:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when window resets  
**BR-022**: System shall detect repeated rate limit violations (>10 violations within 5 minutes)  
**BR-023**: System shall **auto-suspend API keys** for 15 minutes after repeated violations  
**BR-024**: System shall log all suspensions with reason and timestamp for audit trail

### 3.5 Monitoring & Abuse Prevention
**BR-025**: System shall log **every API call** with:
  - Timestamp (ISO 8601)
  - API key (hashed for privacy)
  - Endpoint + HTTP method
  - Response status code
  - Response time (milliseconds)
  - Request size (bytes)
  - IP address (anonymized per GDPR if applicable)  
**BR-026**: System shall track per-key request counts with < 1 minute aggregation delay  
**BR-027**: System shall track per-endpoint usage statistics (total calls, avg response time, error rate)  
**BR-028**: System shall support **manual API key disabling** by admin (immediate effect)  
**BR-029**: System shall persist usage data for minimum **90 days** for audit/analysis (SOC2 requirement)  
**BR-030**: System shall support querying usage history by key, endpoint, date range

### 3.6 Admin Operations
**BR-031**: System shall provide admin API to manually disable/enable API keys  
**BR-032**: System shall provide admin API to view suspended keys and clear suspensions  
**BR-033**: System shall provide admin API to update tier limits for specific keys (for Enterprise custom limits)  
**BR-034**: Admin operations shall require separate authentication (admin JWT with elevated privileges)

---

## 4. Non-Functional Requirements

### 4.1 Performance
**NFR-001**: API response time **p95 < 200ms** for all endpoints  
**NFR-002**: System shall handle sustained load of **10,000 requests per minute**  
**NFR-003**: System shall handle peak load of **20,000 requests per minute** without degradation  
**NFR-004**: System shall support minimum 200 concurrent requests  
**NFR-005**: Database query response time p95 < 50ms

### 4.2 Scalability
**NFR-006**: Architecture shall support horizontal scaling of API servers (stateless design)  
**NFR-007**: Database schema shall support 1M+ developer accounts  
**NFR-008**: Rate limiting shall remain accurate under peak load (20k req/min)  
**NFR-009**: Redis cluster shall support failover without data loss

### 4.3 Availability & Reliability
**NFR-010**: Target uptime: **99.9%** (43 minutes downtime/month allowed)  
**NFR-011**: System shall gracefully degrade if Redis unavailable:
  - Log all requests as "rate limit bypassed"
  - Continue serving requests (fail-open)
  - Alert operations team immediately  
**NFR-012**: Database backups shall run daily with 30-day retention  
**NFR-013**: System shall implement circuit breakers for external dependencies  
**NFR-014**: System shall support zero-downtime deployments

### 4.4 Security
**NFR-015**: All endpoints shall use HTTPS only (TLS 1.2+)  
**NFR-016**: Passwords shall be hashed using **bcrypt (cost factor ≥ 12) or Argon2**  
**NFR-017**: API keys shall be generated using cryptographically secure randomness (min 32 bytes)  
**NFR-018**: API keys shall be **rotatable** (user-initiated, invalidates old key)  
**NFR-019**: JWT secrets shall be stored in environment variables, not code  
**NFR-020**: System shall implement CORS restrictions (configurable allowed origins)  
**NFR-021**: System shall implement input validation on all endpoints (reject malformed requests)  
**NFR-022**: System shall sanitize all database queries (parameterized queries only, no string concatenation)  
**NFR-023**: System shall implement rate limiting on authentication endpoints (prevent brute force: 5 attempts per IP per minute)

### 4.5 Compliance & Audit (SOC2-Ready)
**NFR-024**: System shall log all API calls with complete audit trail (timestamp, user, action, outcome)  
**NFR-025**: Logs shall be immutable (append-only, no deletion except automated 90-day retention)  
**NFR-026**: System shall log all admin actions (key disable/enable, tier changes) with admin identity  
**NFR-027**: System shall support log export for compliance audits (JSON format)  
**NFR-028**: System shall implement access controls (principle of least privilege)  
**NFR-029**: Error messages shall not leak sensitive information (no stack traces in production API responses)

### 4.6 Observability
**NFR-030**: All errors shall be logged with stack traces and context (server-side only)  
**NFR-031**: System shall expose health check endpoint (`/health`) with dependency status (DB, Redis)  
**NFR-032**: System shall expose metrics endpoint (`/metrics`) for Prometheus/CloudWatch  
**NFR-033**: System shall implement distributed tracing (correlation IDs across requests)  
**NFR-034**: System shall alert on:
  - Error rate > 1%
  - P95 latency > 250ms
  - Rate limit bypass (Redis down)
  - Repeated API key suspensions (>5 keys suspended in 10 minutes)

### 4.7 Deployment
**NFR-035**: System shall be containerized using Docker  
**NFR-036**: System shall support deployment to AWS (ECS/EC2/Fargate)  
**NFR-037**: Configuration shall be environment-based (dev/staging/production)  
**NFR-038**: System shall support blue-green deployments (zero downtime)

---

## 5. Technical Constraints

### 5.1 Technology Stack (Fixed)
- **Runtime**: Node.js (LTS version)
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Cache/Rate Limiting**: Redis 6+ (cluster mode for production)
- **Containerization**: Docker
- **Cloud Platform**: AWS-ready

### 5.2 Data Format
- **API Responses**: JSON only (no XML, CSV, or other formats)

### 5.3 Authentication Standards
- **Session Authentication**: JWT (JSON Web Tokens)
- **API Authentication**: API Key via HTTP header (`X-API-Key`)

### 5.4 Timeline
- **Target Delivery**: Production-ready in **4 weeks** from kickoff
- **Hard Deadline**: Week 5 for final deployment

### 5.5 Budget
- **No strict budget constraints** (optimize for quality and reliability over cost)

---

## 6. Assumptions & Dependencies

### 6.1 Assumptions
- Public data is already available in a structured format (table/collection)
- AWS infrastructure (VPC, RDS, ElastiCache) is available for deployment
- SSL/TLS certificates will be managed externally (load balancer/CloudFront)
- Email validation is sufficient for registration (no email verification flow in v1)
- Paid tier pricing and payment processing will be handled separately (not in scope)
- Enterprise contracts will be manually managed (admin updates tier limits per customer)

### 6.2 Dependencies
- PostgreSQL database instance (RDS or self-hosted)
- Redis cluster (ElastiCache or self-hosted, cluster mode)
- Docker registry for image storage
- AWS deployment environment (ECS/EC2/Fargate)
- Monitoring/alerting infrastructure (CloudWatch or equivalent)

### 6.3 Out of Scope (Explicitly Excluded)
- Email verification/confirmation flow
- Password reset functionality (deferred to v2)
- OAuth2 integration
- Payment processing/billing system
- Developer dashboard UI (API-only in v1)
- Webhook notifications
- GraphQL API
- Real-time WebSocket endpoints
- Multi-region deployment (single region for v1)

---

## 7. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Redis failure causes rate limit bypass | High | Low | Implement fail-safe mode with in-memory fallback; alert on Redis downtime; cluster mode with replication |
| Database connection pool exhaustion at peak load | High | Medium | Configure max connections; implement connection retry logic; monitor pool usage; load test at 25k req/min |
| API key leakage/exposure | High | Medium | Support key rotation; implement key revocation API; monitor for anomalous usage patterns; educate users on key security |
| Auto-suspension false positives (legitimate burst traffic) | Medium | Medium | Tune burst allowance and violation thresholds; provide admin override; log all suspensions for review |
| DDoS/abuse despite rate limiting | Medium | Medium | Implement IP-based secondary limits; add WAF rules; key blocking mechanism; auto-suspension |
| Data breach via SQL injection | High | Low | Use parameterized queries exclusively; run OWASP security audit; static analysis in CI/CD |
| 99.9% uptime target not met | High | Low | Zero-downtime deployments; circuit breakers; redundant infrastructure; 24/7 monitoring |

---

## 8. Compliance & Legal

### 8.1 Data Privacy
- Public data only (no PII in public-data endpoint)
- Developer account data (email, password hash, API key) must be protected per GDPR/CCPA principles
- IP address anonymization in logs if GDPR applies
- No data sharing with third parties
- 90-day log retention (audit requirement)

### 8.2 SOC2 Readiness
- Audit trail for all API calls and admin actions
- Immutable logs (append-only)
- Access controls (principle of least privilege)
- Security controls documented (password policy, encryption, rate limiting)

### 8.3 Terms of Service
- Developers must agree to ToS during registration (future implementation)
- Rate limit enforcement constitutes service boundaries
- System reserves right to revoke API keys for abuse
- Paid tier and Enterprise tier will require separate contracts

---

## 9. Tier Comparison Matrix

| Feature | Free | Paid (Monthly Subscription) | Enterprise (Custom Contract) |
|---------|------|------------------------------|------------------------------|
| **Rate Limit** | 60 req/min | 600 req/min | Custom (configurable) |
| **Burst Allowance** | 120 req/min for 10s | 1200 req/min for 10s | Custom |
| **Auto-Suspension** | Yes (15 min) | Yes (15 min) | Configurable |
| **Support** | Community (docs) | Email support | Dedicated support + SLA |
| **Usage Analytics** | Last 7 days | Last 90 days | Custom retention |
| **Key Rotation** | Yes | Yes | Yes |
| **Custom Limits** | No | No | Yes (per-key configuration) |
| **SLA** | None | 99.5% | 99.9% or custom |

---

## 10. Approval & Sign-Off

**Engineering Lead**: _[Pending]_  
**Founder**: _[Pending]_  
**Security Review**: _[Pending]_  
**Date**: _[Pending]_

---

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-01 | PM Agent | Initial production-ready BRD |
| 2.0 | 2026-03-01 | PM Agent | Added: Freemium model, updated rate limits, burst 2x, auto-suspension, SOC2 requirements, 99.9% uptime, 20k req/min peak, per-endpoint tracking, API key rotation |

---

**Document Status**: ✅ Ready for Stakeholder Review  
**Next Step**: Architecture Design (Architect Agent)