import type { ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export type HomeFileToolbarProps = ComponentProps<"div"> & {
  title?: string;
  view?: "grid" | "list";
  onViewChange?: (view: "grid" | "list") => void;
  onNewSlides?: () => void;
  onMore?: () => void;
};

export function HomeFileToolbar({
  title = "Drafts",
  view = "grid",
  onViewChange,
  onNewSlides,
  onMore,
  className,
  style,
  ...rest
}: HomeFileToolbarProps) {
  return (
    <div
      className={cx("home__toolbar", className)}
      style={{ display: "contents", ...style }}
      {...rest}
    >
      <header className="home__top">
        <h1>{title}</h1>
        <div className="home__new">
          <Button iconStart="present" className="soft" onClick={onNewSlides}>
            Slides
          </Button>
          <Button iconEnd="chevron-down" className="soft" onClick={onMore}>
            More
          </Button>
        </div>
      </header>
      <div className="home__filters">
        <Button size="sm" iconStart="present" iconEnd="chevron-down" className="filter">
          Slides
        </Button>
        <Button size="sm" iconEnd="chevron-down">
          Last modified
        </Button>
        <span className="seg2">
          <IconButton
            icon="grid"
            label="Grid view"
            size="sm"
            pressed={view === "grid"}
            onClick={() => onViewChange?.("grid")}
          />
          <IconButton
            icon="list"
            label="List view"
            size="sm"
            pressed={view === "list"}
            onClick={() => onViewChange?.("list")}
          />
        </span>
      </div>
    </div>
  );
}
