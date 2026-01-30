/**
 * Extract the full name from a CallExpression node
 * @param {Node} node - CallExpression node
 * @returns {string|null} - Full function name or null
 */
function getCallExpressionName(node) {
  if (node.type !== "CallExpression") {
    return null;
  }

  const { callee } = node;

  // Simple identifier: query()
  if (callee.type === "Identifier") {
    return callee.name;
  }

  // Member expression: query.batch()
  if (callee.type === "MemberExpression") {
    const parts = [];
    let current = callee;

    while (current) {
      if (current.type === "MemberExpression") {
        if (current.property.type === "Identifier") {
          parts.unshift(current.property.name);
        }
        current = current.object;
      } else if (current.type === "Identifier") {
        parts.unshift(current.name);
        break;
      } else {
        return null;
      }
    }

    return parts.join(".");
  }

  return null;
}

/**
 * Check if a callback function is empty
 * @param {Node} node - ArrowFunctionExpression, FunctionExpression, or FunctionDeclaration
 * @returns {boolean}
 */
function isEmptyCallback(node) {
  // Arrow function with expression body: () => expr
  if (node.type === "ArrowFunctionExpression" && node.expression) {
    return false;
  }

  // Block body: () => {} or function() {} or function name() {}
  if (node.body && node.body.type === "BlockStatement") {
    return node.body.body.length === 0;
  }

  return false;
}

/**
 * Get all function calls in a callback body, including those in nested blocks
 * @param {Node} node - ArrowFunctionExpression, FunctionExpression, or FunctionDeclaration
 * @returns {string[]} - Array of function names called
 */
function getDirectCalls(node) {
  const calls = [];

  // Arrow function with expression body: () => foo() or () => await foo()
  if (node.type === "ArrowFunctionExpression" && node.expression) {
    let expr = node.body;

    // Handle await expression: () => await foo()
    if (expr.type === "AwaitExpression") {
      expr = expr.argument;
    }

    const name = getCallExpressionName(expr);
    if (name) {
      calls.push(name);
    }
    return calls;
  }

  /**
   * Recursively collect calls from a statement
   * @param {Node} statement - Any statement node
   */
  function collectCallsFromStatement(statement) {
    if (!statement) {
      return;
    }

    // ExpressionStatement containing a CallExpression or AwaitExpression
    if (statement.type === "ExpressionStatement") {
      let expr = statement.expression;

      // Handle await expression: await foo()
      if (expr.type === "AwaitExpression") {
        expr = expr.argument;
      }

      if (expr.type === "CallExpression") {
        const name = getCallExpressionName(expr);
        if (name) {
          calls.push(name);
        }
      }
    }

    // VariableDeclaration with CallExpression or AwaitExpression initializer
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations) {
        if (declarator.init) {
          let expr = declarator.init;

          // Handle await expression: const x = await foo()
          if (expr.type === "AwaitExpression") {
            expr = expr.argument;
          }

          if (expr.type === "CallExpression") {
            const name = getCallExpressionName(expr);
            if (name) {
              calls.push(name);
            }
          }
        }
      }
    }

    // ReturnStatement with CallExpression or AwaitExpression
    if (statement.type === "ReturnStatement" && statement.argument) {
      let expr = statement.argument;

      // Handle await expression: return await foo()
      if (expr.type === "AwaitExpression") {
        expr = expr.argument;
      }

      if (expr.type === "CallExpression") {
        const name = getCallExpressionName(expr);
        if (name) {
          calls.push(name);
        }
      }
    }

    // BlockStatement: { ... }
    if (statement.type === "BlockStatement") {
      for (const stmt of statement.body) {
        collectCallsFromStatement(stmt);
      }
    }

    // IfStatement: if (...) { ... } else { ... }
    if (statement.type === "IfStatement") {
      collectCallsFromStatement(statement.consequent);
      collectCallsFromStatement(statement.alternate);
    }

    // TryStatement: try { ... } catch { ... } finally { ... }
    if (statement.type === "TryStatement") {
      collectCallsFromStatement(statement.block);
      if (statement.handler) {
        collectCallsFromStatement(statement.handler.body);
      }
      collectCallsFromStatement(statement.finalizer);
    }

    // ForStatement: for (...) { ... }
    if (statement.type === "ForStatement") {
      collectCallsFromStatement(statement.body);
    }

    // ForInStatement: for (... in ...) { ... }
    if (statement.type === "ForInStatement") {
      collectCallsFromStatement(statement.body);
    }

    // ForOfStatement: for (... of ...) { ... }
    if (statement.type === "ForOfStatement") {
      collectCallsFromStatement(statement.body);
    }

    // WhileStatement: while (...) { ... }
    if (statement.type === "WhileStatement") {
      collectCallsFromStatement(statement.body);
    }

    // DoWhileStatement: do { ... } while (...)
    if (statement.type === "DoWhileStatement") {
      collectCallsFromStatement(statement.body);
    }

    // SwitchStatement: switch (...) { case ...: ... }
    if (statement.type === "SwitchStatement") {
      for (const caseClause of statement.cases) {
        for (const stmt of caseClause.consequent) {
          collectCallsFromStatement(stmt);
        }
      }
    }

    // WithStatement: with (...) { ... }
    if (statement.type === "WithStatement") {
      collectCallsFromStatement(statement.body);
    }

    // LabeledStatement: label: ...
    if (statement.type === "LabeledStatement") {
      collectCallsFromStatement(statement.body);
    }
  }

  // Block body: () => { foo(); bar(); }
  if (node.body && node.body.type === "BlockStatement") {
    for (const statement of node.body.body) {
      collectCallsFromStatement(statement);
    }
  }

  return calls;
}

/**
 * Check if a call matches an enforced function name
 * Supports both direct matches and namespace import patterns:
 * - "hasPermission" matches "hasPermission" (direct)
 * - "hasPermission" matches "permissions.hasPermission" (namespace import)
 * - "auth.check" matches "auth.check" (direct member expression)
 * @param {string} call - The actual function call name
 * @param {string} enforce - The required function name
 * @returns {boolean} - True if call satisfies the enforcement
 */
function callMatchesEnforced(call, enforce) {
  // Direct match
  if (call === enforce) {
    return true;
  }

  // Namespace import pattern: enforce "hasPermission" matches call "permissions.hasPermission"
  // Check if the call ends with the enforced function name as the rightmost part
  if (call.includes(".") && !enforce.includes(".")) {
    const parts = call.split(".");
    const lastPart = parts[parts.length - 1];
    return lastPart === enforce;
  }

  return false;
}

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
    return enforce.every((fn) =>
      calls.some((call) => callMatchesEnforced(call, fn)),
    );
  } else {
    // At least one enforced function must be called
    return enforce.some((fn) =>
      calls.some((call) => callMatchesEnforced(call, fn)),
    );
  }
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce specific function calls within callback arguments of designated context functions",
      category: "Best Practices",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          check: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          checkFunctions: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          enforce: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          requireAll: {
            type: "boolean",
            default: false,
          },
        },
        required: ["enforce"],
        additionalProperties: false,
      },
    ],
    messages: {
      missingAtLeastOne: "Callback must call at least one of: {{functions}}",
      missingAll: "Callback must call all of: {{functions}}",
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const {
      check = [],
      checkFunctions = [],
      enforce = [],
      requireAll = false,
    } = options;

    // Convert to sets for faster lookup
    const checkSet = new Set(check);
    const checkFunctionsSet = new Set(checkFunctions);
    const messageId = requireAll ? "missingAll" : "missingAtLeastOne";

    /**
     * Unwrap TypeScript type assertion expressions to get the underlying expression
     * Handles: TSSatisfiesExpression, TSAsExpression, TSTypeAssertion
     * @param {Node} node - Any expression node
     * @returns {Node} - The unwrapped expression
     */
    function unwrapTypeExpression(node) {
      if (!node) {
        return node;
      }
      // Handle TypeScript satisfies, as, and type assertion expressions
      if (
        node.type === "TSSatisfiesExpression" ||
        node.type === "TSAsExpression" ||
        node.type === "TSTypeAssertion"
      ) {
        return unwrapTypeExpression(node.expression);
      }
      return node;
    }

    /**
     * Check a function node for enforced calls and report if missing
     * @param {Node} funcNode - ArrowFunctionExpression or FunctionExpression/FunctionDeclaration
     */
    function checkFunctionForEnforcedCalls(funcNode) {
      // Empty functions are allowed
      if (isEmptyCallback(funcNode)) {
        return;
      }

      // Get all direct calls in the function
      const calls = getDirectCalls(funcNode);

      // Check if enforced calls are present
      if (!checkEnforcedCalls(calls, enforce, requireAll)) {
        context.report({
          node: funcNode,
          messageId,
          data: {
            functions: enforce.join(", "),
          },
        });
      }
    }

    /**
     * Get the name of an exported function variable
     * @param {Node} node - VariableDeclarator node
     * @returns {string|null} - Function name or null
     */
    function getExportedFunctionName(node) {
      if (node.id && node.id.type === "Identifier") {
        return node.id.name;
      }
      return null;
    }

    return {
      CallExpression(node) {
        // Get the name of the function being called
        const functionName = getCallExpressionName(node);
        if (!functionName || !checkSet.has(functionName)) {
          return;
        }

        // Check all arguments for function callbacks
        for (const arg of node.arguments) {
          // Only check arrow functions and function expressions
          if (
            arg.type !== "ArrowFunctionExpression" &&
            arg.type !== "FunctionExpression"
          ) {
            continue;
          }

          checkFunctionForEnforcedCalls(arg);
        }
      },

      // Handle: export const load = () => {}
      ExportNamedDeclaration(node) {
        if (checkFunctionsSet.size === 0) {
          return;
        }

        // export const load = () => {}
        if (
          node.declaration &&
          node.declaration.type === "VariableDeclaration"
        ) {
          for (const declarator of node.declaration.declarations) {
            const name = getExportedFunctionName(declarator);
            if (!name || !checkFunctionsSet.has(name)) {
              continue;
            }

            // Check if the initializer is a function (unwrap TS type expressions)
            const unwrappedInit = unwrapTypeExpression(declarator.init);
            if (
              unwrappedInit &&
              (unwrappedInit.type === "ArrowFunctionExpression" ||
                unwrappedInit.type === "FunctionExpression")
            ) {
              checkFunctionForEnforcedCalls(unwrappedInit);
            }

            // Check if the initializer is an object with function properties
            // e.g., export const actions = { default: async () => {} }
            if (unwrappedInit && unwrappedInit.type === "ObjectExpression") {
              for (const property of unwrappedInit.properties) {
                // Skip spread elements and non-property nodes
                if (property.type !== "Property") {
                  continue;
                }

                // Unwrap TS type expressions from property value
                const unwrappedValue = unwrapTypeExpression(property.value);

                // Arrow function or function expression as property value
                if (
                  unwrappedValue &&
                  (unwrappedValue.type === "ArrowFunctionExpression" ||
                    unwrappedValue.type === "FunctionExpression")
                ) {
                  checkFunctionForEnforcedCalls(unwrappedValue);
                }
              }
            }
          }
        }

        // export function load() {}
        if (
          node.declaration &&
          node.declaration.type === "FunctionDeclaration"
        ) {
          const name = node.declaration.id && node.declaration.id.name;
          if (name && checkFunctionsSet.has(name)) {
            checkFunctionForEnforcedCalls(node.declaration);
          }
        }
      },

      // Handle: export default function load() {}
      ExportDefaultDeclaration(node) {
        if (checkFunctionsSet.size === 0) {
          return;
        }

        if (
          node.declaration &&
          node.declaration.type === "FunctionDeclaration"
        ) {
          const name = node.declaration.id && node.declaration.id.name;
          if (name && checkFunctionsSet.has(name)) {
            checkFunctionForEnforcedCalls(node.declaration);
          }
        }
      },
    };
  },
};
