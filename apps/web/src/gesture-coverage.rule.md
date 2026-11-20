# Every gesture in the editor has one row in the gesture table and a browser test

`apps/web/src/gesture-coverage.test.ts` reads every `tests/browser/*.spec.ts` and fails for each row of `gestures` in `packages/render/src/gestures.ts` that no `covers(...)` call names, and for a `covers(...)` id that is not a row. `packages/render/src/gestures.test.ts` fails when a press of one row reads as another row where both work
