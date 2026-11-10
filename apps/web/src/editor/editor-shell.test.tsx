import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditorShell } from "@/editor/editor-shell"
import { AgentComplete, AgentWorking } from "@/editor/screens/slide-views"

describe("editor shell", () => {
  it("shell shows the props it is given", () => {
    const markup = renderToStaticMarkup(<EditorShell title="Other deck" slideLabel="9" notes="Other notes" />)
    expect(markup).toContain("Other deck")
    expect(markup).toContain(">9<")
    expect(markup).toContain("Other notes")

    const working = renderToStaticMarkup(
      <EditorShell title="Other deck" slideLabel="9" notes="Other notes" run="working" />,
    )
    expect(working).toContain("Add speaker notes")
    expect(working).not.toContain("Other notes")
  })

  it("gallery screen keeps its copy", () => {
    const markup = renderToStaticMarkup(<AgentWorking />)
    expect(markup).toContain('font-medium text-foreground">Q3 Investor Update')
    expect(markup).toContain("Add speaker notes")

    const saved = renderToStaticMarkup(<AgentComplete />)
    expect(saved).toContain("Q3 Investor Update")
    expect(saved).toContain("Lead with the trend, then the Q3 number. Mention the two enterprise deals.")
    expect(saved).toContain('text-[length:var(--type-dense)] text-faint">3<')
  })
})
