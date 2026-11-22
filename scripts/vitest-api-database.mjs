import { afterAll, beforeAll } from "vitest"
import { dropOwnDatabase, sharedCluster } from "../apps/api/src/testing/harness.ts"

beforeAll(async () => {
  await sharedCluster()
}, 120_000)

afterAll(dropOwnDatabase)
