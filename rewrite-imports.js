const path = require("path");

function getLast(arr) {
  return arr[arr.length - 1];
}

module.exports = function(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);
  const fromPaths = new Set(options.fromPath.split(","));

  const importDecl = root.find(j.ImportDeclaration, {
    source: {
      value: valueMatches
    }
  });

  if (!options.specifiers) {
    importDecl.map(p => p.get("source")).replaceWith(j.literal(options.toPath));

    root
      .find(j.CallExpression, {
        callee: callee =>
          j.match(callee, { name: "require" }) ||
          j.match(callee, {
            type: "MemberExpression",
            object: { name: "require" }
          }) ||
          j.match(callee, {
            type: "MemberExpression",
            object: { name: "jest" },
            property: { name: "mock" }
          }),
        arguments: args =>
          args[0] && args[0].value && valueMatches(args[0].value)
      })
      .map(p => p.get("arguments", "0"))
      .replaceWith(j.literal(options.toPath));
  } else {
    // Can't support `require.requireActual` or `jest.mock` in this case
    const specifiers = new Set(options.specifiers.split(/,/g));

    const present = [];
    importDecl.forEach(p => {
      p.node.specifiers = p.node.specifiers.filter(specifier => {
        if (specifiers.has(specifier.imported.name)) {
          present.push(specifier);
          return false;
        }
        return true;
      });
      if (p.node.specifiers.length === 0) {
        importDecl.remove();
      }
    });

    if (present.length === 0) {
      return;
    }

    const existingImport = root.find(j.ImportDeclaration, {
      source: {
        value: value => value === options.toPath
      }
    });
    if (existingImport.size()) {
      const p = existingImport.get("specifiers");
      p.push.apply(p, present);
    } else {
      const newImport = j.importDeclaration(present, j.literal(options.toPath));

      const moduleImport = root.find(j.ImportDeclaration, {
        source: { value: value => !value.startsWith(".") }
      });
      const localImport = root.find(j.ImportDeclaration, {
        source: { value: value => value.startsWith(".") }
      });

      if (moduleImport.size()) {
        j(getLast(moduleImport.paths())).insertAfter(newImport);
      } else if (localImport.size()) {
        j(localImport.get()).insertBefore(newImport);
      } else {
        root
          .find(j.Program)
          .get("body", 0)
          .insertBefore(newImport);
      }
    }
  }

  return root.toSource();

  function valueMatches(target) {
    const targetPath = path.join(path.dirname(file.path), target);
    return target.startsWith(".") && fromPaths.has(targetPath);
  }
};
