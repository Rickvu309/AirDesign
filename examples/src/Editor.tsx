import { useState } from "react";
import { Accordion, AccordionItem, Alert, Avatar, Breadcrumbs, Button, ChatComposer, ChatMessage, ChatThread, Checkbox, ColorSwatch, Dialog, Divider, Icon, IconButton, Input, Kbd, NumberField, PropertyRow, PropertySection, Select, Slider, Suggestion, Switch, Tabs, Toolbar, ToolbarGroup, ToolbarSeparator, type IconName } from "@airdesign/ui";

const tools: { id: string; icon: IconName; label: string }[] = [
  { id: "move", icon: "cursor", label: "Move" }, { id: "hand", icon: "hand", label: "Hand" }, { id: "frame", icon: "frame", label: "Frame" },
  { id: "rect", icon: "rectangle", label: "Rectangle" }, { id: "pen", icon: "pen", label: "Pen" }, { id: "text", icon: "text", label: "Text" }, { id: "comment", icon: "comment", label: "Comment" },
];
const colors = ["#ff5c16", "#3d38f5", "#0d99ff", "#ff58ae", "#1a1a1a", "#ffffff"];
const slides = ["Slide Deck Title", "The problem", "Our approach", "Roadmap", "Thank you"];

interface Msg { id: number; role: "user" | "assistant"; text: string }

export function Editor() {
  const [tool, setTool] = useState("move");
  const [slide, setSlide] = useState(0);
  const [panel, setPanel] = useState("design");
  const [fill, setFill] = useState(colors[0]);
  const [opacity, setOpacity] = useState(100);
  const [title, setTitle] = useState("Brand deck");
  const [shareOpen, setShareOpen] = useState(false);
  const [anyone, setAnyone] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: "assistant", text: "Hi Ada. I can restyle slides, rewrite copy or build a new section. What should we work on?" }]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const send = (text: string) => {
    setMsgs((m) => [...m, { id: m.length, role: "user", text }]);
    setDraft(""); setSending(true);
    setTimeout(() => { setMsgs((m) => [...m, { id: m.length, role: "assistant", text: `Done. I tightened the headline on “${slides[slide]}” and aligned the logo to the top-right grid. Want a second version?` }]); setSending(false); }, 900);
  };

  return (
    <div className="editor">
      <header className="editor__top">
        <Toolbar label="File" className="editor__flat">
          <IconButton icon="list" label="Main menu" />
        </Toolbar>
        <Breadcrumbs items={[{ label: "Brand", href: "#home" }, { label: title }]} />
        <div className="editor__spacer" />
        <Tabs label="Mode" defaultValue="design" items={[{ id: "design", label: "Design" }, { id: "animate", label: "Animate" }]} />
        <div className="editor__spacer" />
        <Avatar name="Ada Lovelace" />
        <Button iconStart="present">Present</Button>
        <Button variant="primary" iconStart="upload" onClick={() => setShareOpen(true)}>Share</Button>
      </header>

      <aside className="editor__slides" aria-label="Slides">
        <div className="editor__slides-head"><strong>Slides</strong><IconButton icon="plus" label="New slide" size="sm" /></div>
        <ol>
          {slides.map((s, i) => (
            <li key={s}>
              <button className="editor__slide" aria-current={i === slide ? "true" : undefined} onClick={() => setSlide(i)}>
                <span className="editor__slide-no">{i + 1}</span>
                <span className="editor__slide-thumb"><span>{s}</span></span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <main className="editor__canvas">
        <div className="editor__stage" style={{ ["--fill" as string]: fill, ["--op" as string]: opacity / 100 }}>
          <div className="editor__shape" />
          <h1>{slides[slide]}</h1>
          <p>This is just the beginning of something big.</p>
        </div>
        <Toolbar label="Tools" className="editor__tools">
          <ToolbarGroup>
            {tools.slice(0, 2).map((t) => <IconButton key={t.id} icon={t.icon} label={t.label} pressed={tool === t.id} onClick={() => setTool(t.id)} />)}
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            {tools.slice(2).map((t) => <IconButton key={t.id} icon={t.icon} label={t.label} pressed={tool === t.id} onClick={() => setTool(t.id)} />)}
          </ToolbarGroup>
        </Toolbar>
        <div className="editor__hint"><Kbd>V</Kbd> Move <Kbd>R</Kbd> Rectangle <Kbd>T</Kbd> Text</div>
      </main>

      <aside className="editor__inspector" aria-label="Inspector">
        <div className="editor__tabs"><Tabs label="Panel" value={panel} onValueChange={setPanel} items={[{ id: "design", label: "Design" }, { id: "agent", label: "Agent" }]} /></div>
        {panel === "design" ? (
          <div className="editor__scroll">
            <PropertySection title="Layout">
              <PropertyRow label="Position"><NumberField label="X" prefix="X" defaultValue={120} /><NumberField label="Y" prefix="Y" defaultValue={48} /></PropertyRow>
              <PropertyRow label="Size"><NumberField label="Width" prefix="W" defaultValue={320} /><NumberField label="Height" prefix="H" defaultValue={180} /></PropertyRow>
              <Checkbox label="Clip content" defaultChecked />
            </PropertySection>
            <PropertySection title="Fill">
              <div className="editor__swatches">{colors.map((c) => <ColorSwatch key={c} color={c} label={c} selected={fill === c} onClick={() => setFill(c)} />)}</div>
              <Slider label="Opacity" value={opacity} onValueChange={setOpacity} showValue format={(v) => `${v}%`} />
            </PropertySection>
            <PropertySection title="Text">
              <Input label="Slide title" labelHidden={false} value={slides[slide]} readOnly />
              <Select label="Font" defaultValue="inter" options={[{ value: "inter", label: "Inter" }, { value: "mono", label: "Paper Mono" }, { value: "serif", label: "Source Serif" }]} />
            </PropertySection>
            <Accordion>
              <AccordionItem title="Effects"><Switch checked={false} onCheckedChange={() => {}} label="Drop shadow" /></AccordionItem>
              <AccordionItem title="Export">PNG, PDF and PPTX</AccordionItem>
            </Accordion>
          </div>
        ) : (
          <div className="editor__agent">
            <ChatThread className="editor__thread">
              {msgs.map((m) => <ChatMessage key={m.id} role={m.role} name={m.role === "user" ? "Ada" : "AirDesign"}>{m.text}</ChatMessage>)}
              {sending && <ChatMessage role="assistant" name="AirDesign" streaming>Working on it</ChatMessage>}
            </ChatThread>
            <div className="editor__suggest"><Suggestion onClick={() => send("Improve the deck")}>Improve the deck</Suggestion><Suggestion onClick={() => send("Add a roadmap slide")}>Add a slide</Suggestion></div>
            <ChatComposer value={draft} onValueChange={setDraft} onSend={send} sending={sending} tools={<IconButton icon="plus" label="Add context" size="sm" />} />
          </div>
        )}
      </aside>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} title="Share “Brand deck”" actions={<><Button onClick={() => setShareOpen(false)}>Done</Button><Button variant="primary" iconStart="link">Copy link</Button></>}>
        <div className="editor__share">
          <div className="editor__invite">
            <Input label="Invite by email" labelHidden={false} placeholder="name@company.com" startIcon="user" />
            <Select label="Role" options={[{ value: "view", label: "Can view" }, { value: "edit", label: "Can edit" }]} />
            <Button variant="primary">Invite</Button>
          </div>
          <Divider />
          <div className="editor__anyone"><div><strong>Anyone with the link</strong><div className="editor__muted">{anyone ? "Anyone can view this file" : "Only invited people can open it"}</div></div><Switch checked={anyone} onCheckedChange={setAnyone} label="Anyone with the link" /></div>
          {anyone && <Alert tone="warning" title="Public link">Anyone who has the link can see every slide, including speaker notes.</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
