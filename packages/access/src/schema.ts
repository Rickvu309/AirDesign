import { boolean, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core"

export function accessTables(schemaName: string) {
  const namespace = pgSchema(schemaName)
  const user = namespace.table("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
    displayName: text("displayName"),
    freeUsageWeekStartedAt: timestamp("freeUsageWeekStartedAt", { mode: "date" }),
  })
  const session = namespace.table("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  })
  const account = namespace.table("account", {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  })
  const verification = namespace.table("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  })
  const challenge = namespace.table("challenge", {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("codeHash").notNull(),
    linkHash: text("linkHash").notNull().unique(),
    intentToken: text("intentToken").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    attempts: integer("attempts").notNull(),
    locked: boolean("locked").notNull(),
    consumed: boolean("consumed").notNull(),
  })
  const sendWindow = namespace.table("send_window", {
    email: text("email").primaryKey(),
    lastSentAt: timestamp("lastSentAt", { mode: "date" }).notNull(),
    hourStartedAt: timestamp("hourStartedAt", { mode: "date" }).notNull(),
    hourCount: integer("hourCount").notNull(),
  })
  const tombstone = namespace.table("tombstone", {
    emailHash: text("emailHash").primaryKey(),
    freeUsageWeekStartedAt: timestamp("freeUsageWeekStartedAt", { mode: "date" }).notNull(),
    deletedAt: timestamp("deletedAt", { mode: "date" }).notNull(),
  })
  return { user, session, account, verification, challenge, sendWindow, tombstone }
}

export function accessSchemaSql(schemaName: string): string {
  const schema = `"${schemaName}"`
  return `
    CREATE SCHEMA ${schema};
    CREATE TABLE ${schema}."user" (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL,
      image text,
      "createdAt" timestamp NOT NULL,
      "updatedAt" timestamp NOT NULL,
      "displayName" text,
      "freeUsageWeekStartedAt" timestamp
    );
    CREATE TABLE ${schema}."session" (
      id text PRIMARY KEY,
      "expiresAt" timestamp NOT NULL,
      token text NOT NULL UNIQUE,
      "createdAt" timestamp NOT NULL,
      "updatedAt" timestamp NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES ${schema}."user"(id) ON DELETE CASCADE
    );
    CREATE TABLE ${schema}."account" (
      id text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES ${schema}."user"(id) ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamp,
      "refreshTokenExpiresAt" timestamp,
      scope text,
      password text,
      "createdAt" timestamp NOT NULL,
      "updatedAt" timestamp NOT NULL
    );
    CREATE TABLE ${schema}."verification" (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      "expiresAt" timestamp NOT NULL,
      "createdAt" timestamp NOT NULL,
      "updatedAt" timestamp NOT NULL
    );
    CREATE TABLE ${schema}."challenge" (
      id text PRIMARY KEY,
      email text NOT NULL,
      "codeHash" text NOT NULL,
      "linkHash" text NOT NULL UNIQUE,
      "intentToken" text NOT NULL,
      "expiresAt" timestamp NOT NULL,
      attempts integer NOT NULL,
      locked boolean NOT NULL,
      consumed boolean NOT NULL
    );
    CREATE TABLE ${schema}."send_window" (
      email text PRIMARY KEY,
      "lastSentAt" timestamp NOT NULL,
      "hourStartedAt" timestamp NOT NULL,
      "hourCount" integer NOT NULL
    );
    CREATE TABLE ${schema}."tombstone" (
      "emailHash" text PRIMARY KEY,
      "freeUsageWeekStartedAt" timestamp NOT NULL,
      "deletedAt" timestamp NOT NULL
    );
  `
}
