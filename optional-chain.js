"use strict";

/**
 *
 */

const { isMemberish, isCall, isEqual } = require("./utils/assertions");

module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // `foo && foo()` => `foo?.()`
  root
    .find(j.LogicalExpression, {
      left: node => node.type === "Identifier" || isMemberish(node),
      right: node => isCall(node)
    })
    .filter(() => false)
    .forEach(path => {
      const { left, right } = path.node;

      if (isEqual(left, right.callee)) {
        changed = true;
        j(path).replaceWith(
          j.optionalCallExpression(right.callee, right.arguments)
        );
      }
    });

  // `foo && foo.bar` => `foo?.bar`
  root
    .find(j.LogicalExpression, {
      left: node => node.type === "Identifier" || isMemberish(node),
      right: node =>
        isMemberish(node) || (isCall(node) && isMemberish(node.callee))
    })
    .forEach(path => {
      const { left, right } = path.node;

      const chainPath = findByObject(left, path.get("right"));
      if (chainPath) {
        changed = true;
        j(chainPath).replaceWith(({ node }) =>
          j.optionalMemberExpression(left, node.property, node.computed)
        );
        j(path).replaceWith(path => path.node.right);
      }
    });

  root
    .find(j.IfStatement, {
      test: node => node.type === "Identifier" || isMemberish(node),
      alternate: null
    })
    .forEach(path => {
      const { test, consequent } = path.node;

      if (
        consequent.type === "BlockStatement" &&
        consequent.body.length !== 1
      ) {
        return;
      }

      let statement = path.get("consequent");
      if (consequent.type === "BlockStatement") {
        statement = statement.get("body", "0");
      }
      statement = statement.get("expression");

      if (statement.node.type === "CallExpression") {
        const chainPath = findByObject(test, statement);
        if (chainPath) {
          changed = true;
          const { comments } = path.node;
          j(chainPath).replaceWith(({ node }) =>
            j.optionalMemberExpression(test, node.property, node.computed)
          );
          j(path).replaceWith(path => j.expressionStatement(statement.node));
          path.node.comments = comments;
        }
      }
    });

  if (changed) {
    return root.toSource();
  }
};

function findByObject(obj, exprPath) {
  const expr = exprPath.node;

  if (isCall(expr)) {
    return findByObject(obj, exprPath.get("callee"));
  }

  if (isMemberish(expr)) {
    return isEqual(obj, expr.object)
      ? exprPath
      : findByObject(obj, exprPath.get("object"));
  }

  return null;
}
