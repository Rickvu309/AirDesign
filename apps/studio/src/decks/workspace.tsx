import { useEffect,useState } from "react"
import { AlertDialog,Button,TextField } from "@airdesign/ui"
import type { DeckEntry } from "../../../../packages/catalog/src/index.ts"
import { ImportCard } from "../import/import-card.tsx"
import { ManualEditor } from "../editor/manual-editor.tsx"
import { api,createDeck,deckAction,listDecks } from "./catalog-client.ts"

export function Workspace() {
  const deck=/^\/deck\/([a-zA-Z][a-zA-Z0-9_-]{0,31})$/.exec(window.location.pathname)?.[1]
  return deck ? <ManualEditor deckId={deck}/> : <Home/>
}
function Home() {
  const [trash,setTrash]=useState(window.location.pathname==="/trash"),[search,setSearch]=useState("")
  const [decks,setDecks]=useState<DeckEntry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const [rename,setRename]=useState<DeckEntry|null>(null),[name,setName]=useState(""),[confirm,setConfirm]=useState<DeckEntry|"all"|null>(null)
  const [busy,setBusy]=useState(false),[status,setStatus]=useState("")
  async function refresh() {setDecks(await listDecks(trash,search))}
  useEffect(()=>{let stopped=false;setLoading(true);void listDecks(trash,search).then(value=>{if(!stopped){setDecks(value);setError("")}}).catch(failure=>{if(!stopped)setError(String(failure))}).finally(()=>{if(!stopped)setLoading(false)});return ()=>{stopped=true}},[trash,search])
  async function run(action:()=>Promise<unknown>,message:string) {setBusy(true);setError("");try{await action();await refresh();setStatus(message)}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  async function add() {setBusy(true);try{const entry=await createDeck(sessionStorage.getItem("first-pending-request") ?? "");window.location.assign(`/deck/${entry.id}`)}catch(failure){setError(String(failure));setBusy(false)}}
  return <section className="workspace-home">
    <nav className="home-nav" aria-label="Workspace"><p className="home-workspace-label">My workspace</p><Button variant={trash ? "secondary" : "primary"} size="compact" onClick={()=>{setTrash(false);history.replaceState(null,"","/")}}>Home</Button><Button variant={trash ? "primary" : "secondary"} size="compact" onClick={()=>{setTrash(true);history.replaceState(null,"","/trash")}}>Trash</Button></nav>
    <header className="home-heading"><div><p className="workspace-eyebrow">YOUR WORKSPACE</p><h1>{trash ? "Trash" : !decks.length&&!search ? "No decks yet" : "Your decks"}</h1><p>{trash ? "Restore a deck within 30 days. After that, it is permanently deleted." : "From a first thought to a clear story."}</p></div>{trash ? <Button size="dialog" variant="secondary" disabled={busy||!decks.length} onClick={()=>setConfirm("all")}>Empty Trash</Button> : <div className="home-actions"><Button size="dialog" variant="primary" disabled={busy} onClick={()=>void add()}>+ New deck</Button><a className="workspace-import-link" href="#import-heading">Import PowerPoint</a></div>}</header>
    <TextField label="Search decks" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search names and slide text"/>
    <p role="status" className="workspace-status">{loading ? "Opening your workspace…" : status}</p>
    {error && <p role="alert">{error}</p>}
    {!loading&&!decks.length && <section className="home-empty"><div className="empty-deck-mark" aria-hidden="true">▤</div><h2>{search ? "No decks found" : trash ? "Trash is empty" : "Your first deck starts here"}</h2><p>{search ? "Try another name or a word from a slide." : trash ? "Decks you move to Trash will appear here." : "Start with an idea, or bring a PowerPoint you already have."}</p>{!trash&&!search && <Button size="dialog" variant="primary" disabled={busy} onClick={()=>void add()}>Create a deck</Button>}</section>}
    {!trash && <ImportCard finished={refresh}/>}
    <div className="deck-grid">{decks.map(entry=><article className="deck-card" key={entry.id}><a className="deck-cover" href={`/deck/${entry.id}`} aria-label={`Open ${entry.title}`}><span>{entry.slides ? `${entry.slides} slides` : "A fresh start"}</span><strong>{entry.title}</strong></a><div className="deck-card-details"><h2><a href={`/deck/${entry.id}`}>{entry.title}</a></h2><p>{trash ? `Deleted ${new Date(entry.deletedAt ?? 0).toLocaleDateString()}` : `Edited ${new Date(entry.updated).toLocaleDateString()}`}</p><div className="deck-card-actions">{trash ? <Button size="compact" variant="secondary" disabled={busy} onClick={()=>void run(()=>deckAction(entry.id,"restore"),"Deck restored")}>Restore</Button> : <><Button size="compact" variant="secondary" disabled={busy} onClick={()=>{setRename(entry);setName(entry.title)}}>Rename</Button><Button size="compact" variant="secondary" disabled={busy} onClick={()=>void run(()=>deckAction(entry.id,"duplicate",{requestId:crypto.randomUUID()}),"Independent copy created")}>Duplicate</Button><Button size="compact" variant="secondary" disabled={busy} onClick={()=>setConfirm(entry)}>Move to Trash</Button></>}</div></div></article>)}</div>
    {rename && <section className="rename-form" aria-label="Rename deck"><h2>Rename deck</h2><TextField label="Deck name" value={name} onChange={event=>setName(event.target.value)}/><Button size="dialog" variant="primary" disabled={busy||!name.trim()} onClick={()=>void run(async()=>{await deckAction(rename.id,"rename",{title:name});setRename(null)},"Deck renamed")}>Save name</Button><Button size="dialog" variant="secondary" onClick={()=>setRename(null)}>Cancel</Button></section>}
    <AlertDialog open={confirm!==null} title={confirm==="all" ? "Empty Trash?" : "Move deck to Trash?"} body={confirm==="all" ? "Permanently delete every deck in Trash. This cannot be undone." : "You can restore this deck from Trash for 30 days."} onClose={()=>setConfirm(null)} secondary={{label:"Cancel"}} primary={{label:confirm==="all" ? "Delete permanently" : "Move to Trash",danger:true,onClick:()=>{const target=confirm;if(target)void run(async()=>{if(target==="all")await api("/api/catalog/trash",{confirm:"empty-trash"},"DELETE");else await deckAction(target.id,"trash");setConfirm(null)},target==="all" ? "Trash emptied" : "Deck moved to Trash")}}}/>
  </section>
}
