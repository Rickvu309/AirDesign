import { Client } from "pg"
import { expect, it } from "vitest"

import { postgresInfo } from "./testing/harness.js"

it("runs the throwaway cluster without waiting for the disk, and keeps commits synchronous", async () => {
  const info = await postgresInfo()
  const admin = new Client({ connectionString: info.admin, application_name: "test-cluster" })
  await admin.connect()
  try {
    const shown = await admin.query<{ fsync: string; full_page_writes: string; synchronous_commit: string }>(
      "select current_setting('fsync') as fsync, current_setting('full_page_writes') as full_page_writes, current_setting('synchronous_commit') as synchronous_commit",
    )
    expect(shown.rows[0]).toEqual({ fsync: "off", full_page_writes: "off", synchronous_commit: "on" })
  } finally {
    await admin.end()
  }
})
