import type { ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";
import { PanelHeader } from "./PanelHeader.js";
import { SlideThumb } from "./SlideThumb.js";

export type FilePanelProps = ComponentProps<"div"> & {
  slides?: number;
  title?: string;
  subtitle?: string;
  onOverview?: () => void;
  onNewSlide?: () => void;
  onAddBlank?: () => void;
  onTitleClick?: () => void;
};

export function FilePanel({
  slides = 1,
  title = "Untitled",
  subtitle = "Drafts",
  onOverview,
  onNewSlide,
  onAddBlank,
  onTitleClick,
  className,
  ...rest
}: FilePanelProps) {
  return (
    <div className={cx("ad-file-panel", className)} {...rest}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        trailing={<IconButton icon="grid" label="Overview" size="sm" onClick={onOverview} />}
        onTitleClick={onTitleClick}
      />
      <Divider />
      <div className="lp__bar">
        <Button className="grow" size="sm" iconEnd="chevron-down" onClick={onNewSlide}>
          New slide
        </Button>
        <IconButton icon="plus" label="Add blank slide" size="sm" variant="secondary" onClick={onAddBlank} />
      </div>
      <ol className="lp__slides">
        {Array.from({ length: slides }, (_, i) => (
          <li key={i}>
            <span className="lp__no">{i + 1}</span>
            <SlideThumb selected={i === 0} />
          </li>
        ))}
      </ol>
    </div>
  );
}
