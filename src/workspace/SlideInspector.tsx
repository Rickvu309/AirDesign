import { useState, type ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export type SlideInspectorProps = ComponentProps<"div"> & {
  n?: number;
  withColors?: boolean;
  ai?: boolean;
  onEditWithAi?: () => void;
  onTemplateOptions?: () => void;
  onStyleClick?: () => void;
};

export function SlideInspector({
  n = 1,
  withColors,
  ai,
  onEditWithAi,
  onTemplateOptions,
  onStyleClick,
  className,
  ...rest
}: SlideInspectorProps) {
  const [mode, setMode] = useState("solid");

  return (
    <div className={cx("insp__body", className)} {...rest}>
      <div className="insp__sec insp__sec--slide">
        <h2>Slide {n}</h2>
        {ai && <IconButton icon="sparkle" label="Edit with AI" size="sm" onClick={onEditWithAi} />}
      </div>
      <div className="insp__sec insp__sec--template">
        <div className="insp__sec--row">
          <span className="insp__sec-title">Template style</span>
          <IconButton icon="adjust" label="Template options" size="sm" onClick={onTemplateOptions} />
        </div>
        <button type="button" className="style" onClick={onStyleClick}>
          <span className="style__sw">
            <i style={{ background: "#d0d0d0" }} />
            <i style={{ background: "#4f8a99" }} />
            <i style={{ background: "#3d38f5" }} />
          </span>
          <span>
            <b>Light slides</b>
            <small>Inter</small>
          </span>
        </button>
      </div>
      <div className="insp__sec insp__sec--bg">
        <div className="insp__sec--row">
          <span className="insp__sec-title">Background</span>
        </div>
        <div className="seg" role="group" aria-label="Background type">
          {([
            ["solid", "frame"],
            ["texture", "palette"],
            ["image", "image"],
          ] as const).map(([id, icon]) => (
            <IconButton
              key={id}
              icon={icon}
              label={id}
              size="sm"
              variant="ghost"
              pressed={mode === id}
              onClick={() => setMode(id)}
            />
          ))}
        </div>
        <Button variant="secondary" size="sm" iconEnd="chevron-down" className="row">
          <i className="chip" />
          White
        </Button>
      </div>
      {withColors && (
        <div className="insp__sec insp__sec--colors">
          <div className="insp__sec--row">
            <span className="insp__sec-title">Selection colors</span>
          </div>
          <div className="colors">
            <span>
              <i className="chip" style={{ background: "#000" }} />
              Black
            </span>
            <span>
              <i className="chip" />
              White
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
