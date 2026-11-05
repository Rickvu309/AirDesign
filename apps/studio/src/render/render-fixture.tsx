import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { Button } from "@airdesign/ui"
import { flatten, parseDeck, validate } from "../../../../packages/deck/src/index.ts"
import type { Run, ChangeSet, Id } from "../../../../packages/deck/src/model.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { Slide, measure, waitForFonts } from "../../../../packages/render/src/index.ts"
import { commandId, execute, initialHistory, type CommandId } from "../../../../packages/change-log/src/index.ts"
import { hardDefects } from "../../../../packages/lint/src/hard-defects.ts"
import "./render-fixture.css"
export function RenderFixture() {
  const [deck, setDeck] = useState(() => fixtureDeck(300, new URLSearchParams(location.search).has("hundred") ? 100 : 1))
  const history = useRef(initialHistory(deck))
  const undo = useRef<CommandId[]>([]), redo = useRef<CommandId[]>([])
  const [json, setJson] = useState("")
  const [message, setMessage] = useState("")
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const viewport = useRef<HTMLDivElement>(null)
  const current = useRef(deck)
  current.current = deck
  const slide = deck.slides[0]!
  useEffect(() => { let active = true; waitForFonts(document).then(() => { if (active) setReady(true) }).catch(error => setMessage(String(error))); return () => { active = false } }, [deck])
  const commit = useCallback((changeSet: ChangeSet) => {
    const request = commandId(crypto.randomUUID())
    const result = execute(history.current, {id:request,kind:"edit",base:history.current.seq,run:null,changes:changeSet})
    if (result.receipt.kind === "applied") { history.current=result.history;undo.current.push(request);redo.current=[];current.current = result.history.deck; setDeck(result.history.deck); setMessage(`Applied version ${result.history.seq}`) }
    else setMessage(result.receipt.code)
  }, [])
  const historyText = useCallback((direction:"undo" | "redo") => {
    const source=direction === "undo" ? undo : redo, destination=direction === "undo" ? redo : undo
    const target=source.current.pop()
    if (!target) return
    const result=execute(history.current,{id:commandId(crypto.randomUUID()),kind:direction,target})
    if (result.receipt.kind === "applied") {destination.current.push(target);history.current=result.history;current.current=result.history.deck;setDeck(result.history.deck)}
    else {source.current.push(target);setMessage(result.receipt.code)}
  },[])
  const commitText = useCallback((id: Id, runs: [Run, ...Run[]]) => {
    const element = current.current.slides.flatMap(s => flatten(s.elements)).find(e => e.id === id)
    if (element?.kind !== "text") return
    commit({ changes: [{ kind: "set", target: id, value: { ...element, runs } }] })
  }, [commit])
  const pointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    const element = current.current.slides.flatMap(s => flatten(s.elements)).find(e => e.id === node.dataset.element)
    if (!element || event.button !== 0) return
    event.stopPropagation()
    setSelected(element.id)
    if (element.kind === "text") return
    const start = { x: event.clientX, y: event.clientY }
    node.setPointerCapture(event.pointerId)
    const move = (pointer: PointerEvent) => { node.style.transform = `translate(${(pointer.clientX - start.x) / zoomRef.current}px, ${(pointer.clientY - start.y) / zoomRef.current}px)` }
    const end = (pointer: PointerEvent) => {
      node.removeEventListener("pointermove", move)
      node.removeEventListener("pointerup", end)
      node.removeEventListener("pointercancel", cancel)
      node.style.transform = ""
      commit({ changes: [{ kind: "set", target: element.id, value: { ...element, box: { ...element.box, x: element.box.x + (pointer.clientX - start.x) / zoomRef.current, y: element.box.y + (pointer.clientY - start.y) / zoomRef.current } } }] })
    }
    const cancel = () => { node.style.transform = ""; node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", end); node.removeEventListener("pointercancel", cancel) }
    node.addEventListener("pointermove", move)
    node.addEventListener("pointerup", end)
    node.addEventListener("pointercancel", cancel)
  }, [commit])
  useEffect(() => {
    for (const node of document.querySelectorAll<HTMLElement>("[data-element]")) {
      const value = String(node.dataset.element === selected)
      if (node.dataset.selected !== value) node.dataset.selected = value
    }
  }, [selected, deck])
  async function inspect() {
    const root = viewport.current?.querySelector<HTMLElement>("[data-slide]")
    if (root) { const layout = await measure(root); setMessage(JSON.stringify({ layout, defects: hardDefects(slide, layout.filter(e => e.clippedText).map(e => e.id)) })) }
  }
  return <main className="render-fixture" data-ready={ready} data-deck-version={deck.version}>
    <h1>Canonical deck · render fixture</h1>
    <div className="render-controls">
      <span>{deck.slides.length} slides · {flatten(slide.elements).length} elements</span>
      <label>Zoom <input aria-label="Zoom" type="range" min="0.5" max="2" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <Button variant="secondary" size="compact" onPointerDown={event => event.preventDefault()} onClick={() => setPan(p => ({ x: p.x + 40, y: p.y + 20 }))}>Pan</Button>
      <Button variant="secondary" size="compact" onClick={inspect}>Measure and check</Button>
      <Button variant="secondary" size="compact" onClick={() => setJson(JSON.stringify(deck))}>Save deck JSON</Button>
      <Button variant="secondary" size="compact" onClick={() => { try { const loaded = parseDeck(JSON.parse(json)); validate(loaded); if (!loaded.slides.length) throw new Error("Fixture needs one slide"); setReady(false);history.current=initialHistory(loaded);undo.current=[];redo.current=[];current.current=loaded; setDeck(loaded); setMessage("Loaded saved deck") } catch (error) { setMessage(String(error)) } }}>Load saved deck</Button>
    </div>
    <div className="render-viewport" ref={viewport}><div className="render-stage" data-zoom={zoom} data-pan-x={pan.x} data-pan-y={pan.y} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, visibility: ready ? "visible" : "hidden" }}><Slide slide={slide} themes={deck.themes} commitText={commitText} historyText={historyText} onPointerDown={pointerDown} /></div></div>
    <label htmlFor="deck-json">Deck JSON</label><textarea id="deck-json" value={json} onChange={e => setJson(e.target.value)} />
    <pre role="status">{message}</pre>
  </main>
}
