"use strict";

/**
 * Changes references of `ref={foo => this.foo = foo}`
 * for using `React.createRef()`
 */

function isThisAssignment(node) {
  return (
    node.type === "AssignmentExpression" &&
    node.left.type === "MemberExpression" &&
    node.left.object.type === "ThisExpression" &&
    node.left.property.type === "Identifier"
  );
}

function last(arr) {
  return arr[arr.length - 1];
}

module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const map = new Map();

  const refs = root
    .find(j.JSXAttribute, {
      name: {
        type: "JSXIdentifier",
        name: "ref"
      },
      value: {
        expression: {
          type: "ArrowFunctionExpression"
        }
      }
    })
    // filter for:
    //    ref={foo => this.foo = foo}
    //    ref={foo => { this.foo = foo; }}
    .filter(path => {
      const body = path.node.value.expression.body;
      return (
        isThisAssignment(body) ||
        (body.type === "BlockStatement" &&
          body.body.length === 1 &&
          isThisAssignment(body.body[0].expression))
      );
    })
    .forEach(path => {
      const body = path.node.value.expression.body;
      const name = isThisAssignment(body)
        ? body.left.property.name
        : body.body[0].expression.left.property.name;
      const newName = name.endsWith("Ref") ? name : name + "Ref";
      map.set(name, {
        newName,
        classDeclaration: j(path).closest(j.ClassDeclaration)
      });

      j(path.get("value").get("expression")).replaceWith(
        j.memberExpression(j.thisExpression(), j.identifier(newName))
      );
    });

  if (map.size === 0) {
    return;
  }

  for (const [oldName, { newName, classDeclaration }] of map.entries()) {
    const classConstructor = classDeclaration.find(j.MethodDefinition, {
      kind: "constructor"
    });

    const prop = classDeclaration.find(j.ClassProperty, {
      key: { name: oldName }
    });

    const assign = classConstructor.find(j.AssignmentExpression, {
      left: {
        type: "MemberExpression",
        object: { type: "ThisExpression" },
        property: { name: oldName }
      }
    });

    const newProp = j.classProperty(
      j.identifier(newName),
      j.callExpression(
        j.memberExpression(j.identifier("React"), j.identifier("createRef")),
        []
      ),
      null,
      false
    );

    const newAssign = j.template.statement([
      `this.${newName} = React.createRef();`
    ]);

    if (classConstructor.length === 0) {
      // If no constructor, create a class property `fooRef = React.createRef()`
      if (prop.paths().length > 0) {
        prop.replaceWith(newProp);
      } else {
        j(classDeclaration.find(j.MethodDefinition).paths()[0]).insertBefore(
          newProp
        );
      }
    } else {
      // If there's a constructor, insert `this.foo = React.createRef()`
      prop.remove();
      if (assign.length > 0) {
        assign.replaceWith(newAssign);
      } else {
        const stmts = classConstructor.get("value", "body", "body");
        stmts.push(newAssign);
      }
    }

    // Change all references of `this.foo` for `this.fooRef.current`
    classDeclaration
      .find(j.MemberExpression, {
        object: { type: "ThisExpression" },
        property: { name: oldName }
      })
      .filter(path => {
        while ((path = path.parent)) {
          if (
            (path.node.type === "JSXAttribute" &&
              path.node.name.name === "ref") ||
            (path.node.type === "MethodDefinition" &&
              path.node.kind === "constructor")
          ) {
            return false;
          }
        }
        return true;
      })
      .forEach(path => {
        path
          .get("property")
          .replace(
            j.memberExpression(j.identifier(newName), j.identifier("current"))
          );
      });
  }

  return root.toSource();
};
