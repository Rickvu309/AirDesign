# Queue validator answers reach main even on a render-cache miss; cache handoffs cannot certify a commit

`scripts/ci-corpus.test.mjs` checks both shard artifacts and missing/empty downloads. `scripts/ci-parts.test.mjs` requires approved-run promotion and optional cache operations. Small spec results transfer on a miss; render caches retain restore/save without forcing checks to warm them
