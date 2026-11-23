# A preset's text area and connection sites name only guides its table defines, so text and line ends never fall back to the box unseen

`packages/doom/src/preset-geometry.test.ts` evaluates every guide each preset's `area` and `sites` name in the one table under `packages/doom/src/preset-*.ts`, and fails on a name the table leaves out
