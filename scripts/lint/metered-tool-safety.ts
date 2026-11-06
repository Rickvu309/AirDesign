import path from "node:path"
export function meteredToolSafetyHits(file:string,source:string){
  if(!/\.(?:ts|tsx|js|mjs)$/.test(file)||file.endsWith(".test.ts")||file.includes(`${path.sep}test${path.sep}`)||file.includes(`${path.sep}lint${path.sep}`))return []
  const hits:{line:number;reason:string}[]=[]
  function reject(pattern:RegExp,reason:string){for(const match of source.matchAll(pattern))hits.push({line:source.slice(0,match.index).split("\n").length,reason})}
  reject(/CREATE\s+TABLE[^"\n]*[,(]\s*offset\s+(?:integer|bigint|text)\b/gi,"sql-column-offset-is-reserved-use-position")
  if(!file.endsWith(`${path.sep}account${path.sep}deletion-store.ts`))reject(/\b(?:UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+usage_event\b/gi,"usage-events-are-append-only")
  reject(/\bclassName=["']ad-button\b(?![^"']*\bad-button-(?:dialog|settings|compact|sign-in)\b)[^"']*["']/g,"button-class-requires-an-explicit-size")
  if(file.endsWith(`${path.sep}studio${path.sep}vite.config.ts`)||file.endsWith(`${path.sep}agent-account${path.sep}fixture.mjs`))reject(/["']\/mcp["']\s*:(?![^\n]*\bchangeOrigin\s*:\s*false)[^\n]+/g,"mcp-proxy-must-preserve-public-host-with-changeOrigin-false")
  if(file.endsWith(`${path.sep}agent-account${path.sep}performance.mjs`))reject(/committed\.find\(entry=>entry\.payment\?\.id===receiptId\)/g,"payment-commit-probe-must-match-payment-and-receipt")
  if(file.includes(`${path.sep}mcp${path.sep}`)){
    reject(/!result\.content\.some\([^\n]+&&Buffer\.byteLength/g,"image-results-must-obey-an-envelope-limit")
    reject(/\.grantFixture\s*\(|\.usage\.reset\s*\(|\.usage\.configure\s*\(/g,"remote-tools-cannot-spend-or-configure-credits")
    reject(/identity\s*:\s*args\.|run\s*:\s*args\.|personId\s*:\s*args\./g,"derive-tool-authority-on-server")
  }
  if(file.endsWith(`${path.sep}db${path.sep}history-store.ts`))reject(/actor:\s*["']user-agent["']/g,"run-metering-must-use-server-actor")
  if(file.endsWith(`${path.sep}editor${path.sep}manual-editor.tsx`))reject(/if\(\(event\.metaKey\|\|event\.ctrlKey\)&&event\.key\.toLowerCase\(\)==="z"\)/g,"editor-undo-must-preserve-text-input-undo")
  if(file.endsWith(`${path.sep}server${path.sep}src${path.sep}main.ts`))reject(/outgoing\.arrayBuffer\(\)/g,"http-response-must-stream-agent-and-payment-events")
  return hits
}
