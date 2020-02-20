"use strict";

function getLast(arr) {
  return arr[arr.length - 1];
}

module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const firstNode = getFirstNode();
  const comments = firstNode.comments;

  const specifiers = [];

  root
    .find(j.ImportDeclaration, {
      source: {
        value: val => val.startsWith(".") && val.endsWith("colors")
      }
    })
    .forEach(path => {
      specifiers.push(path.node.specifiers[0]);
    })
    .remove();

  root
    .find(j.ImportSpecifier, {
      imported: {
        name: v => v === "hexToRGBA" || v === "hexToFlatRGB"
      }
    })
    .forEach(path => {
      specifiers.push(path.node);
      if (path.parent.node.specifiers.length === 1) {
        j(path.parent).remove();
      } else {
        j(path).remove();
      }
    })

  if (specifiers.length > 0) {
    const imports = root.find(j.ImportDeclaration, {
      source: {
        value: val => !val.startsWith(".")
      }
    });

    const decl = j.importDeclaration(
      specifiers,
      j.stringLiteral("shared/colors")
    );
    if (imports.size() === 0) {
      root.find(j.Program).get("body", 0).insertBefore(decl);

      const currentFirstNode = getFirstNode();
      if (currentFirstNode !== firstNode) {
        currentFirstNode.comments = comments;
      }
    } else {
      getLast(imports.paths()).insertAfter(decl);
    }
    return root.toSource();
  }

  function getFirstNode() {
    return root.find(j.Program).get("body", 0).node;
  }
};
