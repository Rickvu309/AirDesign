# Every control kind a trait field uses has one component and one browser test

`apps/web/src/editor/control-kinds.test.ts` maps every declared field and text input to its control kind and fails when the kind has no entry in `controlViews` or no `tests/browser/control-<kind>.spec.ts`
