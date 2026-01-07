import { RuleTester } from "eslint";
import rule from "../../lib/rules/require-call-in-context.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

ruleTester.run("require-call-in-context", rule, {
  valid: [
    // No context functions called
    {
      code: "const x = 1",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Empty callback
    {
      code: "query(() => {})",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Callback with enforced call
    {
      code: "query(() => { hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Expression-body arrow function
    {
      code: "query(() => hasPermission())",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Member expression context
    {
      code: "query.batch(() => { isAuthenticated() })",
      options: [
        {
          check: ["query.batch"],
          enforce: ["isAuthenticated"],
        },
      ],
    },

    // Multiple arguments, callback is second
    {
      code: "query(z.string(), () => { hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Multiple arguments, multiple callbacks
    {
      code: "command(z.string(), () => { hasPermission() }, () => { isAuthenticated() })",
      options: [
        {
          check: ["command"],
          enforce: ["hasPermission", "isAuthenticated"],
        },
      ],
    },

    // At least one enforced call (has one)
    {
      code: "query(() => { hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: false,
        },
      ],
    },

    // Require all enforced calls (has all)
    {
      code: "query(() => { hasPermission(); isAuthenticated() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },

    // Function expression (not arrow)
    {
      code: "query(function() { hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Member expression in enforce list
    {
      code: "query(() => { auth.hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["auth.hasPermission"],
        },
      ],
    },

    // Non-callback arguments only
    {
      code: "query(schema, options)",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Multiple statements with enforced call
    {
      code: "query(() => { const x = 1; hasPermission(); return x })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Enforced call with arguments
    {
      code: "query(() => { hasPermission('read', 'write') })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Await expression in expression-body arrow function
    {
      code: "query(async () => await hasPermission())",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Await expression in block body
    {
      code: "query(async () => { await hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Await with variable declaration
    {
      code: "query(async () => { const result = await hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Await with return statement
    {
      code: "query(async () => { return await hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Await with member expression
    {
      code: "query(async () => { await auth.hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["auth.hasPermission"],
        },
      ],
    },

    // Multiple await statements with all enforced calls
    {
      code: "query(async () => { await hasPermission(); await isAuthenticated() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },

    // Mixed await and non-await calls
    {
      code: "query(async () => { await hasPermission(); isAuthenticated() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },
  ],
  invalid: [
    // Non-empty callback without enforced call
    {
      code: 'query(() => { console.log("test") })',
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Callback with wrong function
    {
      code: "query.batch(() => { foo() })",
      options: [
        {
          check: ["query.batch"],
          enforce: ["isAuthenticated"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "isAuthenticated" },
        },
      ],
    },

    // Code present but no enforced call
    {
      code: "query(z.string(), () => { const num = 2 + 2 })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Commented out call doesn't count
    {
      code: "query(() => { const x = 1 })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Function reference without invocation
    {
      code: "query(() => { hasPermission })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Function passed as argument
    {
      code: "query(() => { doSomething(hasPermission) })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Multiple callbacks, one invalid
    {
      code: 'command(() => { hasPermission() }, () => { console.log("bad") })',
      options: [
        {
          check: ["command"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // requireAll: true but missing one
    {
      code: "query(() => { hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
      errors: [
        {
          messageId: "missingAll",
          data: { functions: "hasPermission, isAuthenticated" },
        },
      ],
    },

    // requireAll: true but missing all
    {
      code: 'query(() => { console.log("test") })',
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
      errors: [
        {
          messageId: "missingAll",
          data: { functions: "hasPermission, isAuthenticated" },
        },
      ],
    },

    // Function expression violation
    {
      code: 'query(function() { console.log("bad") })',
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Member expression mismatch
    {
      code: "query(() => { this.hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Expression-body arrow without enforced call
    {
      code: 'query(() => console.log("test"))',
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Await expression with wrong function
    {
      code: "query(async () => await wrongFunction())",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Await in block without enforced call
    {
      code: 'query(async () => { await console.log("test") })',
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Await with variable declaration but wrong function
    {
      code: "query(async () => { const x = await otherFunc() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Await with requireAll but missing one
    {
      code: "query(async () => { await hasPermission() })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
      errors: [
        {
          messageId: "missingAll",
          data: { functions: "hasPermission, isAuthenticated" },
        },
      ],
    },

    // Await reference without invocation
    {
      code: "query(async () => { await hasPermission })",
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },
  ],
});

// Tests for namespace imports (import * as)
const namespaceImportTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

namespaceImportTester.run("require-call-in-context (namespace imports)", rule, {
  valid: [
    // Namespace import with enforced call via member expression
    {
      code: `
        import * as permissions from 'permissions';
        query(() => { permissions.hasPermission() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Namespace import with await
    {
      code: `
        import * as permissions from 'permissions';
        query(async () => { await permissions.hasPermission() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Namespace import in expression-body arrow
    {
      code: `
        import * as permissions from 'permissions';
        query(() => permissions.hasPermission())
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Multiple namespace imports with requireAll
    {
      code: `
        import * as permissions from 'permissions';
        import * as auth from 'auth';
        query(() => { permissions.hasPermission(); auth.isAuthenticated() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },

    // Mixed direct call and namespace import call
    {
      code: `
        import * as permissions from 'permissions';
        query(() => { hasPermission(); permissions.isAuthenticated() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },

    // Deeply nested member expression should still work for direct match
    {
      code: `
        query(() => { permissions.sub.hasPermission() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["permissions.sub.hasPermission"],
        },
      ],
    },
  ],
  invalid: [
    // Namespace import but wrong function called
    {
      code: `
        import * as permissions from 'permissions';
        query(() => { permissions.wrongFunction() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Namespace import with requireAll but missing one
    {
      code: `
        import * as permissions from 'permissions';
        query(() => { permissions.hasPermission() })
      `,
      options: [
        {
          check: ["query"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
      errors: [
        {
          messageId: "missingAll",
          data: { functions: "hasPermission, isAuthenticated" },
        },
      ],
    },
  ],
});

// Tests for enforcing calls on named functions (e.g., load)
const namedFunctionTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

namedFunctionTester.run("require-call-in-context (named functions)", rule, {
  valid: [
    // Named function with enforced call
    {
      code: `export const load = () => { hasPermission(); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    {
      code: `export const actions = {
      default: () => { hasPermission(); }
      }`,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Named function declaration with enforced call
    {
      code: `export function load() { hasPermission(); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Named async function with enforced call
    {
      code: `export const load = async () => { await hasPermission(); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Named function with namespace import call
    {
      code: `
        import * as permissions from 'permissions';
        export const load = () => { permissions.hasPermission(); }
      `,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Named function with multiple enforced calls (requireAll)
    {
      code: `export const load = () => { hasPermission(); isAuthenticated(); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },

    // Non-exported function named load (should not be checked)
    {
      code: `const load = () => { console.log('test'); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Different function name (should not be checked)
    {
      code: `export const save = () => { console.log('test'); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Empty named function (allowed like empty callbacks)
    {
      code: `export const load = () => {}`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Expression body arrow function
    {
      code: `export const load = () => hasPermission()`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Mixed: both check (callbacks) and checkFunctions work together
    {
      code: `
        export const load = () => { hasPermission(); }
        query(() => { hasPermission(); })
      `,
      options: [
        {
          check: ["query"],
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
    },
  ],
  invalid: [
    // Named function without enforced call
    {
      code: `export const load = () => { console.log('test'); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    {
      code: `export const actions = {
      default: () => { console.log('test'); }
      }`,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Named function declaration without enforced call
    {
      code: `export function load() { console.log('test'); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Named function missing one enforced call (requireAll)
    {
      code: `export const load = () => { hasPermission(); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
      errors: [
        {
          messageId: "missingAll",
          data: { functions: "hasPermission, isAuthenticated" },
        },
      ],
    },

    // Named async function without enforced call
    {
      code: `export const load = async () => { await fetch('/api'); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Expression body arrow without enforced call
    {
      code: `export const load = () => console.log('test')`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Export default function
    {
      code: `export default function load() { console.log('test'); }`,
      options: [
        {
          checkFunctions: ["load"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },
  ],
});

// Tests for exported objects containing functions (e.g., SvelteKit actions)
const exportedObjectTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

exportedObjectTester.run("require-call-in-context (exported objects)", rule, {
  valid: [
    // Exported object with function that has enforced call
    {
      code: `
        export const actions = {
          default: async (event) => {
            hasPermission()
          }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Multiple functions in object, all have enforced call
    {
      code: `
        export const actions = {
          create: async () => { hasPermission() },
          update: async () => { hasPermission() },
          delete: async () => { hasPermission() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Object with method shorthand
    {
      code: `
        export const actions = {
          default() { hasPermission() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Object with async method shorthand
    {
      code: `
        export const actions = {
          async default() { hasPermission() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Empty function in object is allowed
    {
      code: `
        export const actions = {
          default: async () => {}
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Namespace import in object function
    {
      code: `
        import * as permissions from 'permissions';
        export const actions = {
          default: async () => { permissions.hasPermission() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Non-function properties are ignored
    {
      code: `
        export const actions = {
          name: 'test',
          count: 42,
          default: async () => { hasPermission() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // Different export name not checked
    {
      code: `
        export const handlers = {
          default: async () => { console.log('not checked') }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
    },

    // requireAll with all enforced calls present
    {
      code: `
        export const actions = {
          default: async () => { hasPermission(); isAuthenticated() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
    },
  ],
  invalid: [
    // Object function without enforced call
    {
      code: `
        export const actions = {
          default: async (event) => {
            console.log('test')
          }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Multiple functions, one missing enforced call
    {
      code: `
        export const actions = {
          create: async () => { hasPermission() },
          update: async () => { console.log('missing') }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Multiple functions, multiple missing enforced calls
    {
      code: `
        export const actions = {
          create: async () => { console.log('missing') },
          update: async () => { console.log('also missing') }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // Method shorthand without enforced call
    {
      code: `
        export const actions = {
          default() { console.log('test') }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission"],
        },
      ],
      errors: [
        {
          messageId: "missingAtLeastOne",
          data: { functions: "hasPermission" },
        },
      ],
    },

    // requireAll but missing one
    {
      code: `
        export const actions = {
          default: async () => { hasPermission() }
        }
      `,
      options: [
        {
          checkFunctions: ["actions"],
          enforce: ["hasPermission", "isAuthenticated"],
          requireAll: true,
        },
      ],
      errors: [
        {
          messageId: "missingAll",
          data: { functions: "hasPermission, isAuthenticated" },
        },
      ],
    },
  ],
});
