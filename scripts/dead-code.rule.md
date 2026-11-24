# An ordinary word in a script does not keep a package export alive

`scripts/dead-code.mjs` roots an export when a script loads that package and a script reads the export: a property access, or a name destructured from `packageBuild`. A local, a string, or a property key is not a read. A `package.json` subpath such as `@airdesign/catalog/icon-names` is a real import. `scripts/dead-code.test.mjs` plants `const routed` and `{ routed: true }` beside a load that never reads `routed`, and imports `@airdesign/shapes/marks` from the web root.
