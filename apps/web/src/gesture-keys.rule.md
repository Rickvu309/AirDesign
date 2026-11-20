# Every key the editor acts on is a row of the gesture table; a key read anywhere else belongs to one control (a field, a list, a slider, a menu, typed text)

`apps/web/src/gesture-keys.test.ts` scans `apps/web/src` and `packages/render/src` and fails on a key read outside `gestures.ts` that is not listed for its control file, on a listed key a file no longer reads, and on a row with keys whose id no handler names
