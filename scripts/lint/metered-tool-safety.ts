import path from "node:path"
export function meteredToolSafetyHits(file:string,source:string){
  if(!/\.(?:ts|tsx|js|mjs)$/.test(file)||file.endsWith(".test.ts")||file.includes(`${path.sep}test${path.sep}`)||file.includes(`${path.sep}lint${path.sep}`))return []
  const hits:{line:number;reason:string}[]=[]
  function reject(pattern:RegExp,reason:string){for(const match of source.matchAll(pattern))hits.push({line:source.slice(0,match.index).split("\n").length,reason})}
  reject(/CREATE\s+TABLE[^"\n]*[,(]\s*offset\s+(?:integer|bigint|text)\b/gi,"sql-column-offset-is-reserved-use-position")
  reject(/\b(?:UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+usage_event\b/gi,"usage-events-are-append-only")
  reject(/\bclassName=["']ad-button\b(?![^"']*\bad-button-(?:dialog|settings|compact|sign-in)\b)[^"']*["']/g,"button-class-requires-an-explicit-size")
  if(file.endsWith(`${path.sep}studio${path.sep}vite.config.ts`))reject(/["']\/mcp["']\s*:(?![^\n]*\bchangeOrigin\s*:\s*false)[^\n]+/g,"mcp-proxy-must-preserve-public-host-with-changeOrigin-false")
  if(file.includes(`${path.sep}mcp${path.sep}`)){
    reject(/\.grantFixture\s*\(|\.usage\.reset\s*\(|\.usage\.configure\s*\(/g,"remote-tools-cannot-spend-or-configure-credits")
    reject(/identity\s*:\s*args\.|run\s*:\s*args\.|personId\s*:\s*args\./g,"derive-tool-authority-on-server")
  }
  return hits
}
