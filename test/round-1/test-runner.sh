#!/bin/bash

# Comprehensive Test Runner for Rate-Limited API Service
# Round 1 Testing - Systematic verification of all FSD requirements

set -e

API_BASE="http://localhost:3000/api/v1"
HEALTH_URL="http://localhost:3000/health/health"
TEST_RESULTS_FILE="/Users/accuser/.openclaw/workspace/projects/proj-1772344501/test/round-1/test-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Initialize results array
echo "[]" > "$TEST_RESULTS_FILE"

# Function to log test result
log_test() {
    local test_id="$1"
    local test_name="$2"
    local status="$3"
    local details="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ [$test_id] $test_name${NC}"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ [$test_id] $test_name${NC}"
        echo -e "  ${YELLOW}Details: $details${NC}"
    fi
    
    # Append to JSON results
    local result=$(jq -n \
        --arg id "$test_id" \
        --arg name "$test_name" \
        --arg status "$status" \
        --arg details "$details" \
        '{test_id: $id, test_name: $name, status: $status, details: $details, timestamp: now | todate}')
    
    jq ". += [$result]" "$TEST_RESULTS_FILE" > "$TEST_RESULTS_FILE.tmp" && mv "$TEST_RESULTS_FILE.tmp" "$TEST_RESULTS_FILE"
}

# Generate unique email
generate_email() {
    echo "test_$(date +%s)_${RANDOM}@example.com"
}

echo "========================================="
echo "Rate-Limited API Service - Test Round 1"
echo "========================================="
echo ""

# Test FR-001: User Registration
echo "Testing FR-001: User Registration"
echo "-----------------------------------"

# Test 1.1: Successful registration
TEST_EMAIL=$(generate_email)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"SecurePass123!\",\"name\":\"Test User\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
    if echo "$BODY" | jq -e '.user.id and .user.apiKey and .user.tier' > /dev/null 2>&1; then
        log_test "FR-001.1" "Register new user with valid data" "PASS" "User registered successfully with API key"
        # Save credentials for later tests
        TEST_USER_EMAIL="$TEST_EMAIL"
        TEST_USER_PASSWORD="SecurePass123!"
        TEST_USER_API_KEY=$(echo "$BODY" | jq -r '.user.apiKey')
        TEST_USER_JWT=$(echo "$BODY" | jq -r '.token')
    else
        log_test "FR-001.1" "Register new user with valid data" "FAIL" "Response missing required fields: $BODY"
    fi
else
    log_test "FR-001.1" "Register new user with valid data" "FAIL" "Expected 201, got $HTTP_CODE. Response: $BODY"
fi

# Test 1.2: Registration with weak password
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$(generate_email)\",\"password\":\"weak\",\"name\":\"Test User\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
    log_test "FR-001.2" "Reject registration with weak password" "PASS" "Weak password rejected with 400"
else
    log_test "FR-001.2" "Reject registration with weak password" "FAIL" "Expected 400, got $HTTP_CODE"
fi

# Test 1.3: Registration with duplicate email
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"SecurePass123!\",\"name\":\"Duplicate User\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "409" ]; then
    if echo "$BODY" | jq -e '.message' | grep -qi "already"; then
        log_test "FR-001.3" "Reject duplicate email registration" "PASS" "Duplicate email rejected with 409"
    else
        log_test "FR-001.3" "Reject duplicate email registration" "FAIL" "Expected 'already registered' message, got: $BODY"
    fi
else
    log_test "FR-001.3" "Reject duplicate email registration" "FAIL" "Expected 409, got $HTTP_CODE"
fi

echo ""
echo "Testing FR-002: User Authentication"
echo "------------------------------------"

# Test 2.1: Login with valid credentials
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | jq -e '.token and .expiresIn and .user.id' > /dev/null 2>&1; then
        log_test "FR-002.1" "Login with valid credentials" "PASS" "JWT token received"
        TEST_USER_JWT=$(echo "$BODY" | jq -r '.token')
    else
        log_test "FR-002.1" "Login with valid credentials" "FAIL" "Response missing JWT or user data"
    fi
else
    log_test "FR-002.1" "Login with valid credentials" "FAIL" "Expected 200, got $HTTP_CODE"
fi

# Test 2.2: Login with invalid password
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"WrongPassword123!\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "401" ]; then
    log_test "FR-002.2" "Reject login with invalid password" "PASS" "Invalid password rejected with 401"
else
    log_test "FR-002.2" "Reject login with invalid password" "FAIL" "Expected 401, got $HTTP_CODE"
fi

# Test 2.3: Login with non-existent email
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"nonexistent@example.com\",\"password\":\"SomePassword123!\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "401" ]; then
    log_test "FR-002.3" "Reject login with non-existent email" "PASS" "Non-existent email rejected with 401"
else
    log_test "FR-002.3" "Reject login with non-existent email" "FAIL" "Expected 401, got $HTTP_CODE"
fi

echo ""
echo "Testing FR-003: API Key Management"
echo "-----------------------------------"

# Test 3.1: Get user profile
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/profile" \
    -H "Authorization: Bearer $TEST_USER_JWT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | jq -e '.email and .apiKey and .tier' > /dev/null 2>&1; then
        API_KEY_MASKED=$(echo "$BODY" | jq -r '.apiKey')
        if [[ "$API_KEY_MASKED" == *"****"* ]]; then
            log_test "FR-003.1" "Get user profile with masked API key" "PASS" "Profile retrieved with masked API key: $API_KEY_MASKED"
        else
            log_test "FR-003.1" "Get user profile with masked API key" "FAIL" "API key not properly masked: $API_KEY_MASKED"
        fi
    else
        log_test "FR-003.1" "Get user profile with masked API key" "FAIL" "Profile missing required fields"
    fi
else
    log_test "FR-003.1" "Get user profile with masked API key" "FAIL" "Expected 200, got $HTTP_CODE"
fi

# Test 3.2: Rotate API key
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/profile/rotate-key" \
    -H "Authorization: Bearer $TEST_USER_JWT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    NEW_API_KEY=$(echo "$BODY" | jq -r '.apiKey')
    if [ "$NEW_API_KEY" != "$TEST_USER_API_KEY" ] && [[ "$NEW_API_KEY" == ak_live_* ]]; then
        log_test "FR-003.2" "Rotate API key successfully" "PASS" "New API key received: ${NEW_API_KEY:0:20}..."
        # Test old key is invalidated
        OLD_KEY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/public-data" \
            -H "X-API-Key: $TEST_USER_API_KEY")
        OLD_KEY_HTTP=$(echo "$OLD_KEY_RESPONSE" | tail -n 1)
        
        if [ "$OLD_KEY_HTTP" = "401" ] || [ "$OLD_KEY_HTTP" = "403" ]; then
            log_test "FR-003.2a" "Old API key invalidated after rotation" "PASS" "Old key rejected with $OLD_KEY_HTTP"
        else
            log_test "FR-003.2a" "Old API key invalidated after rotation" "FAIL" "Old key still works: $OLD_KEY_HTTP"
        fi
        
        # Update for future tests
        TEST_USER_API_KEY="$NEW_API_KEY"
    else
        log_test "FR-003.2" "Rotate API key successfully" "FAIL" "Invalid new API key: $NEW_API_KEY"
    fi
else
    log_test "FR-003.2" "Rotate API key successfully" "FAIL" "Expected 200, got $HTTP_CODE"
fi

echo ""
echo "Testing FR-004: Public Data Access"
echo "-----------------------------------"

# Test 4.1: Access data with valid API key
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/public-data?page=1&limit=10" \
    -H "X-API-Key: $TEST_USER_API_KEY")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | jq -e '.data and .pagination' > /dev/null 2>&1; then
        PAGE=$(echo "$BODY" | jq -r '.pagination.page')
        LIMIT=$(echo "$BODY" | jq -r '.pagination.limit')
        if [ "$PAGE" = "1" ] && [ "$LIMIT" = "10" ]; then
            log_test "FR-004.1" "Access public data with valid API key" "PASS" "Data retrieved with correct pagination"
        else
            log_test "FR-004.1" "Access public data with valid API key" "FAIL" "Incorrect pagination: page=$PAGE, limit=$LIMIT"
        fi
    else
        log_test "FR-004.1" "Access public data with valid API key" "FAIL" "Response missing data or pagination"
    fi
else
    log_test "FR-004.1" "Access public data with valid API key" "FAIL" "Expected 200, got $HTTP_CODE"
fi

# Test 4.2: Reject request without API key
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/public-data")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "401" ]; then
    log_test "FR-004.2" "Reject request without API key" "PASS" "Request rejected with 401"
else
    log_test "FR-004.2" "Reject request without API key" "FAIL" "Expected 401, got $HTTP_CODE"
fi

# Test 4.3: Validate pagination parameters
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/public-data?page=-1&limit=1000" \
    -H "X-API-Key: $TEST_USER_API_KEY")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "400" ]; then
    log_test "FR-004.3" "Reject invalid pagination parameters" "PASS" "Invalid pagination rejected with 400"
else
    log_test "FR-004.3" "Reject invalid pagination parameters" "FAIL" "Expected 400, got $HTTP_CODE"
fi

echo ""
echo "Testing FR-005: Rate Limiting (Free Tier)"
echo "------------------------------------------"

# Test 5.1: Check rate limit headers
RESPONSE=$(curl -s -i -X GET "$API_BASE/public-data?page=1&limit=1" \
    -H "X-API-Key: $TEST_USER_API_KEY")

if echo "$RESPONSE" | grep -i "X-RateLimit-Limit" > /dev/null; then
    LIMIT_HEADER=$(echo "$RESPONSE" | grep -i "X-RateLimit-Limit" | cut -d: -f2 | tr -d ' \r')
    REMAINING_HEADER=$(echo "$RESPONSE" | grep -i "X-RateLimit-Remaining" | cut -d: -f2 | tr -d ' \r')
    RESET_HEADER=$(echo "$RESPONSE" | grep -i "X-RateLimit-Reset" | cut -d: -f2 | tr -d ' \r')
    
    if [ "$LIMIT_HEADER" = "60" ]; then
        log_test "FR-005.1" "Rate limit headers present (free tier)" "PASS" "Headers: Limit=$LIMIT_HEADER, Remaining=$REMAINING_HEADER, Reset=$RESET_HEADER"
    else
        log_test "FR-005.1" "Rate limit headers present (free tier)" "FAIL" "Expected limit=60, got $LIMIT_HEADER"
    fi
else
    log_test "FR-005.1" "Rate limit headers present (free tier)" "FAIL" "Rate limit headers missing"
fi

# Test 5.2: Exhaust rate limit
echo "  Making 61 requests to test rate limiting..."
SUCCESS_COUNT=0
RATE_LIMITED=false

for i in {1..61}; do
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/public-data?page=1&limit=1" \
        -H "X-API-Key: $TEST_USER_API_KEY")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif [ "$HTTP_CODE" = "429" ]; then
        RATE_LIMITED=true
        BODY=$(echo "$RESPONSE" | sed '$d')
        log_test "FR-005.2" "Rate limit enforced after 60 requests/minute" "PASS" "Got 429 after $SUCCESS_COUNT successful requests"
        break
    fi
done

if [ "$RATE_LIMITED" = false ]; then
    log_test "FR-005.2" "Rate limit enforced after 60 requests/minute" "FAIL" "Made 61 requests without hitting rate limit"
fi

echo ""
echo "Testing FR-009: Usage Logging"
echo "------------------------------"

# Test 9.1: Verify requests are logged
# This would require admin access to check logs - marking as manual test
log_test "FR-009.1" "Verify all requests are logged" "MANUAL" "Requires database query or admin endpoint check"

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review details above.${NC}"
    exit 1
fi
