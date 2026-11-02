import { useState, type ReactNode } from "react";
import { Avatar, Badge, Button, ChatComposer, Divider, Icon, IconButton, Input, Select, Tabs, Toolbar, ToolbarGroup, ToolbarSeparator, type IconName } from "@airdesign/ui";

export const NAME = "Ada Lovelace";

export function HelpButton() {
  return <IconButton className="help" icon="help" label="Help" variant="secondary" />;
}

export function AppMark({ size = 24 }: { size?: number }) {
  return (
    <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="AirDesign">
        <path d="M13 57l19-50 19 50" fill="none" stroke="currentColor" strokeWidth={3.063} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function SlideThumb({ title = "Slide Deck Title", sub = true, selected, n, empty }: { title?: string; sub?: boolean; selected?: boolean; n?: number; empty?: boolean }) {
  return (
    <div className="thumb" data-selected={selected || undefined}>
      {n !== undefined && <span className="thumb__n">{n}</span>}
      {!empty && <div className="thumb__body"><b>{title}</b>{sub && <i />}</div>}
    </div>
  );
}

/* ---------- Left panels ---------- */
export function PanelHeader({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  return (
    <div className="lp__head">
      <div><button className="lp__title">{title}<Icon name="chevron-down-small" size={16} /></button>{subtitle && <div className="lp__sub">{subtitle}</div>}</div>
      {trailing}
    </div>
  );
}

export function FilePanel({ slides }: { slides: number }) {
  return (
    <>
      <PanelHeader title="Untitled" subtitle="Drafts" trailing={<IconButton icon="grid" label="Overview" size="sm" />} />
      <Divider />
      <div className="lp__bar"><Button className="grow" size="sm" iconEnd="chevron-down">New slide</Button><IconButton icon="plus" label="Add blank slide" size="sm" variant="secondary" /></div>
      <ol className="lp__slides">
        {Array.from({ length: slides }, (_, i) => <li key={i}><span className="lp__no">{i + 1}</span><SlideThumb selected={i === 0} /></li>)}
      </ol>
    </>
  );
}

export function AgentsPanel() {
  const [draft, setDraft] = useState("");
  const items: { icon: IconName; label: string }[] = [
    { icon: "palette", label: "Improve the deck" }, { icon: "add-circle", label: "Add to the deck" }, { icon: "text", label: "Prepare to present" }, { icon: "list", label: "Understand the deck" },
  ];
  return (
    <>
      <PanelHeader title="Untitled" subtitle="Drafts" trailing={<IconButton icon="grid" label="Overview" size="sm" />} />
      <Divider />
      <div className="lp__chat"><div><div className="lp__chat-title">New chat</div><div className="lp__sub">Shared</div></div><Badge>Beta</Badge><IconButton icon="more" label="Chat options" size="sm" /></div>
      <Divider />
      <div className="agents">
        <span className="agents__badge"><Icon name="actions" size={22} /></span>
        <h2>What do you want to do?</h2>
        <div className="agents__list">{items.map((i) => <Button key={i.label} variant="secondary" iconStart={i.icon} iconEnd="chevron-down" className="row">{i.label}</Button>)}</div>
      </div>
      <ChatComposer className="agents__composer" value={draft} onValueChange={setDraft} onSend={() => setDraft("")} placeholder="Ask for changes" label="Ask for changes" tools={<><IconButton icon="plus" label="Add context" size="sm" /><IconButton icon="palette" label="Template" size="sm" /><IconButton icon="mic" label="Dictate" size="sm" className="mic" /></>} />
    </>
  );
}

const tiles: { label: string; icon: IconName; bg: string; fg: string }[] = [
  { label: "Text", icon: "text", bg: "#b9e0ff", fg: "#0d99ff" }, { label: "Media", icon: "image", bg: "#ffbdf2", fg: "#ff58ae" }, { label: "Shapes", icon: "shapes", bg: "#b6ecf7", fg: "#0a8aa6" },
  { label: "Prototypes", icon: "layout", bg: "#b4b2ff", fg: "#3d38f5" }, { label: "Interactive", icon: "hand", bg: "#ffd966", fg: "#d98a00" }, { label: "Libraries", icon: "resources", bg: "#b9ebc6", fg: "#1a9d45" },
];

export function InsertsPanel({ onOpen }: { onOpen?: (id: string) => void }) {
  return (
    <>
      <PanelHeader title="Untitled" subtitle="Drafts" trailing={<IconButton icon="slide-view" label="Slide view" size="sm" />} />
      <Divider />
      <div className="lp__title2">Inserts</div>
      <Divider />
      <div className="inserts">
        <div className="inserts__rows">{(["table", "code", "slide-number"] as const).map((n) => <button key={n} className="inserts__row"><Icon name={n} size={18} />{{ table: "Table", code: "Code block", "slide-number": "Slide number" }[n]}</button>)}</div>
        {tiles.map((t) => (
          <button key={t.label} className="inserts__tile" onClick={() => onOpen?.(t.label.toLowerCase())}>
            <span className="tile" style={{ background: t.bg }}><span style={{ color: t.fg }}><Icon name={t.icon} size={18} /></span></span>{t.label}
          </button>
        ))}
      </div>
    </>
  );
}

const heights = [200, 200, 200, 200, 76, 200, 148, 120];
const tones = ["#2c3a2e", "#5b6b6a", "#26364a", "#7d8f6f", "#d9a95b", "#8c6a4a", "#c7b8a4", "#6d7a8a"];
export function MediaPanel({ slideView }: { slideView?: boolean }) {
  return (
    <>
      <PanelHeader title="Untitled" subtitle="Drafts" trailing={<IconButton icon={slideView ? "slide-view" : "grid"} label="View" size="sm" />} />
      <Divider />
      <div className="media__top"><IconButton icon="chevron-left" label="Back" size="sm" /><span className="lp__title2 plain">Media</span></div>
      <div className="media__search"><Input label="Search images" startIcon="search" placeholder="Search images" /></div>
      <Divider />
      <div className="media__grid-wrap">
        <div className="lp__sub up">Unsplash</div>
        <div className="media__grid">
          {[0, 1].map((col) => (
            <div key={col} className="media__col">
              {heights.filter((_, i) => i % 2 === col).map((h, i) => <button key={i} aria-label={`Photo ${col * 4 + i + 1}`} className="media__item" style={{ height: h, background: `linear-gradient(160deg, ${tones[(col * 4 + i) % tones.length]}, ${tones[(col * 4 + i + 3) % tones.length]})` }} />)}
            </div>
          ))}
        </div>
      </div>
      <Divider />
      <div className="media__actions"><Button size="sm" iconStart="image" className="row center">Make an image</Button><Button size="sm" iconStart="upload" className="row center">Upload image or video</Button></div>
    </>
  );
}

/* ---------- Inspector ---------- */
export function InspectorHead({ zoom, floating, onShare }: { zoom: string; floating?: boolean; onShare?: () => void }) {
  return (
    <div className="insp__head" data-floating={floating || undefined}>
      <div className="insp__row">
        <span className="insp__avatar"><Avatar name={NAME} size={24} /><Icon name="chevron-down-small" size={14} /></span>
        <span className="grow" />
        <IconButton icon="play" label="Present" size="sm" iconSize={18} />
        <Button size="sm" variant="primary" className="insp__share" onClick={onShare}>Share</Button>
      </div>
      <div className="insp__row">
        <Tabs label="Panel" defaultValue="design" items={[{ id: "design", label: "Design" }, { id: "animate", label: "Animate" }]} />
        <span className="grow" />
        <Button size="sm" variant="ghost" className="zoomtag" iconEnd="chevron-down">{zoom}</Button>
      </div>
    </div>
  );
}

export function SlideInspector({ n, withColors, ai }: { n: number; withColors?: boolean; ai?: boolean }) {
  const [mode, setMode] = useState("solid");
  return (
    <div className="insp__body">
      <div className="insp__sec insp__sec--slide">
        <h2>Slide {n}</h2>{ai && <IconButton icon="sparkle" label="Edit with AI" size="sm" />}
      </div>
      <div className="insp__sec insp__sec--template">
        <div className="insp__sec--row">
          <span className="insp__sec-title"><Icon name="chevron-right" size={14} /><span>Template style</span></span>
          {ai && <IconButton icon="adjust" label="Template options" size="sm" />}
        </div>
        <button className="style"><span className="style__sw"><i style={{ background: "#b5b5b5" }} /><i style={{ background: "#4f8a99" }} /><i style={{ background: "#3d38f5" }} /></span><span><b>Light slides</b><small>Inter</small></span></button>
      </div>
      <div className="insp__sec insp__sec--bg">
        <div className="insp__sec--row">
          <span className="insp__sec-title"><Icon name="chevron-right" size={14} /><span>Background</span></span>
        </div>
        <div className="seg" role="group" aria-label="Background type">
          {([["solid", "frame"], ["texture", "palette"], ["image", "image"]] as const).map(([id, icon]) => <IconButton key={id} icon={icon} label={id} size="sm" variant="ghost" pressed={mode === id} onClick={() => setMode(id)} />)}
        </div>
        <Button variant="secondary" size="sm" iconEnd="chevron-down" className="row"><i className="chip" />White</Button>
      </div>
      {withColors && (
        <div className="insp__sec insp__sec--colors">
          <div className="insp__sec--row">
            <span className="insp__sec-title"><Icon name="chevron-right" size={14} /><span>Selection colors</span></span>
          </div>
          <div className="colors"><span><i className="chip" style={{ background: "#000" }} />Black</span><span><i className="chip" />White</span></div>
        </div>
      )}
    </div>
  );
}

/* ---------- Canvas pieces ---------- */
export function BottomToolbar({ shapes, onShapes, mediaActive }: { shapes?: boolean; onShapes?: () => void; mediaActive?: boolean }) {
  return (
    <div className="bottom">
      {shapes && <ShapesTray />}
      <Toolbar label="Tools" className="ad-toolbar">
        <ToolbarGroup>
          <IconButton iconSize={18} icon="cursor" label="Move" variant={shapes || mediaActive ? "ghost" : "primary"} className={shapes || mediaActive ? "" : "tool-active"} />
          <IconButton iconSize={18} icon="text" label="Text" />
          <IconButton iconSize={18} icon="image" label="Image and video" variant={mediaActive ? "primary" : "ghost"} className={mediaActive ? "tool-active" : ""} />
          <IconButton iconSize={18} icon="shapes" label="Shapes" variant={shapes ? "primary" : "ghost"} className={shapes ? "tool-active" : ""} onClick={onShapes} />
          <IconButton iconSize={18} icon="comment" label="Comment" />
          <IconButton iconSize={18} icon="actions" label="Actions" />
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup>
          <IconButton iconSize={18} icon="present" label="Slides mode" pressed className="mode-active" />
          <IconButton iconSize={18} icon="layout" label="Prototype mode" />
        </ToolbarGroup>
      </Toolbar>
    </div>
  );
}

const shape = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24"><path d={d} fill="var(--ad-accent)" stroke="var(--ad-accent-strong)" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
export function ShapesTray() {
  const items: [string, string][] = [["Square", "M4 4h16v16H4z"], ["Circle", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"], ["Diamond", "M12 2l10 10-10 10L2 12z"], ["Triangle", "M12 3l10 18H2z"], ["Star", "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"], ["Plus", "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"], ["Left arrow", "M3 12l8-8v5h10v6H11v5z"], ["Right arrow", "M21 12l-8-8v5H3v6h10v5z"], ["Speech bubble", "M4 4h16v12h-8l-5 5v-5H4z"]];
  return (
    <div className="tray" role="toolbar" aria-label="Shapes">
      <IconButton icon="arrow-up" label="Arrow" size="sm" style={{ rotate: "45deg" }} />
      <IconButton icon="minus" label="Line" size="sm" style={{ rotate: "-35deg" }} />
      <Divider orientation="vertical" style={{ height: 20 }} />
      {items.map(([label, d]) => <button key={label} className="tray__shape" aria-label={label} title={label}>{shape(d)}</button>)}
      <Divider orientation="vertical" style={{ height: 20 }} />
      <Button size="sm" variant="secondary">More shapes</Button>
    </div>
  );
}
