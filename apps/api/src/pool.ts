import { Pool, type Client, type PoolClient } from "pg"

export type Sql = Pool | PoolClient | Client

export function openPool(connectionString: string, applicationName = "api"): Pool {
  return new Pool({
    connectionString,
    max: 2,
    application_name: applicationName,
  })
}
