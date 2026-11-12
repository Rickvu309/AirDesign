import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, test, type Page } from "@playwright/test"

type Finding = { detector: string; selector: string; box: { width: number; height: number }; message: string }
type Scanned = { findings: Finding[]; used: number[] }
type Scanner = { scan: (page: Page, options?: object) => Promise<Scanned> }
const look = join(process.cwd(), ".agents/skills/verify-airdesign/look")
const tokens = { colors: ["rgb(34, 34, 34)", "rgb(255, 255, 255)"], sizes: ["14px"], radii: ["0px"], spaces: ["0px"] }

const cases = [
  {
    detector: "truncated-text",
    fires:
      '<p style="width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">You are offline. Edits are saved on this device.</p>',
    spares: '<p style="width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">You are offline.</p>',
  },
  {
    detector: "truncated-text",
    fires:
      '<p style="width:120px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">This sentence wraps over several lines.</p>',
    spares:
      '<p style="width:420px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">Short line.</p>',
  },
  {
    detector: "overflowing-text",
    fires:
      '<div data-table-cell style="width:160px;height:12px;overflow:hidden"><p style="margin:0;font-size:20px;line-height:24px">Cell text</p></div>',
    spares:
      '<div data-table-cell style="width:160px;height:30px;overflow:hidden"><p style="margin:0;font-size:20px;line-height:24px">Cell text</p></div>',
  },
  {
    detector: "overflowing-text",
    fires:
      '<div style="position:relative;width:400px"><p style="margin:0;height:20px;line-height:20px">First line of body text<br>runs under the next box</p><div style="position:absolute;left:0;top:22px;width:400px;height:30px;background:rgb(240,240,240)"></div></div>',
    spares:
      '<div style="position:relative;width:400px"><p style="margin:0;height:20px;line-height:20px">Body text that fits</p><div style="position:absolute;left:0;top:22px;width:400px;height:30px;background:rgb(240,240,240)"></div></div>',
  },
  {
    detector: "overflowing-text",
    fires:
      '<div style="position:relative;width:500px;height:80px"><span style="position:absolute;left:0;top:0;font-size:20px">50.6 9 3.06 4.99</span><span style="position:absolute;left:10px;top:6px;font-size:20px">Green: within 1%</span></div>',
    spares:
      '<div style="position:relative;width:500px;height:80px"><span style="position:absolute;left:0;top:0;font-size:20px">50.6 9 3.06 4.99</span><span style="position:absolute;left:0;top:30px;font-size:20px">Green: within 1%</span></div>',
  },
  {
    detector: "stacked-frames",
    fires:
      '<div style="margin:40px;width:360px;height:120px;box-shadow:0 0 0 2px rgb(45,111,205);position:relative"><div contenteditable="true" style="position:absolute;left:6px;top:3px;width:348px;height:114px;outline:1px solid rgba(80,120,220,0.5)">Hello</div></div>',
    spares:
      '<div style="margin:40px;width:360px;height:120px;box-shadow:0 0 0 2px rgb(45,111,205);position:relative"><div contenteditable="true" style="position:absolute;left:30px;top:30px;width:200px;height:40px">Hello</div></div>',
  },
  {
    detector: "empty-region",
    fires:
      '<aside style="width:360px;height:900px;background:white"><div role="log" style="height:860px"></div><p style="margin:0">Aira</p></aside>',
    spares:
      '<aside style="width:360px;height:900px;background:white"><div role="log" style="height:860px"><p>Ask Aira to change a slide, check a number or write notes.</p></div></aside>',
  },
  {
    detector: "internal-identifier",
    fires: '<div data-tool-state="done"><span>airdesign_edit_deck</span></div>',
    spares:
      '<div data-tool-state="done"><span>Edited the deck</span></div><code>airdesign_edit_deck</code><p>Address https://mcp.example.test/mcp_v1</p>',
  },
  {
    detector: "invisible-control",
    fires:
      '<div style="width:800px;height:450px;background:white;position:relative"><div contenteditable="true" style="position:absolute;left:60px;top:40px;width:668px;height:84px"></div></div>',
    spares:
      '<div style="width:800px;height:450px;background:white;position:relative"><div contenteditable="true" data-placeholder="Click to add title" style="position:absolute;left:60px;top:40px;width:668px;height:84px;outline:1px dashed rgb(160,160,160)"></div></div>',
  },
  {
    detector: "dead-control",
    fires: '<button type="button">Export</button>',
    spares: '<button type="button" onclick="this.dataset.done = 1">Export</button><a href="/trash">Trash</a>',
  },
  {
    detector: "text-contrast",
    fires: '<p style="color:rgb(180,180,180);background:white">Decks here are removed for good after 30 days.</p>',
    spares: '<p style="color:rgb(90,90,90);background:white">Decks here are removed for good after 30 days.</p>',
  },
  {
    detector: "focus-visible",
    fires: '<button id="go" style="outline:none;border:0;background:white;box-shadow:none">Export</button>',
    spares:
      '<style>#go:focus-visible{box-shadow:0 0 0 2px blue}</style><button id="go" style="outline:none;border:0;background:white">Export</button>',
  },
  {
    detector: "off-token",
    fires: '<nav style="font-size:17px;color:rgb(1,2,3)">Decks</nav>',
    spares: '<nav style="font-size:14px;color:rgb(34,34,34)">Decks</nav>',
  },
] as const

async function scanned(page: Page, body: string, options: object = {}): Promise<Scanned> {
  const { scan } = (await import(pathToFileURL(join(look, "scan.mjs")).href)) as Scanner
  await page.setContent(`<body style="margin:0;background:white;font:16px sans-serif">${body}</body>`)
  const go = page.locator("#go")
  if ((await go.count()) > 0) {
    await page.keyboard.press("Tab")
    await expect(go).toBeFocused()
  }
  return scan(page, {
    allow: [],
    scope: "fixture",
    identifiers: ["airdesign_edit_deck"],
    tokens,
    offToken: true,
    ...options,
  })
}

const of = (result: Scanned, detector: string) => result.findings.filter((finding) => finding.detector === detector)

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

for (const [index, { detector, fires, spares }] of cases.entries()) {
  test(`${detector} ${index}: fires on its fault and spares the near miss`, async ({ page }) => {
    const fired = of(await scanned(page, fires), detector)
    expect(fired, `${detector} should fire`).toHaveLength(1)
    expect(fired[0]?.selector).toBeTruthy()
    expect(fired[0]?.box.width).toBeGreaterThan(0)
    expect(of(await scanned(page, spares), detector), `${detector} should stay quiet`).toEqual([])
  })
}

test("off-token stays quiet unless asked", async ({ page }) => {
  expect(of(await scanned(page, cases.at(-1)?.fires ?? "", { offToken: false }), "off-token")).toEqual([])
})

test("an allow entry silences only its detector under its selector and reports that it was used", async ({ page }) => {
  const body = '<div id="tool"><span>airdesign_edit_deck</span></div><p style="color:rgb(200,200,200)">Faint words</p>'
  const allow = [
    { index: 0, page: "fixture", detector: "internal-identifier", selector: "#tool", reason: "A fixture." },
  ]
  const result = await scanned(page, body, { allow })
  expect(of(result, "internal-identifier")).toEqual([])
  expect(of(result, "text-contrast")).toHaveLength(1)
  expect(result.used).toEqual([0])
  const elsewhere = await scanned(page, body, { allow: [{ ...allow[0], page: "another-state" }] })
  expect(of(elsewhere, "internal-identifier")).toHaveLength(1)
  expect(elsewhere.used).toEqual([])
})

test("alike findings in repeated items collapse into one with a count", async ({ page }) => {
  const items = Array.from({ length: 4 }, () => '<li><span style="color:rgb(200,200,200)">Faint</span></li>').join("")
  const findings = of(await scanned(page, `<ul data-list>${items}</ul>`), "text-contrast")
  expect(findings).toHaveLength(1)
  expect(findings[0]).toMatchObject({ more: 3 })
})
