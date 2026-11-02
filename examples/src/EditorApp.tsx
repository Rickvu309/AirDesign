import { useState } from "react";
import { Avatar, Button, ChatComposer, Dialog, Divider, Icon, IconButton, Input, NavRail, NavRailItem } from "@airdesign/ui";
import { AgentsPanel, AppMark, BottomToolbar, FilePanel, HelpButton, InsertsPanel, InspectorHead, MediaPanel, NAME, SlideInspector, SlideThumb } from "./parts";

export type Panel = "file" | "agents" | "inserts" | "media";
export interface EditorState {
  panel: Panel;
  canvas: "slide" | "overview";
  zoom: string;
  /** Docked inspector on the right, a floating card, or none (header floats top right). */
  inspector: "docked" | "floating" | "none";
  header: "docked" | "floating";
  overlay?: "start" | "share";
  shapes?: boolean;
  slides: number;
  selected?: number[];
  empty?: boolean;
}

export function Editor({ initial }: { initial: EditorState }) {
  const [s, setS] = useState(initial);
  const [shareOpen, setShareOpen] = useState(initial.overlay === "share");
  const [startOpen, setStartOpen] = useState(initial.overlay === "start");
  const set = (p: Partial<EditorState>) => setS((o) => ({ ...o, ...p }));
  const panelWide = s.panel !== "file";
  return (
    <div className="ed" data-wide={panelWide || undefined}>
      <NavRail label="Editor" className="ed__rail">
        <AppMark />
        <Divider style={{ width: 32 }} />
        <NavRailItem icon="file" active={s.panel === "file"} onClick={() => set({ panel: "file" })}>File</NavRailItem>
        <NavRailItem icon="sparkle" active={s.panel === "agents"} onClick={() => set({ panel: "agents" })}>Agents</NavRailItem>
        <NavRailItem icon="add-circle" active={s.panel === "inserts" || s.panel === "media"} onClick={() => set({ panel: "inserts" })}>Inserts</NavRailItem>
      </NavRail>

      {s.canvas === "overview" && s.header === "floating" && s.panel === "file" ? null : (
        <aside className="ed__left" aria-label="Panel">
          {s.panel === "file" && <FilePanel slides={s.empty ? 0 : 1} />}
          {s.panel === "agents" && <AgentsPanel />}
          {s.panel === "inserts" && <InsertsPanel onOpen={(id) => id === "media" && set({ panel: "media" })} />}
          {s.panel === "media" && <MediaPanel slideView={s.canvas === "slide"} />}
        </aside>
      )}

      <main className="ed__main" data-overview={s.canvas === "overview" || undefined}>
        {s.header === "floating" && s.canvas === "overview" && s.panel === "file" && (
          <div className="float float--head"><button className="lp__title">Untitled<Icon name="chevron-down-small" size={16} /></button><Button size="sm" iconStart="plus">New slide</Button><IconButton icon="slide-view" label="Slide view" size="sm" /><IconButton icon="present" label="Present" size="sm" /></div>
        )}
        {s.inspector === "none" && (
          <div className="float float--top"><span className="insp__avatar"><Avatar name={NAME} size={24} /><Icon name="chevron-down-small" size={14} /></span><Button size="sm" variant="ghost" className="zoomtag" iconEnd="chevron-down">{s.zoom}</Button><IconButton icon="play" label="Present" size="sm" /><Button size="sm" variant="primary" onClick={() => setShareOpen(true)}>Share</Button></div>
        )}

        {s.canvas === "slide" ? (
          <div className="slide-view">
            <div className="slide-view__stage">{!s.empty && s.inspector !== "none" && <div className="bigslide"><h1>Slide Deck Title</h1><p>This is just the beginning of something big.</p></div>}</div>
            {!s.empty && s.inspector === "docked" && (
              <div className="notes"><div className="notes__grip" /><div className="notes__box"><span>Add presenter notes...</span><Button size="sm" variant="ghost" iconStart="text">Start with a draft <b>AI</b></Button></div></div>
            )}
            {s.inspector === "none" && <div className="slide-view__single"><span className="slide-view__n">3</span></div>}
          </div>
        ) : (
          <div className="overview" aria-label="Slides overview">
            {[1, 2, 3].slice(0, s.slides).map((n) => (
              <div key={n} className="ov" data-selected={s.selected?.includes(n) || undefined}>
                <span className="ov__n">{n}</span><SlideThumb n={undefined} empty={n !== 1} />
              </div>
            ))}
            
          </div>
        )}

        <BottomToolbar shapes={s.shapes} onShapes={() => set({ shapes: !s.shapes })} mediaActive={s.panel === "media"} />
        <HelpButton />
      </main>

      {s.inspector !== "none" && (
        <aside className="ed__insp" data-floating={s.inspector === "floating" || undefined} aria-label="Inspector">
          <InspectorHead zoom={s.zoom} floating={s.inspector === "floating"} />
          {s.empty ? <div className="insp__empty"><span><Icon name="cursor" size={18} /></span><b>No element selected</b><p>Select an element on your slide to inspect and edit its properties</p></div> : <SlideInspector n={s.canvas === "overview" ? 3 : 1} withColors={s.canvas === "slide"} ai={s.canvas === "slide"} />}
        </aside>
      )}

      <Dialog open={startOpen} onClose={() => setStartOpen(false)} title={<span className="start__title"><span className="start__app"><Icon name="present" size={16} /></span>Getting started</span>} className="start" initialFocus="dialog">
        <div className="start__body">
          <h2>What would you like to present?</h2>
          <ChatComposer value="" onValueChange={() => {}} onSend={() => {}} placeholder="Add your thoughts, notes, or outline to start building your first draft" label="Describe your deck" tools={<><IconButton icon="plus" label="Add context" size="sm" /><Button size="sm" variant="secondary" iconStart="palette">Select deck template</Button></>} />
          <div className="start__cards">
            <button className="start__card"><b>Start from scratch</b><span>Build using empty slides</span><i className="ill ill--a" /></button>
            <button className="start__card"><b>Use a template</b><span>Browse AirDesign and team-made decks</span><i className="ill ill--b" /></button>
          </div>
        </div>
      </Dialog>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} title="Share these slides" className="share" initialFocus="dialog">
        <div className="share__card">
          <div className="share__head"><strong>Share these slides</strong><Button size="sm" variant="ghost" iconStart="link" iconEnd="chevron-down" className="orange">Copy link</Button><IconButton icon="close" label="Close" size="sm" onClick={() => setShareOpen(false)} /></div>
          <div className="share__row"><Input label="Invite emails" placeholder="Add comma separated emails to invite" /><Button variant="primary" disabled>Invite</Button></div>
          <div className="share__sub">Who has access</div>
          <button className="share__access"><Icon name="globe" /><span>Anyone</span><em>can view <Icon name="chevron-right" size={12} /></em></button>
          <div className="share__access"><Avatar name={NAME} size={24} /><span>{NAME} <small>(you)</small></span><em>owner</em></div>
        </div>
        <div className="share__card share__menu">
          <button><Icon name="layout" /><span>Publish template</span><Icon name="chevron-right" size={12} /></button>
          <button><Icon name="play" /><span>Copy presentation link</span></button>
          <button><Icon name="code" /><span>Get embed code</span><Icon name="chevron-right" size={12} /></button>
          <button className="share__cta"><Icon name="upload" /><span>Ready to share with your team?</span><b>Move to folder</b></button>
        </div>
      </Dialog>
    </div>
  );
}
