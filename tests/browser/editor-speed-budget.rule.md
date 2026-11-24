# CI uses an editor speed budget calibrated on hosted runners

The spec uses the hosted timing limits when `CI=true` or `CI=1`. The CI limits use clean GitHub-hosted `ubuntu-24.04` readings from #1604 and its merge on main. The sample is too small to estimate a p99. Each limit rounds up the largest comparable reading times 1.35. The 38 ms agent limit also allows for an earlier 27.6 ms reading from a trace that counted fewer tasks.

| Reading (ms)            | Clean CI range | CI limit | Local limit |
| ----------------------- | -------------: | -------: | ----------: |
| Idle thread work in 3 s |        4.1–5.8 |        8 |         150 |
| Typing per key          |      2.20–2.93 |        4 |           8 |
| Thumbnail render        |      1.32–1.88 |      2.6 |           8 |
| Thumbnail paint         |      1.56–2.26 |      3.1 |           8 |
| Drag script per frame   |        1.5–2.0 |      2.7 |           8 |
| Drag task per frame     |        4.7–6.3 |      8.6 |          16 |
| Agent edit to paint     |      14.9–27.6 |       38 |          72 |

Local renderer work is slower and more variable. Clean local typing read 6.18–7.45 ms in the earlier quiet cohort. For agent paint, the highest clean median under load was 61.8 ms. The lowest median with a 50 ms stall on each edit was 81.8 ms. The 72 ms limit leaves about 10 ms on either side. The 50 ms per-task ceiling and the 1.2 ms beyond-typical typing limit apply in both environments.
