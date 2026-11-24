# A drag's script and main-thread work stay inside one frame, no frame of it runs past 50 ms, and its frame and delay warn over their limit

`tests/browser/editor-speed.spec.ts` drags a layer on a 40-slide deck through `drag-feel.ts`. `drag-frame` and `drag-delay` are the renderer thread's own time on each frame (`tdur` of that frame's task), and a long frame is thread time over 50 ms. Wall-clock gaps between frames are not the measure. The drag fails over its script, task and long-frame budgets, and prints `drag-frame` and `drag-delay`, which warn over their limit in `metrics.json`
