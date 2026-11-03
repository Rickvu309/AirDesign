import type { ComponentProps } from "react";
import { Avatar } from "../components/Avatar.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { SearchField } from "../components/Input.js";
import { Sidebar, SidebarItem, SidebarSection } from "../components/Sidebar.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type HomeSidebarProps = ComponentProps<"aside"> & {
  user?: { name: string; avatar?: string } | string;
  workspaceName?: string;
  workspaceBadge?: string;
  starred?: string[];
  activeItem?: string;
  onItemClick?: (id: string) => void;
  onNotificationsClick?: () => void;
};

export const defaultStarredFolders = [
  "01. Personal Project",
  "02. Work Project",
  "03. Collab",
  "99. Archive",
  "Nova Membership",
  "Project Consulting",
  "Professional Template",
  "Vietjet Project",
  "Grok Bot Slide",
];

export function HomeSidebar({
  user = "Ada Lovelace",
  workspaceName = "Ada Lovelace",
  workspaceBadge = "Professional",
  starred = defaultStarredFolders,
  activeItem = "drafts",
  onItemClick,
  onNotificationsClick,
  className,
  ...rest
}: HomeSidebarProps) {
  const name = typeof user === "string" ? user : user.name;
  const initial = (workspaceName || name).charAt(0).toUpperCase();

  return (
    <Sidebar label="Main" className={cx("home__side", className)} {...rest}>
      <div className="home__acct">
        <Button variant="ghost" iconEnd="chevron-down">
          <Avatar name={name} size={24} />
          {name}
        </Button>
        <IconButton
          icon="help"
          label="Notifications"
          size="sm"
          className="bell"
          onClick={onNotificationsClick}
        />
      </div>
      <SearchField style={{ width: "100%" }} />
      <SidebarSection>
        <SidebarItem
          href="#"
          icon="clock"
          active={activeItem === "recents"}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("recents");
          }}
        >
          Recents
        </SidebarItem>
        <SidebarItem
          href="#"
          icon="resources"
          active={activeItem === "community"}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("community");
          }}
        >
          Community
        </SidebarItem>
      </SidebarSection>
      <hr className="home__rule" />
      <div className="home__ws">
        <Button variant="ghost" iconEnd="chevron-down">
          <span className="home__q">{initial}</span>
          {workspaceName}
        </Button>
        <Badge tone="info">{workspaceBadge}</Badge>
      </div>
      <SidebarSection>
        <SidebarItem
          href="#"
          icon="file"
          active={activeItem === "drafts"}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("drafts");
          }}
        >
          Drafts
        </SidebarItem>
        <SidebarItem
          href="#"
          icon="grid"
          active={activeItem === "folders"}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("folders");
          }}
        >
          All folders
        </SidebarItem>
        <SidebarItem
          href="#"
          icon="layout"
          active={activeItem === "resources"}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("resources");
          }}
        >
          Resources
        </SidebarItem>
        <SidebarItem
          href="#"
          icon="trash"
          active={activeItem === "trash"}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("trash");
          }}
        >
          Trash
        </SidebarItem>
        <SidebarItem
          href="#"
          icon="settings"
          active={activeItem === "admin"}
          trailing={<Badge>2</Badge>}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.("admin");
          }}
        >
          Admin
        </SidebarItem>
      </SidebarSection>
      <hr className="home__rule" />
      <SidebarSection
        title={
          <span className="starred-title">
            <Icon name="chevron-down-small" size={14} />
            Starred
          </span>
        }
      >
        {starred.map((f) => (
          <SidebarItem
            key={f}
            href="#"
            icon="folder"
            className="fold"
            onClick={(e) => {
              e.preventDefault();
              onItemClick?.(f);
            }}
          >
            {f}
          </SidebarItem>
        ))}
      </SidebarSection>
    </Sidebar>
  );
}
