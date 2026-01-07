# eslint-plugin-enforce-call

> [!NOTE] 
> This plugin was built using AI however everything has been tested and verified manually.

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

Enforces that specific functions are called within callback arguments of designated context functions or within exported named functions. Useful for ensuring security checks like `hasPermission()` or `isAuthenticated()` are present in API handlers, database queries, or other critical operations.

### Options

- `check` (array of strings, optional): Function names to monitor for callback arguments
- `checkFunctions` (array of strings, optional): Exported function names to check directly
- `enforce` (array of strings, required): Function names that must be called within those callbacks/functions  
- `requireAll` (boolean, optional, default: `false`):
  - `false`: At least one enforced function must be called
  - `true`: All enforced functions must be called

At least one of `check` or `checkFunctions` should be provided.

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

### Checking Exported Functions

Use `checkFunctions` to enforce calls within exported named functions (useful for SvelteKit load functions, Next.js API routes, etc.):

```javascript
// eslint.config.js
export default [
  {
    plugins: {
      'enforce-call': enforceCall
    },
    rules: {
      'enforce-call/require-call-in-context': ['error', {
        checkFunctions: ['load'],
        enforce: ['hasPermission']
      }]
    }
  }
]
```

#### Valid ✓

```javascript
// Exported function with enforced call
export const load = () => {
  hasPermission()
}

// Function declaration
export function load() {
  hasPermission()
}

// Async function
export const load = async () => {
  await hasPermission()
}

// Namespace imports work too
import * as permissions from 'permissions'
export const load = () => {
  permissions.hasPermission()
}

// Empty functions are allowed
export const load = () => {}

// Non-exported functions are not checked
const load = () => {
  console.log('not checked')
}
```

#### Invalid ✗

```javascript
// No enforced call
export const load = () => {
  console.log('test')
}

// Missing enforced call
export function load() {
  fetchData()
}
```

### Checking Exported Objects with Functions

When `checkFunctions` matches an exported object, all function properties within that object are checked. This is useful for SvelteKit form actions:

```javascript
// eslint.config.js
export default [
  {
    plugins: {
      'enforce-call': enforceCall
    },
    rules: {
      'enforce-call/require-call-in-context': ['error', {
        checkFunctions: ['actions'],
        enforce: ['hasPermission']
      }]
    }
  }
]
```

#### Valid ✓

```javascript
// All functions in the object have enforced calls
export const actions = {
  default: async (event) => {
    hasPermission()
  },
  create: async () => {
    hasPermission()
  }
}

// Method shorthand syntax works too
export const actions = {
  async default() {
    hasPermission()
  }
}

// Empty functions are allowed
export const actions = {
  default: async () => {}
}

// Namespace imports work
import * as permissions from 'permissions'
export const actions = {
  default: async () => {
    permissions.hasPermission()
  }
}
```

#### Invalid ✗

```javascript
// Missing enforced call
export const actions = {
  default: async (event) => {
    console.log('missing hasPermission')
  }
}

// One function missing enforced call (each is checked independently)
export const actions = {
  create: async () => { hasPermission() },  // OK
  update: async () => { console.log('bad') }  // Error
}
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
- Callback arguments (arrow functions and function expressions) passed to functions in `check`
- Exported functions with names matching `checkFunctions`
- All function properties within exported objects matching `checkFunctions`
- Member expressions like `query.batch` are treated as distinct from `query`

### What Counts as Valid
- Non-empty callbacks/functions that contain at least one direct call to an enforced function (when `requireAll: false`)
- Non-empty callbacks/functions that contain direct calls to all enforced functions (when `requireAll: true`)
- Empty callbacks/functions (no code = no violation)
- Namespace import calls like `permissions.hasPermission()` satisfy an `enforce: ["hasPermission"]` requirement

### What Gets Reported
- Non-empty callbacks/functions without the required enforced function calls
- Only direct calls within the callback/function body count (not nested in helper functions)

## License

MIT
