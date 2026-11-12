import { limits } from "@airdesign/document"

const { body: bodyCap } = limits
const session = "airdesign.session"
const jsonType = "application/json"
const formType = "application/x-www-form-urlencoded"

export type Attack = {
  readonly name: string
  readonly body?: string | Buffer
  readonly type?: string
  readonly cookie?: string
  readonly query?: string
  readonly headers?: readonly string[]
  readonly chunked?: true
  readonly method?: string
  readonly absolute?: string
  readonly host?: string
}

export const attacks: readonly Attack[] = [
  { name: "no body" },
  { name: "not json", body: "{not json", type: jsonType },
  { name: "invalid utf-8", body: Buffer.from([0x7b, 0xff, 0xfe, 0x7d]), type: jsonType },
  { name: "a nul byte in the body", body: Buffer.from([0x7b, 0x00, 0x7d]), type: jsonType },
  { name: "json null", body: "null", type: jsonType },
  { name: "json true", body: "true", type: jsonType },
  { name: "json number", body: "0", type: jsonType },
  { name: "json string", body: '"text"', type: jsonType },
  { name: "json array", body: "[]", type: jsonType },
  { name: "json object", body: "{}", type: jsonType },
  { name: "deep arrays", body: `${"[".repeat(100_000)}${"]".repeat(100_000)}`, type: jsonType },
  { name: "deep objects", body: `${'{"a":'.repeat(50_000)}0${"}".repeat(50_000)}`, type: jsonType },
  { name: "a long string", body: JSON.stringify("x".repeat(900_000)), type: jsonType },
  { name: "a nul string", body: '"\\u0000"', type: jsonType },
  { name: "a lone surrogate", body: '"\\ud800"', type: jsonType },
  { name: "a proto key", body: '{"__proto__":{"deck":"x","email":"a@b.co"}}', type: jsonType },
  { name: "a constructor key", body: '{"constructor":{"prototype":{"deck":"x"}}}', type: jsonType },
  { name: "a number past safe", body: "9007199254740993", type: jsonType },
  { name: "a number past float", body: "1e400", type: jsonType },
  { name: "a form of nul", body: "%00=%00", type: formType },
  { name: "a form of bad escapes", body: "%=%E0%A4%A&grant_type=%ED%A0%80", type: formType },
  { name: "a form of duplicates", body: "token=a&token=b&grant_type=a&grant_type=b", type: formType },
  { name: "a bad percent cookie", cookie: `${session}=%E0%A4%A` },
  { name: "a lone percent cookie", cookie: `${session}=%` },
  { name: "a percent nul cookie", cookie: `${session}=%00` },
  { name: "a raw nul cookie", cookie: `${session}=a\u0000b` },
  { name: "a huge cookie", cookie: `${session}=${"x".repeat(9_000)}` },
  { name: "a cookie past the header limit", cookie: `${session}=${"x".repeat(70_000)}` },
  { name: "duplicate cookies", cookie: `${session}=a; ${session}=%E0%A4%A; ${session}=b` },
  { name: "cookies without names", cookie: "=;;=a;=%" },
  { name: "a content type of separators", body: "{}", type: ";;;" },
  { name: "a content type with no subtype", body: "{}", type: "application/" },
  { name: "a content type with a bad charset", body: "{}", type: "application/json; charset=nope" },
  { name: "a content type of control bytes", body: "{}", type: "\u0001\u007f" },
  { name: "a bad percent query", query: "?%" },
  { name: "a bad utf-8 query", query: "?token=%E0%A4%A" },
  { name: "a nul query", query: "?token=%00" },
  { name: "a lone surrogate query", query: "?token=%ED%A0%80" },
  { name: "a duplicate query", query: "?token=a&token=b" },
  { name: "a bare bearer", headers: ["authorization: Bearer"] },
  { name: "a nul bearer", headers: ["authorization: Bearer a\u0000b"] },
  { name: "a bad scheme", headers: ["authorization: Basic %"] },
  { name: "a bad origin", headers: ["origin: http://["] },
  { name: "the trace method", method: "TRACE" },
  { name: "the track method", method: "TRACK" },
  { name: "a method nobody serves", method: "PROPFIND" },
  { name: "an absolute target", absolute: "http://evil.example" },
  { name: "an absolute target with userinfo", absolute: "http://user:secret@evil.example" },
  { name: "a host with a port", host: "127.0.0.1:8080" },
  { name: "a host with a bad port", host: "127.0.0.1:port" },
  { name: "a host past the port range", host: "127.0.0.1:65536" },
  { name: "a host with userinfo", host: "user@127.0.0.1" },
  { name: "a host with a user and password", host: "user:pass@127.0.0.1" },
  { name: "a host with two at signs", host: "a@b@127.0.0.1" },
  { name: "an empty host", host: "" },
  { name: "a host with spaces", host: "127.0.0.1 evil" },
  { name: "a non-ascii host", host: "caf\u00e9.example" },
  { name: "an absolute target and a host with a port", absolute: "http://evil.example", host: "127.0.0.1:8080" },
  { name: "an absolute target to this host", absolute: "http://127.0.0.1", host: "127.0.0.1:8080" },
  { name: "a body over the cap", body: Buffer.alloc(bodyCap + 1, 0x78), type: jsonType },
  { name: "a chunked body over the cap", body: Buffer.alloc(bodyCap + 1, 0x78), type: jsonType, chunked: true },
]

export const hostileValues: readonly unknown[] = [
  null,
  true,
  -1,
  1.5,
  1e308,
  Number.MAX_SAFE_INTEGER + 2,
  "",
  "\u0000",
  "a\u0000b",
  "\ud800",
  "a\udc00b",
  "x".repeat(70_000),
  [],
  [[]],
  {},
  JSON.parse('{"__proto__":{"deck":"x"}}'),
]

export const hostileEscapes: readonly string[] = ["", "%00", "a%00b", "%ED%A0%80", "%", "%E0%A4%A", "x".repeat(70_000)]

export const leaks: readonly RegExp[] = [
  /\n\s+at /,
  /\bat [^\n]+:\d+:\d+/,
  /node_modules|node:internal|\/home\/|\/src\/|\.[cm]?[jt]s:\d/,
  /postgres:\/\//,
  /\b(select .+ from|insert into|delete from|update .+ set)\b/i,
  /syntax error at|invalid input syntax|invalid byte sequence|violates .+ constraint|unsupported unicode/i,
]
