# Only `packages/pptx` reads `@airdesign/document`; everything else takes slide data from `@airdesign/doom`

The `package-boundaries` step (`pnpm check:boundaries`) runs `scripts/document-reach.mjs`, which fails any file outside `packages/pptx` and `packages/document` that imports `@airdesign/document`, and any `package.json` outside them that lists it, and names Doom's index as the place to import from instead. `scripts/document-reach.test.mjs` replays the imports that moved off document from `apps/web`, `packages/render` and `packages/catalog`.
