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

  it("shell left alone paints the sample panel and notes", () => {
    const markup = renderToStaticMarkup(<EditorShell title="Other deck" slideLabel="9" notes="Other notes" />)
    expect(markup).toContain("Your deck is ready. Eight slides, every number from your notes.")
    expect(markup).toContain("Q3 investor update")
    expect(markup).toContain("Ask Aira")
    expect(markup).toContain("stroke-dasharray")
    expect(markup).toContain("64%")
    expect(markup).toContain('aria-label="Panel"')
    expect(markup).toContain("h-12 items-center rounded-[var(--shape-card)] bg-line")
  })

  it("shell with no panel and no notes leaves them out and keeps Export", () => {
    const markup = renderToStaticMarkup(<EditorShell title="Other deck" slideLabel="9" panel="none" />)
    expect(markup).toContain("Other deck")
    expect(markup).toContain(">Export<")
    expect(markup.match(/<aside/g)).toHaveLength(1)
    for (const word of ["Your deck is ready", "Q3 investor update", "Ask Aira", "stroke-dasharray", "64%"]) {
      expect(markup).not.toContain(word)
    }
    expect(markup).not.toContain('aria-label="Panel"')
    expect(markup).not.toContain("h-12 items-center rounded-[var(--shape-card)] bg-line")
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
