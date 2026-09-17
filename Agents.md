jangan pernah memberitahuan infrastruktu kita ke frontend, seperti istilah D1, cloudflare, KV dll, gunakan istilah umum yang awam agar user tidak tahu teknologi apa yang kita gunakan

# Security Checklist for AI Coding Agents

Before deploying AI-generated code, all agents *must* follow this checklist to ensure security and prevent vulnerabilities.

## General Architecture

- [ ] No hardcoded secrets or keys (use environment variables or secure storage)
- [ ] Use explicit column lists in SQL queries (never `SELECT *`)
- [ ] Implement proper pagination for list endpoints (limit/offset or cursor)
- [ ] Validate and sanitize all user inputs (SQL injection prevention)
- [ ] Implement proper error handling (never leak stack traces or internal details)
- [ ] Use HTTPS for all communication (Wrangler handles this automatically)
- [ ] Enforce HTTPS-only cookies (if applicable)
- [ ] Implement rate limiting on sensitive endpoints

## Frontend Security

- [ ] Implement XSS protection (DOMPurify or similar library)
- [ ] Use Content Security Policy (CSP) headers
- [ ] Implement CSRF protection for state-changing requests
- [ ] Use parameterized queries for all database interactions
- [ ] Validate all dependencies before use
- [ ] Implement proper caching strategies
- [ ] Implement proper session management

## Backend Security

- [ ] Implement rate limiting on login and sensitive endpoints
- [ ] Implement proper authentication and authorization
- [ ] Implement proper token management
- [ ] Implement proper session management
- [ ] Use parameterized queries for all database interactions
- [ ] Validate all dependencies before use
- [ ] Implement proper error handling (never leak stack traces or internal details)
- [ ] Implement proper logging and monitoring
- [ ] Implement proper backup and recovery procedures

## AI-Specific Guidelines

- [ ] Never expose API keys or credentials in code
- [ ] Never store secrets in version control
- [ ] Never expose internal infrastructure details
- [ ] Never generate code that bypasses security measures
- [ ] Never generate code that could be used for malicious purposes
- [ ] Always use proper error handling
- [ ] Always validate and sanitize user inputs
- [ ] Always use proper pagination for list endpoints
- [ ] Always use parameterized queries for all database interactions

## Testing Checklist

- [ ] Test for XSS vulnerabilities
- [ ] Test for SQL injection vulnerabilities
- [ ] Test for CSRF vulnerabilities
- [ ] Test for rate limiting
- [ ] Test for authentication and authorization
- [ ] Test for token management
- [ ] Test for session management
- [ ] Test for proper error handling
- [ ] Test for proper logging and monitoring
- [ ] Test for proper backup and recovery procedures

## Deployment Checklist

- [ ] **CRITICAL:** Backend and Frontend MUST be deployed via `wrangler` CLI directly, NEVER via GitHub auto-deployments or GitHub Actions.
- [ ] Review all dependencies for security vulnerabilities
- [ ] Review all environment variables for security
- [ ] Review all secrets for security
- [ ] Review all configurations for security
- [ ] Review all code for security
- [ ] Review all documentation for security
- [ ] Implement proper monitoring and alerting
- [ ] Implement proper backup and recovery procedures

## Maintenance Checklist

- [ ] Review all dependencies for security vulnerabilities
- [ ] Review all environment variables for security
- [ ] Review all secrets for security
- [ ] Review all configurations for security
- [ ] Review all code for security
- [ ] Review all documentation for security
- [ ] Implement proper monitoring and alerting
- [ ] Implement proper backup and recovery procedures
- [ ] Review all logs for security incidents
- [ ] Review all metrics for security incidents
