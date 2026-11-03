import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  HelpButton,
  HomeFileList,
  HomeFileToolbar,
  HomeSidebar,
  Icon,
  SlideThumb,
} from "@airdesign/ui";

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

export interface HomeDraftsProps {
  name?: string;
  initialView?: "grid" | "list";
  empty?: boolean;
  onNewSlides?: () => void;
  onBrowseTemplates?: () => void;
}

export function HomeDrafts({
  name = "Ada Lovelace",
  initialView = "grid",
  empty = false,
  onNewSlides,
  onBrowseTemplates,
}: HomeDraftsProps) {
  const [view, setView] = useState<"grid" | "list">(initialView);
  return (
    <div className="home">
      <HomeSidebar user={name} starred={starred} />
      <main className="home__main">
        <HomeFileToolbar view={view} onViewChange={setView} />
        {empty ? (
          <EmptyState
            icon="file"
            title="No drafts yet"
            description="Create your first presentation to get started"
            action={
              <div className="home__empty-actions">
                <Button variant="primary" iconStart="plus" onClick={onNewSlides}>
                  New slides
                </Button>
                <Button variant="secondary" onClick={onBrowseTemplates}>
                  Browse templates
                </Button>
              </div>
            }
            className="home__empty-state"
          />
        ) : view === "list" ? (
          <HomeFileList />
        ) : (
          <div className="home__grid">
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
        )}
        <HelpButton />
      </main>
    </div>
  );
}
