# ESLint Plugin: enforce-call Design Document

**Date:** 2025-12-07  
**Status:** Approved

## Overview

An ESLint plugin that enforces specific function calls within callback arguments of designated context functions. This is useful for ensuring security checks (like `hasPermission()` or `isAuthenticated()`) are present in API handlers, database queries, or other critical operations.

## Rule: require-call-in-context

### Configuration

**Rule Name:** `require-call-in-context`

**Schema:**
```javascript
{
  "rules": {
    "enforce-call/require-call-in-context": ["error", {
      "check": ["query", "query.batch", "form", "command"],
      "enforce": ["hasPermission", "isAuthenticated"],
      "requireAll": false  // optional, defaults to false
    }]
  }
}
```

**Options:**
- `check` (array of strings, required): Function names to monitor for callback arguments
- `enforce` (array of strings, required): Function names that must be called within those callbacks
- `requireAll` (boolean, optional, default: `false`): 
  - `false`: At least one enforced function must be called
  - `true`: All enforced functions must be called

### Behavior

**What Gets Checked:**
- All function arguments for callbacks (arrow functions and function expressions)
- Both `ArrowFunctionExpression` and `FunctionExpression` nodes
- Member expressions like `query.batch` are treated as distinct from `query`

**What Counts as Valid:**
- Non-empty callbacks that contain at least one direct call to an enforced function (when `requireAll: false`)
- Non-empty callbacks that contain direct calls to all enforced functions (when `requireAll: true`)
- Empty callbacks (no code = no violation)

**What Gets Reported:**
- Non-empty callbacks without the required enforced function calls
- Only direct calls within the callback body count (not nested in helper functions)

### Examples

**Valid:**
```javascript
// At least one enforced call present
query(() => {
  hasPermission()
})

query.batch(() => {
  isAuthenticated()
})

// Works with multiple arguments
query(z.string(), () => {
  isAuthenticated()
})

command(z.string(), () => {
  hasPermission('read')
})

// Empty callbacks are allowed
query(() => {})

// Expression-body arrow functions
query(() => hasPermission())
```

**Invalid:**
```javascript
// No enforced call
query(() => {
  console.log('test')
})

// Wrong function called
query.batch(() => {
  foo()
})

// Code present but no enforced call
query(z.string(), () => {
  const num = 2 + 2
})

// Commented out doesn't count
query(() => {
  // hasPermission()
})

// Function reference without invocation
query(() => {
  hasPermission
})

// Function passed as argument
query(() => {
  doSomething(hasPermission)
})
```

## Implementation Strategy

### AST Traversal Algorithm

1. **Identify context function calls**
   - Visit all `CallExpression` nodes
   - Check if callee matches any name in the `check` array
   - For simple calls: check `node.callee.name`
   - For member expressions: build full path (e.g., `"query.batch"`)

2. **Find callback arguments**
   - Iterate through all arguments of matching calls
   - Look for `ArrowFunctionExpression` and `FunctionExpression`

3. **Analyze callback body**
   - Skip if body is empty
   - Traverse immediate statements/expressions in callback body
   - Collect all direct function calls (CallExpression nodes)

4. **Validate enforced calls**
   - `requireAll: false` → At least one enforced function was called
   - `requireAll: true` → All enforced functions were called

5. **Report violations**
   - Report error on callback node with descriptive message

### Helper Functions

- `getCallExpressionName(node)` - Extract function name from CallExpression (handles simple and member expressions)
- `isEmptyCallback(node)` - Check if callback has no body
- `getDirectCalls(node)` - Extract all direct function calls from callback body
- `checkEnforcedCalls(calls, enforced, requireAll)` - Validate the enforcement rule

### Error Messages

```javascript
// When requireAll is false
`Callback must call at least one of: ${enforce.join(', ')}`

// When requireAll is true
`Callback must call all of: ${enforce.join(', ')}`
```

## Edge Cases

1. **No arguments** - `query()` → no violation
2. **Non-function arguments** - `query(42, "string")` → no violation
3. **Mixed arguments** - `query(z.string(), () => {}, another)` → check all callbacks independently
4. **Expression-body arrows** - `query(() => hasPermission())` → counts as valid
5. **Block with only comments** - `query(() => { /* TODO */ })` → treated as empty
6. **IIFE arguments** - `query((() => { hasPermission() })())` → check IIFE body
7. **Async functions** - `query(async () => { await hasPermission() })` → treat same as regular
8. **Enforced function called as member** - `this.hasPermission()` does NOT match `hasPermission`
9. **Enforced function with member** - `auth.hasPermission()` matches `auth.hasPermission` in enforce list

## File Structure

```
eslint-plugin-enforce-call/
├── lib/
│   ├── index.js                              # Plugin entry point
│   └── rules/
│       └── require-call-in-context.js        # Rule implementation
├── tests/
│   └── rules/
│       └── require-call-in-context.test.js   # Rule tests
├── docs/
│   └── plans/
│       └── 2025-12-07-enforce-call-plugin-design.md
├── package.json
└── README.md
```

### lib/index.js

```javascript
export default {
  rules: {
    'require-call-in-context': require('./rules/require-call-in-context')
  }
}
```

### lib/rules/require-call-in-context.js

Export object with:
- `meta`: Rule metadata (type, docs, schema, messages)
- `create`: Function returning AST visitor object

**Schema:**
```javascript
schema: [{
  type: 'object',
  properties: {
    check: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1
    },
    enforce: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1
    },
    requireAll: {
      type: 'boolean',
      default: false
    }
  },
  required: ['check', 'enforce'],
  additionalProperties: false
}]
```

**Visitor:**
- `CallExpression(node)` - Main entry point

## Testing Strategy

### Framework

Vitest 4 with ESLint's RuleTester

### Test Categories

**Valid Cases:**
- Empty callbacks
- Callbacks with enforced calls
- Multiple enforced calls when `requireAll: true`
- Expression-body arrows
- Mixed arguments with valid callbacks
- Non-callback arguments only
- Member expression contexts
- Both arrow and function expressions

**Invalid Cases:**
- Non-empty callback without enforced calls
- Callback with wrong function calls
- Missing enforced calls when `requireAll: true`
- Nested calls (don't count)
- Multiple callbacks with some invalid
- Commented out calls
- Function reference without invocation
- Function passed as argument

**Configuration Variations:**
- Single check/enforce
- Multiple check/enforce
- `requireAll: false` (default)
- `requireAll: true`
- Member expressions in check array
- Member expressions in enforce array

### Test File Structure

```javascript
import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import rule from '../../lib/rules/require-call-in-context.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module'
  }
})

describe('require-call-in-context', () => {
  ruleTester.run('require-call-in-context', rule, {
    valid: [/* test cases */],
    invalid: [/* test cases */]
  })
})
```

## Documentation

### README.md Sections

1. **Installation**
2. **Configuration Example** (ESLint 9 flat config)
3. **Usage Examples** (good vs bad code)
4. **Options Documentation**
5. **Common Patterns** (multiple rule instances)

### package.json

```json
{
  "name": "eslint-plugin-enforce-call",
  "version": "1.0.0",
  "type": "module",
  "main": "lib/index.js",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "vitest": "^4.0.0"
  },
  "peerDependencies": {
    "eslint": ">=9.0.0"
  }
}
```

## Success Criteria

- All test cases pass
- Plugin correctly identifies violations in real-world code
- Clear error messages guide developers to fixes
- Performance is acceptable for large codebases
- Documentation is clear and complete
