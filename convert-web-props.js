module.exports = function(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root
    .find(j.JSXAttribute, { name: { name: "data-testid" } })
    .filter(attr => {
      const el = attr.parentPath.parentPath.value;
      return el.type === "JSXOpeningElement" && /^[A-Z]/.test(el.name.name);
    })
    .forEach(attr => {
      attr.value.name.name = 'testID';
    });

  return root.toSource();
};
