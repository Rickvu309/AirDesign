const unstorable = /\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

export function storableText(value: unknown): value is string {
  return typeof value === "string" && !unstorable.test(value)
}
