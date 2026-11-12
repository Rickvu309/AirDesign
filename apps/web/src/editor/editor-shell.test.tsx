import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditorShell, type EditorDeck } from "@/editor/editor-shell"
import { EditorView } from "@/editor/screens/editor-view"
import { AgentComplete, AgentWorking, DesignPanelScreen } from "@/editor/screens/slide-views"

const sampleWords = [
  "Your deck is ready",
  "Q3 investor update",
  "Ask Aira",
  "stroke-dasharray",
  "64%",
  "Opening",
  "Revenue grew",
  'aria-label="Panel"',
  "h-12 items-center rounded-[var(--shape-card)] bg-line",
]

const deck: EditorDeck = {
  slides: { count: 2, current: 0, onSelect: () => undefined, thumbHeight: 101, thumb: () => null },
  size: { width: 12_192_000, height: 6_858_000 },
  slide: (width) => <div data-real-slide={width} />,
  onExport: () => undefined,
  undo: {
    undoLabel: "Undo",
    redoLabel: "Redo",
    canUndo: false,
    canRedo: false,
    onUndo: () => undefined,
    onRedo: () => undefined,
  },
}

function disabledLabels(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*>/g)]
    .map((tag) => tag[0])
    .filter((tag) => tag.includes('disabled=""'))
    .map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1] ?? "")
}

describe("editor shell", () => {
  it("shell shows the props it is given", () => {
    const markup = renderToStaticMarkup(<EditorShell title="Other deck" slideLabel="9" notes="Other notes" />)
    expect(markup).toContain("Other deck")
    expect(markup).toContain('data-slide-label="true">9<')
    expect(markup).toContain("Other notes")

    const working = renderToStaticMarkup(
      <EditorShell title="Other deck" slideLabel="9" notes="Other notes" run="working" />,
    )
    expect(working).toContain("Add speaker notes")
    expect(working).not.toContain("Other notes")
  })

  it("a screen paints the sample panel under the panel head, and the shell alone leaves the panel body empty", () => {
    const markup = renderToStaticMarkup(<EditorView title="Other deck" slideLabel="9" notes="Other notes" />)
    expect(markup).toContain("Your deck is ready. Eight slides, every number from your notes.")
    expect(markup).toContain("Q3 investor update")
    expect(markup).toContain("Ask Aira")
    expect(markup).toContain("stroke-dasharray")
    expect(markup).toContain("64%")
    expect(markup).toContain('aria-label="Panel"')

    const design = renderToStaticMarkup(<DesignPanelScreen />)
    expect(design).toContain("Background")
    expect(design).not.toContain("Ask Aira")

    const alone = renderToStaticMarkup(<EditorShell title="Other deck" slideLabel="9" />)
    expect(alone.match(/<aside/g)).toHaveLength(2)
    expect(alone).toContain(">Export<")
    expect(alone).not.toContain("Ask Aira")
    expect(alone).not.toContain('aria-label="Panel"')
  })

  it("shell with a real deck shows no sample content, reads its zoom, and turns off the tools that do not work yet", () => {
    const markup = renderToStaticMarkup(<EditorShell title="Real deck" slideLabel="1" deck={deck} />)
    expect(markup).toContain("Real deck")
    expect(markup).toContain(">Export<")
    expect(markup).toContain('data-real-slide="800"')
    expect(markup).toContain(">63%<")
    expect(markup).toContain("New slide")
    expect(markup).toContain('aria-label="Add slide"')
    expect(markup.match(/data-slide-entry=/g)).toHaveLength(2)
    expect(markup.match(/<aside/g)).toHaveLength(2)
    for (const word of sampleWords) expect(markup).not.toContain(word)
    expect(disabledLabels(markup)).toEqual(["Grid", "text", "shape", "image", "actions", "Undo", "Redo"])
  })

  it("names the edit the undo and redo buttons turn back once there is one", () => {
    const undo = { ...deck.undo, undoLabel: "Undo move", redoLabel: "Redo delete slide", canUndo: true, canRedo: true }
    const markup = renderToStaticMarkup(<EditorShell title="Real deck" slideLabel="1" deck={{ ...deck, undo }} />)
    expect(markup).toContain('aria-label="Undo move"')
    expect(markup).toContain('aria-label="Redo delete slide"')
    expect(disabledLabels(markup)).toEqual(["Grid", "text", "shape", "image", "actions"])
  })

  it("gallery screen keeps its copy", () => {
    const markup = renderToStaticMarkup(<AgentWorking />)
    expect(markup).toContain('font-medium text-foreground">Q3 Investor Update')
    expect(markup).toContain("Add speaker notes")

    const saved = renderToStaticMarkup(<AgentComplete />)
    expect(saved).toContain("Q3 Investor Update")
    expect(saved).toContain("Lead with the trend, then the Q3 number. Mention the two enterprise deals.")
    expect(saved).toContain('text-[length:var(--type-dense)] text-faint" data-slide-label="true">3<')
    expect(disabledLabels(saved)).toEqual([])
  })
})
