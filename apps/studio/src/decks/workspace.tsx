import {useEffect,useState} from "react"
import {AlertDialog,Button,TextField,SegmentedControl,StatusTile,Icon,Dropdown,toast,copy,fillCopy} from "@airdesign/ui"
import type {DeckEntry} from "../../../../packages/catalog/src/index.ts"
import {ImportCard} from "../import/import-card.tsx"
import {ManualEditor} from "../editor/manual-editor.tsx"
import {api,createDeck,deckAction,listDecks} from "./catalog-client.ts"
import {DeckPreview} from "./deck-preview.tsx"
import {relativeTime} from "./relative-time.ts"

export function Workspace({startImport=false,search="",browse=new URLSearchParams(window.location.search).get("browse")==="all" ? "all" : "recent"}:{startImport?:boolean;search?:string;browse?:"recent"|"all"}) {
  const deck=/^\/deck\/([a-zA-Z][a-zA-Z0-9_-]{0,31})$/.exec(window.location.pathname)?.[1]
  return deck ? <ManualEditor deckId={deck}/> : <Home search={search} browse={browse} startImport={startImport}/>
}
function Home({startImport,search,browse}:{startImport:boolean;search:string;browse:"recent"|"all"}) {
  const [view,setView]=useState<"grid"|"list">("grid"),[importing,setImporting]=useState(startImport)
  const [trash]=useState(window.location.pathname==="/trash")
  const [decks,setDecks]=useState<DeckEntry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const [rename,setRename]=useState<DeckEntry|null>(null),[name,setName]=useState(""),[confirm,setConfirm]=useState<DeckEntry|"all"|null>(null)
  const [confirmedTrash,setConfirmedTrash]=useState<DeckEntry[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState("")
  async function refresh(){setDecks(await listDecks(trash,search));window.dispatchEvent(new Event("catalog-changed"))}
  useEffect(()=>{let stopped=false;setLoading(true);void listDecks(trash,search).then(value=>{if(!stopped){setDecks(value);setError("")}}).catch(failure=>{if(!stopped)setError(String(failure))}).finally(()=>{if(!stopped)setLoading(false)});return ()=>{stopped=true}},[trash,search])
  async function run(action:()=>Promise<unknown>,message:string){setBusy(true);setError("");try{await action();await refresh();setStatus(message)}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  async function add(title="Untitled deck",starter?:"welcome"){setBusy(true);try{const entry=await createDeck(sessionStorage.getItem("first-pending-request") ?? "",title,starter);window.location.assign(`/deck/${entry.id}`)}catch(failure){setError(String(failure));setBusy(false)}}
  async function move(entry:DeckEntry){await deckAction(entry.id,"trash");toast(`${entry.title} moved to Trash`,{action:{label:"Undo",onClick:()=>void run(()=>deckAction(entry.id,"restore"),"Deck restored")}})}
  const empty=!loading&&!search&&!trash&&decks.length===0
  const entries=[...decks].sort((a,b)=>b.updated-a.updated)
  return <section className="workspace-home" data-empty-account={empty} data-browse={trash ? "trash" : browse}>
    <header className="home-heading"><h1>{trash ? "Trash" : browse==="recent" ? "Recents" : "All decks"}</h1><div className="deck-heading-actions">{trash ? <Button size="dialog" variant="secondary" disabled={busy||!decks.length} onClick={()=>{setConfirmedTrash(decks);setConfirm("all")}}>Empty Trash</Button> : <><div className="home-new-deck"><Dropdown label="New deck" trigger={<><Icon name="plus"/>New deck</>}><button type="button" disabled={busy} onClick={()=>void add()}><Icon name="file"/>Blank deck</button><button type="button" onClick={()=>setImporting(true)}><Icon name="upload"/>Import PowerPoint</button></Dropdown></div><SegmentedControl label="Deck view" value={view} onChange={setView} items={[{value:"grid",label:"Grid view",icon:"grid"},{value:"list",label:"List view",icon:"list"}]}/></>}</div></header>
    {trash&&<p className="trash-description">Decks here are removed for good after 30 days.</p>}
    <p role="status" className="workspace-status">{loading ? "Opening your workspace…" : status}</p>
    {error&&<p role="alert">{error}</p>}
    {!loading&&!decks.length&&(search||trash)&&<section className="home-empty"><h2>{search ? "No decks found" : "Trash is empty"}</h2><p>{search ? "Try another name or a word from a slide." : "Decks you move to Trash will appear here."}</p></section>}
    {empty&&<div className="deck-grid deck-starters" aria-label="Your first deck starts here"><button type="button" className="deck-card deck-starter" disabled={busy} onClick={()=>void add("Scratchpad")}><span className="deck-card-details"><strong>Scratchpad</strong><span>Your first draft</span></span><span className="deck-preview"/></button><button type="button" className="deck-card deck-starter" disabled={busy} onClick={()=>void add("Welcome to AirDesign","welcome")}><span className="deck-card-details"><strong>Welcome to AirDesign</strong><span>A sample board proposal</span></span><span className="deck-preview"/></button></div>}
    <div className={trash||view==="grid" ? "deck-grid" : "deck-list"}>
      {!trash&&<ImportCard finished={refresh} choosing={importing} dismiss={()=>setImporting(false)}/>}
      {!trash&&view==="list"&&decks.length>0&&<div className="deck-table-heading" aria-hidden="true"><span>Name<Icon name="chevron"/></span><span>Edited<Icon name="chevron"/></span><span>Created<Icon name="chevron"/></span></div>}
      {entries.map(entry=><article className="deck-card" key={entry.id} data-starred={entry.starred}>
        <div className="deck-card-details"><h2><a href={`/deck/${entry.id}`}>{entry.title}</a></h2><p>{trash ? `Deleted ${relativeTime(entry.deletedAt ?? Date.now())}, ${Math.max(0,Math.ceil((30*86400000-Date.now()+(entry.deletedAt ?? 0))/86400000))} days left` : view==="grid" ? `Edited ${relativeTime(entry.updated)}` : relativeTime(entry.updated).replace(/^./,letter=>letter.toUpperCase())}</p></div>
        <a className="deck-cover" href={`/deck/${entry.id}`} aria-label={`Open ${entry.title}`}><DeckPreview entry={entry}/></a>
        {!trash&&<time className="deck-created" dateTime={new Date(entry.created||entry.updated).toISOString()}>{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(entry.created||entry.updated)}</time>}
        <div className="deck-card-actions">{trash ? <Button size="compact" variant="secondary" disabled={busy} onClick={()=>void run(()=>deckAction(entry.id,"restore"),"Deck restored")}>Restore</Button> : <><button className="deck-star" type="button" aria-label={`${entry.starred ? "Unstar" : "Star"} ${entry.title}`} aria-pressed={Boolean(entry.starred)} disabled={busy} onClick={()=>void run(()=>deckAction(entry.id,"star",{starred:!entry.starred}),entry.starred ? "Deck unstarred" : "Deck starred")}><Icon name="star"/></button><Dropdown label={`Actions for ${entry.title}`} trigger={<Icon name="more"/>}><button type="button" disabled={busy} onClick={()=>{setRename(entry);setName(entry.title)}}>Rename</button><button type="button" disabled={busy} onClick={()=>void run(()=>deckAction(entry.id,"duplicate",{requestId:crypto.randomUUID()}),"Independent copy created")}>Duplicate</button><button type="button" disabled={busy} onClick={()=>setConfirm(entry)}>Move to Trash</button></Dropdown></>}</div>
      </article>)}
    </div>
    <AlertDialog open={rename!==null} title="Rename deck" body={<TextField label="Deck name" value={name} enterKeyHint="done" onChange={event=>setName(event.target.value)}/>} onClose={()=>setRename(null)} secondary={{label:"Cancel"}} primary={{label:"Save name",onClick:()=>{if(rename&&name.trim()&&!busy)void run(async()=>{await deckAction(rename.id,"rename",{title:name});setRename(null)},"Deck renamed")}}}/>
    <AlertDialog icon={confirm==="all" ? <StatusTile kind="error"/> : undefined} open={confirm!==null} title={confirm==="all" ? fillCopy("trash.empty_title",{n:String(confirmedTrash.length)}) : "Move deck to Trash?"} body={confirm==="all" ? copy("trash.empty_body") : "You can restore this deck from Trash for 30 days."} onClose={()=>setConfirm(null)} secondary={{label:"Cancel"}} primary={{label:confirm==="all" ? copy("trash.empty_action") : "Move to Trash",danger:true,onClick:()=>{const target=confirm;if(target&&!busy)void run(async()=>{if(target==="all")await api("/api/catalog/trash",{confirm:"empty-trash",decks:confirmedTrash.map(({id,generation})=>({id,generation}))},"DELETE");else await move(target);setConfirm(null)},target==="all" ? "Trash emptied" : "Deck moved to Trash")}}}/>
  </section>
}
