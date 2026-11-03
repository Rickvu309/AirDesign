import type { ComponentProps } from "react";
import { IconButton } from "../components/IconButton.js";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../components/Toolbar.js";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";
import { ShapesTray } from "./ShapesTray.js";

export type BottomToolbarProps = ComponentProps<"div"> & {
  shapes?: boolean;
  onShapes?: () => void;
  mediaActive?: boolean;
  onMedia?: () => void;
  onMove?: () => void;
  onText?: () => void;
  onComment?: () => void;
  onActions?: () => void;
};

export function BottomToolbar({
  shapes,
  onShapes,
  mediaActive,
  onMedia,
  onMove,
  onText,
  onComment,
  onActions,
  className,
  ...rest
}: BottomToolbarProps) {
  return (
    <div className={cx("bottom", className)} {...rest}>
      {shapes && <ShapesTray />}
      <Toolbar label="Tools" className="ad-toolbar">
        <ToolbarGroup>
          <div className="tool-split">
            <IconButton
              iconSize={24}
              icon="cursor"
              label="Move"
              variant={shapes || mediaActive ? "ghost" : "primary"}
              className={shapes || mediaActive ? "" : "tool-active"}
              onClick={onMove}
            />
            <button type="button" aria-label="Move tools" className="tool-chev">
              <Icon name="chevron-down-small" size={16} />
            </button>
          </div>
          <IconButton iconSize={24} icon="text" label="Text" onClick={onText} />
          <IconButton
            iconSize={24}
            icon="image"
            label="Image and video"
            variant={mediaActive ? "primary" : "ghost"}
            className={mediaActive ? "tool-active" : ""}
            onClick={onMedia}
          />
          <IconButton
            iconSize={24}
            icon="shapes"
            label="Shapes"
            variant={shapes ? "primary" : "ghost"}
            className={shapes ? "tool-active" : ""}
            onClick={onShapes}
          />
          <IconButton iconSize={24} icon="comment" label="Comment" onClick={onComment} />
          <IconButton iconSize={24} icon="actions" label="Actions" onClick={onActions} />
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup>
          <div className="ad-toolbar__modes" role="radiogroup" aria-label="Toolbelt Mode">
            <IconButton iconSize={24} icon="present" label="Slides mode" pressed className="mode-active" />
            <IconButton iconSize={24} icon="layout" label="Prototype mode" />
          </div>
        </ToolbarGroup>
      </Toolbar>
    </div>
  );
}
