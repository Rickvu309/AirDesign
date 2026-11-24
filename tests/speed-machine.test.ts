import { readFileSync } from "node:fs"
import ts from "typescript-api"
import { expect, it } from "vitest"
import { checkPhaseSpeed } from "./browser/speed-machine"

it.each([
  {
    name: "two agent paint stalls after typing",
    samples: {
      cores: 48,
      waiting: [14],
      measuring: [
        5, 17, 56, 72, 56, 48, 23, 10, 13, 8, 56, 62, 13, 14, 15, 12, 11, 8, 13, 9, 12, 9, 9, 8, 7, 3, 6, 6, 12, 5, 7,
        13,
      ],
    },
    peak: 72,
    reading: 1.7402444444444436,
    limit: 1.2,
  },
  {
    name: "a busy isolated frame",
    samples: {
      cores: 48,
      waiting: [6],
      measuring: [
        9, 7, 11, 11, 9, 13, 14, 7, 8, 9, 8, 14, 8, 8, 54, 29, 21, 84, 8, 19, 6, 5, 7, 53, 58, 14, 19, 8, 16, 14, 15, 9,
        28, 11, 16,
      ],
    },
    peak: 84,
    reading: 1.3725555555555564,
    limit: 1.2,
  },
  {
    name: "the 10 ms thumbnail probe",
    samples: {
      cores: 48,
      waiting: [11],
      measuring: [
        5, 58, 92, 56, 10, 25, 88, 26, 5, 5, 4, 6, 6, 7, 33, 51, 4, 4, 4, 4, 3, 13, 6, 42, 6, 7, 7, 47, 7, 7, 11, 10, 8,
      ],
    },
    peak: 92,
    reading: 16.686375,
    limit: 8,
  },
])("reports speed not measured for $name using the saved typing samples", ({ samples, peak, reading, limit }) => {
  const guard = () => expect(reading).toBeLessThan(limit)
  const check = () => checkPhaseSpeed("typing", samples, guard)

  expect(check).toThrow(
    `machine oversubscribed during typing: max ${String(peak)} runnable on 48 cores; speed not measured`,
  )
  expect(check).toThrow(String(reading))
  expect(check).toThrow(String(limit))
})

it("keeps a passing guard successful when a measurement sample reaches the core count", () => {
  const samples = { cores: 48, waiting: [9], measuring: [15, 48] }
  expect(() => checkPhaseSpeed("typing", samples, () => expect(7).toBeLessThan(8))).not.toThrow()
})

it("keeps the original guard failure when only admission samples reached the core count", () => {
  const samples = { cores: 48, waiting: [57, 48, 9], measuring: [47, 20] }
  const failure = new Error("expected 9 ms to be less than 8 ms")
  const check = () =>
    checkPhaseSpeed("typing", samples, () => {
      throw failure
    })
  expect(check).toThrow(failure)
  expect(check).not.toThrow("speed not measured")
})

it("reports speed not measured when a failing guard has a sample exactly at the core count", () => {
  const samples = { cores: 48, waiting: [9], measuring: [15, 48] }
  const check = () => checkPhaseSpeed("typing", samples, () => expect(9).toBeLessThan(8))
  expect(check).toThrow("machine oversubscribed during typing: max 48 runnable on 48 cores; speed not measured")
})

it.each(["typeMeasureCalls", "typePreviewRedraws"])(
  "keeps the %s count assertion outside speed relabelling",
  (guard) => {
    const url = new URL("./browser/editor-speed.spec.ts", import.meta.url)
    const spec = ts.createSourceFile(url.pathname, readFileSync(url, "utf8"), ts.ScriptTarget.Latest, true)
    const enclosingSpeedChecks: boolean[] = []

    function visit(node: ts.Node, insideSpeedCheck: boolean) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        insideSpeedCheck ||= /^check\w*Speed$/.test(node.expression.text)
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        /^toBe(?:Greater|Less)ThanOrEqual$/.test(node.expression.name.text) &&
        node.arguments.some(
          (arg) =>
            ts.isPropertyAccessExpression(arg) && arg.expression.getText(spec) === "budget" && arg.name.text === guard,
        )
      ) {
        enclosingSpeedChecks.push(insideSpeedCheck)
      }
      ts.forEachChild(node, (child) => visit(child, insideSpeedCheck))
    }

    visit(spec, false)
    expect(enclosingSpeedChecks).toEqual([false])
  },
)
