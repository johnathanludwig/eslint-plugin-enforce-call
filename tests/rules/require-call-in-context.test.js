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
