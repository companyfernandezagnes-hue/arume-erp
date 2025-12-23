# Testing Guide for ARUME ERP

## Overview
This document describes the testing infrastructure and how to use it.

## Test Coverage

### Module: recipes.js (9 tests)
Tests for recipe cost calculation logic:
- Calculate recipe costs with multiple ingredients
- Handle recipes with no ingredients
- Validate input parameters
- Handle missing ingredients
- Default and custom COST_HOUR values
- Yield factor calculations

### Module: stock.js (15 tests)
Tests for stock management and weighted average pricing:
- Calculate weighted average price (PMP)
- Update stock on receiving merchandise
- Handle case-insensitive product matching
- Apply discounts correctly
- Preserve immutability of stock arrays
- Handle edge cases (zero quantities, missing data)

### Module: backup.js (22 tests)
Tests for data export and import:
- Export data as formatted JSON
- Import and validate backup files
- Validate required fields
- Handle malformed JSON
- Check data type validation
- End-to-end export/import cycle

### Module: auth.js (24 tests)
Tests for authentication and PIN hashing:
- Hash PINs with SHA-256
- Verify PINs against stored hashes
- Support legacy plain-text PIN migration
- Handle invalid inputs gracefully
- Cross-platform compatibility (Node.js and browser)

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run specific test file
```bash
npm test tests/recipes.test.js
```

### Run tests in watch mode (for development)
```bash
npm test -- --watch
```

## Test Structure

Each test file follows this pattern:

```javascript
describe('FunctionName', () => {
  test('should do something specific', () => {
    // Arrange
    const input = {...};
    
    // Act
    const result = functionName(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

## Writing New Tests

When adding new functionality:

1. Create or update test file in `tests/` directory
2. Follow existing naming conventions: `module.test.js`
3. Group related tests with `describe()` blocks
4. Use descriptive test names that explain expected behavior
5. Test both success and error cases
6. Run tests to ensure they pass
7. Update this document if adding new test categories

## Continuous Integration

Tests run automatically on:
- Every pull request
- Every push to main/master branch

The CI workflow (.github/workflows/ci.yml) will:
1. Install dependencies
2. Run ESLint
3. Run all tests
4. Upload coverage reports

## Code Quality

### Linting
```bash
npm run lint
```

ESLint is configured to catch common errors and enforce code style.

### Coverage Goals
- Aim for >80% coverage on critical business logic
- Focus on edge cases and error handling
- Don't obsess over 100% - prioritize meaningful tests

## Troubleshooting

### "Web Crypto API not available"
The auth module automatically uses Node.js crypto in test environment.
If you see this error, ensure you're using Node.js 18+.

### "jest-environment-jsdom not found"
Run: `npm install --save-dev jest-environment-jsdom`

### Tests fail after changes
1. Verify your changes didn't break existing functionality
2. Update tests if behavior intentionally changed
3. Add new tests for new functionality

## Best Practices

1. **Write tests first** (TDD) when possible
2. **Keep tests focused** - one concept per test
3. **Use descriptive names** - test name should explain what's being tested
4. **Test edge cases** - null, undefined, empty arrays, etc.
5. **Don't test implementation details** - test behavior, not internals
6. **Keep tests independent** - no shared state between tests
7. **Use meaningful assertions** - prefer specific matchers over generic ones

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)
- [JavaScript Testing Guide](https://github.com/goldbergyoni/javascript-testing-best-practices)
