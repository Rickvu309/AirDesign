import { chromium } from "playwright"
import { localStack } from "./local-stack.mjs"
import { runLanes } from "./scenarios.mjs"
const stack=await localStack()
const browser=await chromium.launch()
try {
  const result=await runLanes({browser,stack})
  process.stdout.write(JSON.stringify({head:result.head,lanes:result.receipts.map(({lane,verdict})=>({lane,verdict})),errors:result.errors})+"\n")
} finally {await browser.close();await stack.close()}
