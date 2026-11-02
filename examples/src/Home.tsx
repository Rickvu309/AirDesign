import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Menu, MenuItem, Popover, SearchField, Sidebar, SidebarItem, SidebarSection, Skeleton, Tabs } from "@airdesign/ui";

interface FileItem { id: string; title: string; edited: string; kind: "Slides" | "Design"; hue: number; shared?: boolean }
const files: FileItem[] = [
  { id: "1", title: "Brand deck", edited: "Edited 22 minutes ago", kind: "Slides", hue: 18 },
  { id: "2", title: "Q4 investor update", edited: "Edited 2 days ago", kind: "Slides", hue: 235, shared: true },
  { id: "3", title: "Landing page", edited: "Edited 6 months ago", kind: "Design", hue: 200 },
  { id: "4", title: "Onboarding flow", edited: "Edited last week", kind: "Design", hue: 330, shared: true },
  { id: "5", title: "Workshop notes", edited: "Edited yesterday", kind: "Slides", hue: 150 },
  { id: "6", title: "Pitch v2", edited: "Edited 3 weeks ago", kind: "Slides", hue: 45 },
];

export function Home() {
  const [tab, setTab] = useState("recent");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);
  const shown = files.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()) && (tab === "shared" ? f.shared : tab === "starred" ? f.id === "1" : true));
  return (
    <div className="home">
      <Sidebar label="Main" className="home__side">
        <div className="home__account">
          <Avatar name="Ada Lovelace" size={28} />
          <div className="home__who"><strong>Ada Lovelace</strong><span>Personal workspace</span></div>
          <Badge tone="brand">Pro</Badge>
        </div>
        <SidebarSection>
          <SidebarItem href="#home" icon="clock" active>Recents</SidebarItem>
          <SidebarItem href="#home" icon="file" trailing="12">Drafts</SidebarItem>
          <SidebarItem href="#home" icon="resources">Community</SidebarItem>
        </SidebarSection>
        <SidebarSection title="Projects">
          <SidebarItem href="#home" icon="layout">Brand</SidebarItem>
          <SidebarItem href="#home" icon="layout">Marketing site</SidebarItem>
          <SidebarItem href="#home" icon="layout">Archive</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarItem href="#home" icon="trash">Trash</SidebarItem>
        </SidebarSection>
      </Sidebar>
      <main className="home__main">
        <div className="home__bar">
          <SearchField value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 320 }} />
          <div className="home__actions">
            <Button iconStart="frame">New design</Button>
            <Button variant="primary" iconStart="present" onClick={() => { location.hash = "editor"; }}>New slides</Button>
          </div>
        </div>
        <Tabs label="Filter" value={tab} onValueChange={setTab} items={[{ id: "recent", label: "Recent" }, { id: "shared", label: "Shared with me" }, { id: "starred", label: "Starred" }]} />
        <div className="home__grid" aria-busy={loading}>
          {loading && Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="home__skeleton"><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 12, width: "60%" }} /><Skeleton style={{ height: 10, width: "40%" }} /></div>
          ))}
          {!loading && shown.map((f) => (
            <Card
              key={f.id}
              interactive
              title={<span className="home__cardtitle">{f.title}<Popover label={`${f.title} actions`} trigger={<IconButton icon="more" label={`Actions for ${f.title}`} size="sm" />}><Menu><MenuItem icon="link">Copy link</MenuItem><MenuItem icon="copy">Duplicate</MenuItem><MenuItem icon="trash">Move to trash</MenuItem></Menu></Popover></span>}
              meta={<>{f.kind} · {f.edited}</>}
              media={<div className="home__thumb" style={{ background: `linear-gradient(135deg, hsl(${f.hue} 90% 94%), hsl(${f.hue} 85% 82%))` }}><span>{f.title}</span></div>}
            />
          ))}
          {!loading && shown.length === 0 && (
            <div className="home__empty"><EmptyState icon="search" title="No files match" description={`Nothing found for “${query}”. Try another name.`} action={<Button onClick={() => setQuery("")}>Clear search</Button>} /></div>
          )}
        </div>
      </main>
    </div>
  );
}
