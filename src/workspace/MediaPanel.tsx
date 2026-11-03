import type { ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { Input } from "../components/Input.js";
import { cx } from "../lib/cx.js";
import { PanelHeader } from "./PanelHeader.js";

export type MediaPanelProps = ComponentProps<"div"> & {
  title?: string;
  subtitle?: string;
  slideView?: boolean;
  onViewToggle?: () => void;
  onBack?: () => void;
  onMakeImage?: () => void;
  onUploadMedia?: () => void;
  onSearchChange?: (val: string) => void;
  onTitleClick?: () => void;
};

const heights = [200, 200, 200, 200, 76, 200, 148, 120];
const tones = ["#2c3a2e", "#5b6b6a", "#26364a", "#7d8f6f", "#d9a95b", "#8c6a4a", "#c7b8a4", "#6d7a8a"];

export function MediaPanel({
  title = "Untitled",
  subtitle = "Drafts",
  slideView,
  onViewToggle,
  onBack,
  onMakeImage,
  onUploadMedia,
  onSearchChange,
  onTitleClick,
  className,
  ...rest
}: MediaPanelProps) {
  return (
    <div className={cx("ad-media-panel", className)} {...rest}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        trailing={<IconButton icon={slideView ? "slide-view" : "grid"} label="View" size="sm" onClick={onViewToggle} />}
        onTitleClick={onTitleClick}
      />
      <Divider />
      <div className="media__top">
        <IconButton icon="chevron-left" label="Back" size="sm" onClick={onBack} />
        <span className="lp__title2 plain">Media</span>
      </div>
      <div className="media__search">
        <Input
          label="Search images"
          startIcon="search"
          placeholder="Search images"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>
      <Divider />
      <div className="media__grid-wrap">
        <div className="lp__sub up">Unsplash</div>
        <div className="media__grid">
          {[0, 1].map((col) => (
            <div key={col} className="media__col">
              {heights
                .filter((_, i) => i % 2 === col)
                .map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Photo ${col * 4 + i + 1}`}
                    className="media__item"
                    style={{
                      height: h,
                      background: `linear-gradient(160deg, ${tones[(col * 4 + i) % tones.length]}, ${tones[(col * 4 + i + 3) % tones.length]})`,
                    }}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
      <Divider />
      <div className="media__actions">
        <Button size="sm" iconStart="image" className="row center" onClick={onMakeImage}>
          Make an image
        </Button>
        <Button size="sm" iconStart="upload" className="row center" onClick={onUploadMedia}>
          Upload image or video
        </Button>
      </div>
    </div>
  );
}
