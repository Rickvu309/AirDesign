# A drag's script and main-thread work stay inside one frame, no frame of it runs past 50 ms, and its frame and delay warn over their limit

`tests/browser/doom-speed.spec.ts` drags a layer on a 40-slide Doom deck through `drag-feel.ts`, fails over its script, task and long-frame budgets, and prints `drag-frame` and `drag-delay`, which warn over their limit in `metrics.json`
