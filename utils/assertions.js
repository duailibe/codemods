"use strict";

function isMemberish(node) {
  return (
    node.type === "MemberExpression" || node.type === "OptionalMemberExpression"
  );
}

function isCall(node) {
  return (
    node.type === "CallExpression" || node.type === "OptionalCallExpression"
  );
}

function isEqual(a, b) {
  if (isMemberish(a) && isMemberish(b)) {
    return isEqual(a.property, b.property) && isEqual(a.object, b.object);
  }

  if (isCall(a) && isCall(b)) {
    if (a.arguments.length !== b.arguments.length) {
      return false;
    }

    for (let i = 0; i < a.arguments.length; i++) {
      if (!isEqual(a.arguments[i], b.arguments[i])) {
        return false;
      }
    }

    return isEqual(a.callee, b.callee);
  }

  if (a.type !== b.type) {
    return false;
  }

  if (a.type === "ThisExpression") {
    return true;
  }

  if (a.type === "Identifier") {
    return a.name === b.name;
  }
}

module.exports = {
  isMemberish,
  isCall,
  isEqual
};
