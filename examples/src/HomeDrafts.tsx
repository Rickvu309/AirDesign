import { useState } from "react";
import { Avatar, Badge, Button, Card, IconButton, Icon, SearchField, Sidebar, SidebarItem, SidebarSection } from "@airdesign/ui";
import { HelpButton, NAME, SlideThumb } from "./parts";

const starred = ["01. Personal Project", "02. Work Project", "03. Collab", "99. Archive", "Membership", "Project Consulting", "Professional Template", "Client Project", "Bot Slides"];

export function HomeDrafts() {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <div className="home">
      <Sidebar label="Main" className="home__side">
        <div className="home__acct"><Button variant="ghost" iconEnd="chevron-down"><Avatar name={NAME} size={24} />{NAME}</Button><IconButton icon="help" label="Notifications" size="sm" className="bell" /></div>
        <SearchField style={{ width: "100%" }} />
        <SidebarSection><SidebarItem href="#" icon="clock">Recents</SidebarItem><SidebarItem href="#" icon="resources">Community</SidebarItem></SidebarSection>
        <hr className="home__rule" />
        <div className="home__ws"><Button variant="ghost" iconEnd="chevron-down"><span className="home__q">A</span>Ada Lovelace</Button><Badge tone="info">Professional</Badge></div>
        <SidebarSection>
          <SidebarItem href="#" icon="file" active>Drafts</SidebarItem><SidebarItem href="#" icon="grid">All folders</SidebarItem><SidebarItem href="#" icon="layout">Resources</SidebarItem>
          <SidebarItem href="#" icon="trash">Trash</SidebarItem><SidebarItem href="#" icon="settings" trailing={<Badge>2</Badge>}>Admin</SidebarItem>
        </SidebarSection>
        <hr className="home__rule" />
        <SidebarSection title="Starred">{starred.map((f) => <SidebarItem key={f} href="#" icon="folder" className="fold">{f}</SidebarItem>)}</SidebarSection>
      </Sidebar>
      <main className="home__main">
        <header className="home__top"><h1>Drafts</h1><div className="home__new"><Button iconStart="present" className="soft">Slides</Button><Button iconEnd="chevron-down" className="soft">More</Button></div></header>
        <div className="home__filters">
          <Button size="sm" iconStart="present" iconEnd="chevron-down" className="filter">Slides</Button>
          <Button size="sm" iconEnd="chevron-down">Last modified</Button>
          <span className="seg2"><IconButton icon="grid" label="Grid view" size="sm" pressed={view === "grid"} onClick={() => setView("grid")} /><IconButton icon="list" label="List view" size="sm" pressed={view === "list"} onClick={() => setView("list")} /></span>
        </div>
        <div className={view === "grid" ? "home__grid" : "home__list"}>
          <Card interactive media={<div className="home__thumb"><SlideThumb /></div>} title={<span className="ftitle"><Icon name="present" className="orange" />Untitled</span>} meta="Edited 22 minutes ago"><Avatar name={NAME} size={24} className="owner" /></Card>
          <Card interactive media={<div className="home__thumb home__thumb--blank" />} title={<span className="ftitle"><Icon name="present" className="orange" />Untitled</span>} meta="Edited 6 months ago" />
        </div>
        <HelpButton />
      </main>
    </div>
  );
}
