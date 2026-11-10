import { mergeConfig } from "vitest/config"
import checkedConfig from "../vitest.config.mts"

const instrumentedTestTimeoutMilliseconds = 60_000

export default mergeConfig(checkedConfig, { test: { testTimeout: instrumentedTestTimeoutMilliseconds } })
