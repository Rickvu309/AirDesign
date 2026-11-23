# A browser spec or helper loads an ES module (an .mjs script, an @airdesign package, a file that reaches one, or a file an import() also loads) with await import() where it is used, never a top-level static import

`test-imports` step (`scripts/browser-module-systems.mjs`). Playwright loads specs as CommonJS, and a file loaded both ways in one worker loses its exports
