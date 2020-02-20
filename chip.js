"use strict";

const MAP = {
  bgColor: 'backgroundColor',
  extraStyle: 'style',
  className: 'style'
}

module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const chipImport = root.find(j.ImportDeclaration, {
    source: {
      value: val => val.startsWith(".") && val.endsWith("/Chip")
    },
    specifiers: specs =>
      specs.length === 1 &&
      specs[0].type === "ImportSpecifier" &&
      specs[0].imported.name === "Chip" &&
      specs[0].local.name === "Chip"
  });

  if (chipImport.size()) {
    root
      .find(j.JSXAttribute, {
        name: {
          type: "JSXIdentifier",
          name: val => Object.keys(MAP).includes(val),
        }
      })
      .filter(p => {
        const tag = p.parentPath.parentPath.value;
        return tag.type === "JSXOpeningElement" && tag.name.name === "Chip";
      })
      .forEach(p => {
        j(p.get("name")).replaceWith(j.jsxIdentifier(MAP[p.value.name.name]));
      });

    return root.toSource();
  }
};
