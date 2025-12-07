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
