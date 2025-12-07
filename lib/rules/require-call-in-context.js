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
 * @param {Node} node - ArrowFunctionExpression or FunctionExpression
 * @returns {boolean}
 */
function isEmptyCallback(node) {
  // Arrow function with expression body: () => expr
  if (node.type === "ArrowFunctionExpression" && node.expression) {
    return false;
  }

  // Block body: () => {} or function() {}
  if (node.body && node.body.type === "BlockStatement") {
    return node.body.body.length === 0;
  }

  return false;
}

/**
 * Get all direct function calls in a callback body
 * @param {Node} node - ArrowFunctionExpression or FunctionExpression
 * @returns {string[]} - Array of function names called directly
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

  // Block body: () => { foo(); bar(); }
  if (node.body && node.body.type === "BlockStatement") {
    for (const statement of node.body.body) {
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
    }
  }

  return calls;
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
    return enforce.every((fn) => calls.includes(fn));
  } else {
    // At least one enforced function must be called
    return enforce.some((fn) => calls.includes(fn));
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
        required: ["check", "enforce"],
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
    const { check = [], enforce = [], requireAll = false } = options;

    // Convert to sets for faster lookup
    const checkSet = new Set(check);
    const messageId = requireAll ? "missingAll" : "missingAtLeastOne";

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

          // Empty callbacks are allowed
          if (isEmptyCallback(arg)) {
            continue;
          }

          // Get all direct calls in the callback
          const calls = getDirectCalls(arg);

          // Check if enforced calls are present
          if (!checkEnforcedCalls(calls, enforce, requireAll)) {
            context.report({
              node: arg,
              messageId,
              data: {
                functions: enforce.join(", "),
              },
            });
          }
        }
      },
    };
  },
};
