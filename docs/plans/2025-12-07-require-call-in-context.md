# require-call-in-context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an ESLint plugin that enforces specific function calls within callback arguments of designated context functions.

**Architecture:** AST-based ESLint rule that visits CallExpression nodes, identifies context functions from config, finds function callbacks in arguments, analyzes callback bodies for direct calls to enforced functions, and reports violations with clear messages.

**Tech Stack:** ESLint 9, Vitest 4, ES Modules

---

## Task 1: Setup Project Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Update package.json with ES modules and dependencies**

```json
{
  "name": "eslint-plugin-enforce-call",
  "version": "1.0.0",
  "description": "ESLint plugin to enforce function calls within specific function contexts",
  "type": "module",
  "main": "lib/index.js",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": [
    "eslint",
    "eslintplugin",
    "eslint-plugin",
    "enforce-call"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "eslint": "^9.0.0",
    "vitest": "^4.0.0"
  },
  "peerDependencies": {
    "eslint": ">=9.0.0"
  },
  "engines": {
    "node": ">=24.0.0"
  }
}
```

**Step 2: Install dependencies**

Run: `pnpm install`
Expected: Dependencies installed successfully

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: setup project with vitest 4 and ES modules"
```

---

## Task 2: Create Rule Skeleton with Tests (TDD)

**Files:**
- Create: `tests/rules/require-call-in-context.test.js`
- Create: `lib/rules/require-call-in-context.js`

**Step 1: Write the first failing test (empty config should not crash)**

Create `tests/rules/require-call-in-context.test.js`:

```javascript
import { describe } from 'vitest'
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
    valid: [
      {
        code: 'const x = 1',
        options: [{
          check: ['query'],
          enforce: ['hasPermission']
        }]
      }
    ],
    invalid: []
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with "Cannot find module '../../lib/rules/require-call-in-context.js'"

**Step 3: Create minimal rule skeleton**

Create `lib/rules/require-call-in-context.js`:

```javascript
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce specific function calls within callback arguments of designated context functions',
      category: 'Best Practices',
      recommended: false
    },
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
    }],
    messages: {
      missingAtLeastOne: 'Callback must call at least one of: {{functions}}',
      missingAll: 'Callback must call all of: {{functions}}'
    }
  },
  create(context) {
    return {}
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/rules/require-call-in-context.test.js lib/rules/require-call-in-context.js
git commit -m "test: add initial test skeleton for require-call-in-context rule"
```

---

## Task 3: Implement getCallExpressionName Helper

**Files:**
- Modify: `lib/rules/require-call-in-context.js`

**Step 1: Write failing test for simple function name**

Add to `tests/rules/require-call-in-context.test.js` valid array:

```javascript
{
  code: 'query(() => { hasPermission() })',
  options: [{
    check: ['query'],
    enforce: ['hasPermission']
  }]
}
```

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL (rule doesn't check anything yet)

**Step 3: Implement getCallExpressionName helper**

Add before the `create` function in `lib/rules/require-call-in-context.js`:

```javascript
/**
 * Extract the full name from a CallExpression node
 * @param {Node} node - CallExpression node
 * @returns {string|null} - Full function name or null
 */
function getCallExpressionName(node) {
  if (node.type !== 'CallExpression') {
    return null
  }

  const { callee } = node

  // Simple identifier: query()
  if (callee.type === 'Identifier') {
    return callee.name
  }

  // Member expression: query.batch()
  if (callee.type === 'MemberExpression') {
    const parts = []
    let current = callee

    while (current) {
      if (current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
          parts.unshift(current.property.name)
        }
        current = current.object
      } else if (current.type === 'Identifier') {
        parts.unshift(current.name)
        break
      } else {
        return null
      }
    }

    return parts.join('.')
  }

  return null
}
```

**Step 4: Note - test won't pass yet**

This helper is needed but the rule doesn't use it yet. We'll implement the main logic next.

**Step 5: Commit**

```bash
git add lib/rules/require-call-in-context.js
git commit -m "feat: add getCallExpressionName helper for extracting function names"
```

---

## Task 4: Implement isEmptyCallback Helper

**Files:**
- Modify: `lib/rules/require-call-in-context.js`

**Step 1: Add test for empty callback (should be valid)**

Add to `tests/rules/require-call-in-context.test.js` valid array:

```javascript
{
  code: 'query(() => {})',
  options: [{
    check: ['query'],
    enforce: ['hasPermission']
  }]
}
```

**Step 2: Implement isEmptyCallback helper**

Add after `getCallExpressionName` in `lib/rules/require-call-in-context.js`:

```javascript
/**
 * Check if a callback function is empty
 * @param {Node} node - ArrowFunctionExpression or FunctionExpression
 * @returns {boolean}
 */
function isEmptyCallback(node) {
  // Arrow function with expression body: () => expr
  if (node.type === 'ArrowFunctionExpression' && node.expression) {
    return false
  }

  // Block body: () => {} or function() {}
  if (node.body && node.body.type === 'BlockStatement') {
    return node.body.body.length === 0
  }

  return false
}
```

**Step 3: Commit**

```bash
git add lib/rules/require-call-in-context.js tests/rules/require-call-in-context.test.js
git commit -m "feat: add isEmptyCallback helper to detect empty callback bodies"
```

---

## Task 5: Implement getDirectCalls Helper

**Files:**
- Modify: `lib/rules/require-call-in-context.js`

**Step 1: Implement getDirectCalls helper**

Add after `isEmptyCallback` in `lib/rules/require-call-in-context.js`:

```javascript
/**
 * Get all direct function calls in a callback body
 * @param {Node} node - ArrowFunctionExpression or FunctionExpression
 * @returns {string[]} - Array of function names called directly
 */
function getDirectCalls(node) {
  const calls = []

  // Arrow function with expression body: () => foo()
  if (node.type === 'ArrowFunctionExpression' && node.expression) {
    const name = getCallExpressionName(node.body)
    if (name) {
      calls.push(name)
    }
    return calls
  }

  // Block body: () => { foo(); bar(); }
  if (node.body && node.body.type === 'BlockStatement') {
    for (const statement of node.body.body) {
      // ExpressionStatement containing a CallExpression
      if (statement.type === 'ExpressionStatement' && 
          statement.expression.type === 'CallExpression') {
        const name = getCallExpressionName(statement.expression)
        if (name) {
          calls.push(name)
        }
      }
      
      // VariableDeclaration with CallExpression initializer
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          if (declarator.init && declarator.init.type === 'CallExpression') {
            const name = getCallExpressionName(declarator.init)
            if (name) {
              calls.push(name)
            }
          }
        }
      }

      // ReturnStatement with CallExpression
      if (statement.type === 'ReturnStatement' && 
          statement.argument && 
          statement.argument.type === 'CallExpression') {
        const name = getCallExpressionName(statement.argument)
        if (name) {
          calls.push(name)
        }
      }
    }
  }

  return calls
}
```

**Step 2: Commit**

```bash
git add lib/rules/require-call-in-context.js
git commit -m "feat: add getDirectCalls helper to extract function calls from callback body"
```

---

## Task 6: Implement checkEnforcedCalls Helper

**Files:**
- Modify: `lib/rules/require-call-in-context.js`

**Step 1: Implement checkEnforcedCalls helper**

Add after `getDirectCalls` in `lib/rules/require-call-in-context.js`:

```javascript
/**
 * Check if the required enforced calls are present
 * @param {string[]} calls - Function names called in callback
 * @param {string[]} enforce - Required function names
 * @param {boolean} requireAll - Whether all enforced functions must be called
 * @returns {boolean} - True if requirements are met
 */
function checkEnforcedCalls(calls, enforce, requireAll) {
  if (requireAll) {
    // All enforced functions must be called
    return enforce.every(fn => calls.includes(fn))
  } else {
    // At least one enforced function must be called
    return enforce.some(fn => calls.includes(fn))
  }
}
```

**Step 2: Commit**

```bash
git add lib/rules/require-call-in-context.js
git commit -m "feat: add checkEnforcedCalls helper to validate enforcement rules"
```

---

## Task 7: Implement Main Rule Logic

**Files:**
- Modify: `lib/rules/require-call-in-context.js`

**Step 1: Implement the CallExpression visitor**

Replace the `create` function in `lib/rules/require-call-in-context.js`:

```javascript
create(context) {
  const options = context.options[0] || {}
  const { check = [], enforce = [], requireAll = false } = options

  // Convert to sets for faster lookup
  const checkSet = new Set(check)
  const messageId = requireAll ? 'missingAll' : 'missingAtLeastOne'

  return {
    CallExpression(node) {
      // Get the name of the function being called
      const functionName = getCallExpressionName(node)
      if (!functionName || !checkSet.has(functionName)) {
        return
      }

      // Check all arguments for function callbacks
      for (const arg of node.arguments) {
        // Only check arrow functions and function expressions
        if (arg.type !== 'ArrowFunctionExpression' && 
            arg.type !== 'FunctionExpression') {
          continue
        }

        // Empty callbacks are allowed
        if (isEmptyCallback(arg)) {
          continue
        }

        // Get all direct calls in the callback
        const calls = getDirectCalls(arg)

        // Check if enforced calls are present
        if (!checkEnforcedCalls(calls, enforce, requireAll)) {
          context.report({
            node: arg,
            messageId,
            data: {
              functions: enforce.join(', ')
            }
          })
        }
      }
    }
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/rules/require-call-in-context.js
git commit -m "feat: implement main rule logic for CallExpression visitor"
```

---

## Task 8: Add Comprehensive Valid Test Cases

**Files:**
- Modify: `tests/rules/require-call-in-context.test.js`

**Step 1: Add all valid test cases**

Replace the `valid` array in `tests/rules/require-call-in-context.test.js`:

```javascript
valid: [
  // No context functions called
  {
    code: 'const x = 1',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Empty callback
  {
    code: 'query(() => {})',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Callback with enforced call
  {
    code: 'query(() => { hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Expression-body arrow function
  {
    code: 'query(() => hasPermission())',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Member expression context
  {
    code: 'query.batch(() => { isAuthenticated() })',
    options: [{
      check: ['query.batch'],
      enforce: ['isAuthenticated']
    }]
  },
  
  // Multiple arguments, callback is second
  {
    code: 'query(z.string(), () => { hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Multiple arguments, multiple callbacks
  {
    code: 'command(z.string(), () => { hasPermission() }, () => { isAuthenticated() })',
    options: [{
      check: ['command'],
      enforce: ['hasPermission', 'isAuthenticated']
    }]
  },
  
  // At least one enforced call (has one)
  {
    code: 'query(() => { hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission', 'isAuthenticated'],
      requireAll: false
    }]
  },
  
  // Require all enforced calls (has all)
  {
    code: 'query(() => { hasPermission(); isAuthenticated() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission', 'isAuthenticated'],
      requireAll: true
    }]
  },
  
  // Function expression (not arrow)
  {
    code: 'query(function() { hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Member expression in enforce list
  {
    code: 'query(() => { auth.hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['auth.hasPermission']
    }]
  },
  
  // Non-callback arguments only
  {
    code: 'query(schema, options)',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Multiple statements with enforced call
  {
    code: 'query(() => { const x = 1; hasPermission(); return x })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  },
  
  // Enforced call with arguments
  {
    code: "query(() => { hasPermission('read', 'write') })",
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }]
  }
]
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/rules/require-call-in-context.test.js
git commit -m "test: add comprehensive valid test cases"
```

---

## Task 9: Add Comprehensive Invalid Test Cases

**Files:**
- Modify: `tests/rules/require-call-in-context.test.js`

**Step 1: Add all invalid test cases**

Replace the `invalid` array in `tests/rules/require-call-in-context.test.js`:

```javascript
invalid: [
  // Non-empty callback without enforced call
  {
    code: 'query(() => { console.log("test") })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Callback with wrong function
  {
    code: 'query.batch(() => { foo() })',
    options: [{
      check: ['query.batch'],
      enforce: ['isAuthenticated']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'isAuthenticated' }
    }]
  },
  
  // Code present but no enforced call
  {
    code: 'query(z.string(), () => { const num = 2 + 2 })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Commented out call doesn't count
  {
    code: 'query(() => { // hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Function reference without invocation
  {
    code: 'query(() => { hasPermission })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Function passed as argument
  {
    code: 'query(() => { doSomething(hasPermission) })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Multiple callbacks, one invalid
  {
    code: 'command(() => { hasPermission() }, () => { console.log("bad") })',
    options: [{
      check: ['command'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // requireAll: true but missing one
  {
    code: 'query(() => { hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission', 'isAuthenticated'],
      requireAll: true
    }],
    errors: [{
      messageId: 'missingAll',
      data: { functions: 'hasPermission, isAuthenticated' }
    }]
  },
  
  // requireAll: true but missing all
  {
    code: 'query(() => { console.log("test") })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission', 'isAuthenticated'],
      requireAll: true
    }],
    errors: [{
      messageId: 'missingAll',
      data: { functions: 'hasPermission, isAuthenticated' }
    }]
  },
  
  // Function expression violation
  {
    code: 'query(function() { console.log("bad") })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Member expression mismatch
  {
    code: 'query(() => { this.hasPermission() })',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  },
  
  // Expression-body arrow without enforced call
  {
    code: 'query(() => console.log("test"))',
    options: [{
      check: ['query'],
      enforce: ['hasPermission']
    }],
    errors: [{
      messageId: 'missingAtLeastOne',
      data: { functions: 'hasPermission' }
    }]
  }
]
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/rules/require-call-in-context.test.js
git commit -m "test: add comprehensive invalid test cases"
```

---

## Task 10: Create Plugin Entry Point

**Files:**
- Create: `lib/index.js`

**Step 1: Create plugin entry point**

Create `lib/index.js`:

```javascript
import requireCallInContext from './rules/require-call-in-context.js'

export default {
  rules: {
    'require-call-in-context': requireCallInContext
  }
}
```

**Step 2: Commit**

```bash
git add lib/index.js
git commit -m "feat: create plugin entry point"
```

---

## Task 11: Create README Documentation

**Files:**
- Create: `README.md`

**Step 1: Create comprehensive README**

Create `README.md`:

```markdown
# eslint-plugin-enforce-call

ESLint plugin to enforce specific function calls within callback arguments of designated context functions.

## Installation

```bash
pnpm add -D eslint-plugin-enforce-call
```

## Usage

### ESLint Flat Config (ESLint 9+)

```javascript
import enforceCall from 'eslint-plugin-enforce-call'

export default [
  {
    plugins: {
      'enforce-call': enforceCall
    },
    rules: {
      'enforce-call/require-call-in-context': ['error', {
        check: ['query', 'query.batch', 'command'],
        enforce: ['hasPermission', 'isAuthenticated'],
        requireAll: false
      }]
    }
  }
]
```

## Rule: require-call-in-context

Enforces that specific functions are called within callback arguments of designated context functions. Useful for ensuring security checks like `hasPermission()` or `isAuthenticated()` are present in API handlers, database queries, or other critical operations.

### Options

- `check` (array of strings, required): Function names to monitor for callback arguments
- `enforce` (array of strings, required): Function names that must be called within those callbacks  
- `requireAll` (boolean, optional, default: `false`):
  - `false`: At least one enforced function must be called
  - `true`: All enforced functions must be called

### Examples

#### Valid ✓

```javascript
// Callback with enforced call
query(() => {
  hasPermission()
})

// Member expression context
query.batch(() => {
  isAuthenticated()
})

// Multiple arguments
query(z.string(), () => {
  hasPermission('read')
})

// Empty callbacks are allowed
query(() => {})

// Expression-body arrow function
query(() => hasPermission())
```

#### Invalid ✗

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
```

### Multiple Rule Instances

You can configure multiple instances of the rule for different requirements:

```javascript
export default [
  {
    plugins: {
      'enforce-call': enforceCall
    },
    rules: {
      // Basic queries need at least one auth check
      'enforce-call/require-call-in-context': ['error', {
        check: ['query', 'query.batch'],
        enforce: ['hasPermission', 'isAuthenticated'],
        requireAll: false
      }]
    }
  },
  {
    files: ['src/admin/**/*.js'],
    rules: {
      // Admin commands need both checks
      'enforce-call/require-call-in-context': ['error', {
        check: ['adminCommand'],
        enforce: ['hasPermission', 'isAuthenticated'],
        requireAll: true
      }]
    }
  }
]
```

## Behavior

### What Gets Checked
- All function arguments for callbacks (arrow functions and function expressions)
- Member expressions like `query.batch` are treated as distinct from `query`

### What Counts as Valid
- Non-empty callbacks that contain at least one direct call to an enforced function (when `requireAll: false`)
- Non-empty callbacks that contain direct calls to all enforced functions (when `requireAll: true`)
- Empty callbacks (no code = no violation)

### What Gets Reported
- Non-empty callbacks without the required enforced function calls
- Only direct calls within the callback body count (not nested in helper functions)

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: create comprehensive README with usage examples"
```

---

## Task 12: Run Final Verification

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 2: Verify file structure**

Run: `find lib tests -type f -name "*.js" | sort`
Expected:
```
lib/index.js
lib/rules/require-call-in-context.js
tests/rules/require-call-in-context.test.js
```

**Step 3: Check git status**

Run: `git status`
Expected: Working tree clean

**Step 4: Final commit if needed**

If any files are untracked or modified, review and commit them.

---

## Verification Checklist

- [ ] All tests pass
- [ ] Plugin exports rule correctly
- [ ] Rule handles all edge cases from design
- [ ] Documentation is complete
- [ ] All code is committed

## Skills Referenced

- @superpowers:test-driven-development - Write tests first, watch them fail, implement minimal code
- @superpowers:verification-before-completion - Run tests and verify output before claiming complete
- @elements-of-style:writing-clearly-and-concisely - Applied to README documentation
