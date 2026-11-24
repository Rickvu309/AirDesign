# No file or folder named `utils`, `helpers` or `common`

`nameFindings` in `tooling/oxlint-plugin-airdesign/scan-names.js` flags a path segment whose name, before the extension, is one of those words. `tooling/oxlint-plugin-airdesign/lint-tree.js`, run by `pnpm lint`, exits when that hit is present. `tooling/oxlint-plugin-airdesign/scan-names.test.js` plants those names and passes a name that only contains the word.
