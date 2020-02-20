module.exports = function(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root
    .find(j.JSXOpeningElement, {
      name: {
        name: value => /^((Ion|Material(Community)?)[Ii]cons?|Icon)$/.test(value)
      }
    })
    .forEach(element => {
      // data-testid -> testID
      j(element)
        .find(j.JSXAttribute, { name: { name: "data-testid" } })
        .forEach(attr => {
          attr.node.name.name = "testID";
        });

      // className -> style
      j(element)
        .find(j.JSXAttribute, { name: { name: "className" } })
        .forEach(attr => {
          const classname = attr.node.value.expression;
          const style = j(element).find(j.JSXAttribute, {
            name: { name: "style" }
          });
          if (style.size()) {
            style.forEach(({ node: { value } }) => {
              if (value.expression.type === "ArrayExpression") {
                value.expression.elements.unshift(classname);
              } else {
                value.expression = j.arrayExpression([
                  classname,
                  value.expression
                ]);
              }
            });
          } else {
            j(element)
              .get("attributes")
              .push(
                j.jsxAttribute(
                  j.jsxIdentifier("style"),
                  j.jsxExpressionContainer(classname)
                )
              );
          }
          j(attr).remove();
        });
    });

  return root.toSource();
};
