const disposableSchemaName = /^ns_[0-9a-f]{16}$/

export function dropDisposableSchemaSql(schemaName: string): string {
  if (!disposableSchemaName.test(schemaName)) {
    throw new Error("refusing-to-drop-schema")
  }
  return `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`
}
