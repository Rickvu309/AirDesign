import { Pool, type Client, type PoolClient } from "pg"

export type Sql = Pool | PoolClient | Client

export function openPool(connectionString: string, applicationName = "api"): Pool {
  return new Pool({
    connectionString,
    max: 10,
    application_name: applicationName,
  })
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}
