# Test Execution Guide

## Unit Tests
```bash
npm run test        # Run Vitest in watch mode
npm run test:coverage  # Run with coverage report
```

## E2E Tests
```bash
# First install Playwright test runner
npm install -D @playwright/test

# Then run tests
npm run test:e2e         # Run all E2E specs
npm run test:e2e:report  # Run with HTML report
```

## Performance Benchmarks
```bash
npm run benchmark        # Quick benchmark (no build)
npm run benchmark:build  # Full benchmark after build
```

## Current Test Status
- **Engine Unit Tests:** 10 suites, 40+ tests ✅
- **Component Tests:** 2 suites (first-run, provider) ✅
- **E2E Tests:** 3 specs configured (requires @playwright/test install)
- **Coverage:** Run `npm run test:coverage` for full report
