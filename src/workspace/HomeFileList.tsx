import type { ComponentProps } from "react";
import { Avatar } from "../components/Avatar.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";
import { SlideThumb } from "./SlideThumb.js";

export interface HomeFileItem {
  id: string;
  title: string;
  edited: string;
  owner: string;
  hasThumb?: boolean;
}

export const defaultHomeFiles: HomeFileItem[] = [
  { id: "1", title: "Untitled", edited: "Edited 22 minutes ago", owner: "Ada Lovelace", hasThumb: true },
  { id: "2", title: "Untitled", edited: "Edited 6 months ago", owner: "Ada Lovelace", hasThumb: false },
  { id: "3", title: "Vietjet Project", edited: "Edited 2 days ago", owner: "Quan", hasThumb: true },
  { id: "4", title: "Nova Membership", edited: "Edited 1 week ago", owner: "Ada Lovelace", hasThumb: false },
];

export type HomeFileListProps = ComponentProps<"div"> & {
  items?: HomeFileItem[];
  onOpen?: (id: string) => void;
};

export function HomeFileList({
  items = defaultHomeFiles,
  onOpen,
  className,
  ...rest
}: HomeFileListProps) {
  return (
    <div className={cx("home-file-list", className)} role="list" aria-label="Drafts list" {...rest}>
      {items.map((item) => (
        <div
          key={item.id}
          className="home-list__row"
          role="listitem"
          tabIndex={0}
          onClick={() => onOpen?.(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen?.(item.id);
            }
          }}
        >
          <div className="home-list__thumb">
            {item.hasThumb ? (
              <SlideThumb />
            ) : (
              <div className="home-list__thumb--blank" />
            )}
          </div>
          <div className="home-list__title">
            <Icon name="present" className="orange" />
            <span>{item.title}</span>
          </div>
          <div className="home-list__date">{item.edited}</div>
          <div className="home-list__owner">
            <Avatar name={item.owner} size={24} />
          </div>
        </div>
      ))}
    </div>
  );
}
