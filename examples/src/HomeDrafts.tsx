import { useState } from "react";
import { Avatar, Card, Icon, HelpButton, HomeFileToolbar, HomeSidebar, SlideThumb } from "@airdesign/ui";

const starred = [
  "[Quan] 01. Personal Project",
  "[Quan] 02. Work Project",
  "[Quan] 03. Collab",
  "[Quan] 99. Archive",
  "Nova Membership",
  "Project Consulting",
  "Professional Template",
  "Vietjet Project",
  "Grok Bot Slide",
];

export function HomeDrafts({ name = "Ada Lovelace" }: { name?: string }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <div className="home">
      <HomeSidebar user={name} starred={starred} />
      <main className="home__main">
        <HomeFileToolbar view={view} onViewChange={setView} />
        <div className={view === "grid" ? "home__grid" : "home__list"}>
          <Card
            interactive
            media={
              <div className="home__thumb">
                <SlideThumb />
              </div>
            }
            title={
              <span className="ftitle">
                <Icon name="present" className="orange" />
                Untitled
              </span>
            }
            meta="Edited 22 minutes ago"
          >
            <Avatar name={name} size={24} className="owner" />
          </Card>
          <Card
            interactive
            media={<div className="home__thumb home__thumb--blank" />}
            title={
              <span className="ftitle">
                <Icon name="present" className="orange" />
                Untitled
              </span>
            }
            meta="Edited 6 months ago"
          />
        </div>
        <HelpButton />
      </main>
    </div>
  );
}
