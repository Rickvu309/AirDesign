# A test reads the page's engine metrics in thread time: `Performance.enable` over the DevTools protocol passes `{ timeDomain: "threadTicks" }`

lint: `no-wall-time-metrics`. In wall time a task's duration counts the time other processes hold the core, so a speed budget fails on a busy machine though the page did no more work. `no-wall-time-metrics.test.js` replays the wall-time reading `tests/browser/doom-speed.spec.ts` had until 2026-11-23
