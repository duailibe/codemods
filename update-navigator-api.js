function last(arr) {
  return arr[arr.length - 1];
}

module.exports = function(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);

  let propType;
  let classPath;

  let contextTypes = root.find(j.ClassProperty, { key: { name: 'contextTypes' } });

  {
    let prop = contextTypes.find(j.Property, { key: { name: 'navigator' } });

    if (prop.length === 0) {
      return null;
    } else if (prop.length > 1) {
      throw Error('Multiple');
    }

    classPath = prop.closest(j.ClassDeclaration).paths()[0];

    propType = prop.nodes()[0];
    prop.remove();
  }

  // Remove contextTypes if it was the only key
  if (contextTypes.find(j.Property).length === 0) {
    contextTypes.remove();
  }

  // Insert prop type
  j(classPath)
    .find(j.ClassProperty, { key: { name: 'propTypes' } })
    .forEach(path => {
      const types = j(path.get('value'))
        .find(j.Property)
        .paths();
      const idx = types.findIndex(t => t.node.key.name > 'navigator');
      if (idx === -1) {
        j(last(types)).insertAfter(propType);
      } else {
        j(types[idx]).insertBefore(propType);
      }
    });

  // Change `this.context.navigator` for `this.props.navigator`
  j(classPath)
    .find(j.MemberExpression, {
      object: {
        type: 'MemberExpression',
        object: { type: 'ThisExpression' },
        property: { name: 'context' },
      },
      property: { name: 'navigator' },
    })
    .replaceWith(
      j.memberExpression(
        j.memberExpression(j.thisExpression(), j.identifier('props')),
        j.identifier('navigator')
      )
    );

  // Add `withNavigator` import
  {
    let imports = root.find(j.ImportDeclaration).paths();
    let idx = imports.findIndex(p => p.node.source.value.startsWith('.'));

    let newNode = j.importDeclaration(
      [j.importSpecifier(j.identifier('withNavigator'))],
      j.literal('@geekie/navigator')
    );

    if (idx === -1) {
      j(last(imports)).insertAfter(newNode);
    } else {
      j(imports[idx]).insertBefore(newNode);
    }
  }

  {
    let name = classPath.node.id.name;
    let newName = `${name}WithNavigator`;
    root
      .find(j.ExportSpecifier, { local: { name } })
      .replaceWith(({ node }) => j.exportSpecifier(j.identifier(newName), node.exported))
      .closest(j.ExportNamedDeclaration)
      .insertBefore(j.template.statement([`const ${newName} = withNavigator(${name});`]));

    root
      .find(j.ExportDefaultDeclaration)
      .find(j.Identifier, { name: name })
      .replaceWith(j.callExpression(j.identifier('withNavigator'), [j.identifier(name)]));
  }

  return root.toSource();
};
