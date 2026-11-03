import type { ComponentProps } from "react";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";
import { PanelHeader } from "./PanelHeader.js";

export type InsertsPanelProps = ComponentProps<"div"> & {
  title?: string;
  subtitle?: string;
  onSlideView?: () => void;
  onOpen?: (id: string) => void;
  onInsertRow?: (id: string) => void;
  onTitleClick?: () => void;
};

const defaultTiles: { label: string; icon: IconName; bg: string; fg: string }[] = [
  { label: "Text", icon: "text", bg: "#b8e0ff", fg: "#1e90ff" },
  { label: "Media", icon: "image", bg: "#ffc0ee", fg: "#ff4fa0" },
  { label: "Shapes", icon: "shapes", bg: "#b5eaf2", fg: "#0e9ab5" },
  { label: "Prototypes", icon: "layout", bg: "#b4b0f8", fg: "#4b4bf0" },
  { label: "Interactive", icon: "hand", bg: "#ffd966", fg: "#d98a00" },
  { label: "Libraries", icon: "resources", bg: "#b9ebc6", fg: "#1a9d45" },
];

const rowLabels: Record<string, string> = {
  table: "Table",
  code: "Code block",
  "slide-number": "Slide number",
};

export function InsertsPanel({
  title = "Untitled",
  subtitle = "Drafts",
  onSlideView,
  onOpen,
  onInsertRow,
  onTitleClick,
  className,
  ...rest
}: InsertsPanelProps) {
  return (
    <div className={cx("ad-inserts-panel", className)} {...rest}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        trailing={<IconButton icon="slide-view" label="Slide view" size="sm" onClick={onSlideView} />}
        onTitleClick={onTitleClick}
      />
      <Divider />
      <div className="lp__title2">Inserts</div>
      <Divider />
      <div className="inserts">
        <div className="inserts__rows">
          {(["table", "code", "slide-number"] as const).map((n) => (
            <button
              key={n}
              type="button"
              className="inserts__row"
              onClick={() => onInsertRow?.(n)}
            >
              <Icon name={n} size={20} />
              {rowLabels[n]}
            </button>
          ))}
        </div>
        <div className="inserts__tiles">
          {defaultTiles.map((t) => (
            <button
              key={t.label}
              type="button"
              className="inserts__tile"
              onClick={() => onOpen?.(t.label.toLowerCase())}
            >
              <span className="tile" style={{ background: t.bg }}>
                <span style={{ color: t.fg }}>
                  <Icon name={t.icon} size={22} />
                </span>
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
