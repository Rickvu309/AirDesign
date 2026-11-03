import type { ComponentProps } from "react";
import { Avatar } from "../components/Avatar.js";
import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { Tabs } from "../components/Tabs.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type InspectorHeadProps = ComponentProps<"div"> & {
  zoom: string;
  floating?: boolean;
  onShare?: () => void;
  onPresent?: () => void;
  onZoomClick?: () => void;
  user?: { name: string; avatar?: string } | string;
};

export function InspectorHead({
  zoom,
  floating,
  onShare,
  onPresent,
  onZoomClick,
  user = "Ada Lovelace",
  className,
  ...rest
}: InspectorHeadProps) {
  const name = typeof user === "string" ? user : user.name;

  return (
    <div className={cx("insp__head", className)} data-floating={floating || undefined} {...rest}>
      <div className="insp__row">
        <span className="insp__avatar">
          <Avatar name={name} size={24} />
          <Icon name="chevron-down-small" size={14} />
        </span>
        <span className="grow" />
        <IconButton icon="play" label="Present" size="sm" iconSize={24} onClick={onPresent} />
        <Button size="sm" variant="primary" className="insp__share" onClick={onShare}>
          Share
        </Button>
      </div>
      <div className="insp__row">
        <Tabs
          label="Panel"
          defaultValue="design"
          items={[
            { id: "design", label: "Design" },
            { id: "animate", label: "Animate" },
          ]}
        />
        <span className="grow" />
        <Button size="sm" variant="ghost" className="zoomtag" iconEnd="chevron-down-small" onClick={onZoomClick}>
          {zoom}
        </Button>
      </div>
    </div>
  );
}
