# CI uses an editor speed budget calibrated on hosted runners

The spec uses the hosted timing limits when `CI=true` or `CI=1`. The ranges below come from the #1646 verifier's clean GitHub-hosted `browser-timings` readings on November 24, 2026. The verifier kept 17 readings across main and PR branches (15 for thumbnails) after excluding the three planted typing slowdowns in [run 45488434046](https://github.com/Rickvu309/AirDesign/actions/runs/45488434046).

| Reading (ms)            | Clean CI range | CI limit | Local limit |
| ----------------------- | -------------: | -------: | ----------: |
| Idle thread work in 3 s |        3.7–5.8 |        8 |         150 |
| Typing per key          |      2.11–3.08 |        4 |           8 |
| Thumbnail render        |      1.30–1.88 |      2.6 |           8 |
| Thumbnail paint         |      1.50–2.26 |      3.1 |           8 |
| Drag script per frame   |        1.5–2.2 |      3.0 |           8 |
| Drag task per frame     |        4.7–6.7 |      8.6 |          16 |
| Agent edit to paint     |      13.8–28.2 |       42 |          72 |

The 3.0 ms drag script limit is 1.36 times the observed maximum of 2.2 ms. The 42 ms agent paint limit is 1.49 times the observed maximum of 28.2 ms and leaves 4.8 ms above the verifier's fitted lognormal p99 of 37.2 ms. The fit uses 17 readings from one day, so it cannot establish the long-run false-failure rate. Doubling the slower runner group's mean of 24.5 ms still exceeds 42 ms.

Local renderer work is slower and more variable. Clean local typing read 6.18–7.45 ms in the earlier quiet cohort. For agent paint, the highest clean median under load was 61.8 ms. The lowest median with a 50 ms stall on each edit was 81.8 ms. The 72 ms limit leaves about 10 ms on either side and catches a doubling from baselines around 36 ms or higher. The 50 ms per-task ceiling and the 1.2 ms beyond-typical typing limit apply in both environments.
