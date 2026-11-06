export function productionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return
  for (const name of ["AIRDESIGN_SECRET", "AIRDESIGN_PUBLIC_ORIGIN", "AIRDESIGN_MCP_ORIGIN", "RESEND_API_KEY", "MAIL_FROM", "AIRDESIGN_OPERATIONS_PATH"]) {
    if (!process.env[name]?.trim()) throw new Error(`Missing required environment: ${name}`)
  }
  if (!(process.env.DATABASE_URL ?? process.env.AIRDESIGN_DATABASE_URL)?.trim()) throw new Error("Missing required environment: DATABASE_URL")
  if ((process.env.AIRDESIGN_SECRET?.length ?? 0) < 32) throw new Error("AIRDESIGN_SECRET must contain at least 32 characters")
  const origin = new URL(process.env.AIRDESIGN_PUBLIC_ORIGIN ?? "")
  if (origin.protocol !== "https:" || origin.origin !== process.env.AIRDESIGN_PUBLIC_ORIGIN) throw new Error("AIRDESIGN_PUBLIC_ORIGIN must be an HTTPS origin")
  const mcpOrigin = new URL(process.env.AIRDESIGN_MCP_ORIGIN ?? "")
  if (mcpOrigin.protocol !== "https:" || mcpOrigin.origin !== process.env.AIRDESIGN_MCP_ORIGIN) throw new Error("AIRDESIGN_MCP_ORIGIN must be an HTTPS origin")
  if (process.env.AIRDESIGN_EXPOSE_INBOX === "1") throw new Error("AIRDESIGN_EXPOSE_INBOX is forbidden in production")
}
