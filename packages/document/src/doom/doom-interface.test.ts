import { expect, it } from "vitest"
import { doom } from "../index.js"

it("hands the doom core to callers through the package index as one namespace", () => {
  const { emptyDoom, applyEdit, invert, viewOf, readWrite, readEdit, isRefusal, nodeId, rev, accepts, props } = doom
  expect(typeof applyEdit).toBe("function")
  expect(typeof invert).toBe("function")
  expect(typeof viewOf).toBe("function")
  expect(typeof readWrite).toBe("function")
  expect(typeof readEdit).toBe("function")
  expect(emptyDoom.rev).toBe(rev(0))
  expect(isRefusal({ refused: "shape" })).toBe(true)
  expect(isRefusal(emptyDoom)).toBe(false)
  expect(nodeId("c:1")).toBe("c:1")
  expect(Object.keys(accepts)).toEqual(["deck", "slideRow", "slide", "frame", "shape"])
  expect(Object.keys(props)).toContain("box")
})

it("hands the agent's words to callers as functions that compile, read and print", () => {
  const {
    compileAgentChange,
    compileAgentEdit,
    readForAgent,
    readAgentChange,
    readAgentChanges,
    agentChangesSchema,
    textFromMarkdown,
    textToMarkdown,
  } = doom
  for (const each of [
    compileAgentChange,
    compileAgentEdit,
    readForAgent,
    readAgentChange,
    readAgentChanges,
    textFromMarkdown,
    textToMarkdown,
  ])
    expect(typeof each).toBe("function")
  expect(agentChangesSchema.required).toEqual(["changes"])
  expect(textToMarkdown(textFromMarkdown("**a**", "body"))).toBe("**a**")
})
