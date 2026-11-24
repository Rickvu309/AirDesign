# A named face and the bold flag paint as one weight

`paintedFace` in `packages/doom/src/painted-face.ts` is the only reading of a font string, a style weight and a bold flag. Ctrl+B sets the bold flag and leaves the named face stored; paint then uses the family's bold face, and a second press clears the flag and paints the named face again. `packages/doom/src/painted-face.test.ts` and `tests/browser/editor-text-weight.spec.ts` fail when the face, the weight and the flag disagree.
