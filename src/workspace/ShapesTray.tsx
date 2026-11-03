import type { ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { Divider } from "../components/Divider.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export type ShapesTrayProps = ComponentProps<"div"> & {
  onMoreShapes?: () => void;
  onSelectShape?: (shape: string) => void;
  onArrowClick?: () => void;
  onLineClick?: () => void;
};

const shape = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      d={d}
      fill="var(--ad-accent)"
      stroke="var(--ad-accent-strong)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const items: [string, string][] = [
  ["Square", "M4 4h16v16H4z"],
  ["Circle", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"],
  ["Diamond", "M12 2l10 10-10 10L2 12z"],
  ["Triangle", "M12 3l10 18H2z"],
  ["Star", "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"],
  ["Plus", "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"],
  ["Left arrow", "M3 12l8-8v5h10v6H11v5z"],
  ["Right arrow", "M21 12l-8-8v5H3v6h10v5z"],
  ["Speech bubble", "M4 4h16v12h-8l-5 5v-5H4z"],
];

export function ShapesTray({
  onMoreShapes,
  onSelectShape,
  onArrowClick,
  onLineClick,
  className,
  ...rest
}: ShapesTrayProps) {
  return (
    <div className={cx("tray", className)} role="toolbar" aria-label="Shapes" {...rest}>
      <IconButton icon="arrow-up" label="Arrow" size="sm" style={{ rotate: "45deg" }} onClick={onArrowClick} />
      <IconButton icon="minus" label="Line" size="sm" style={{ rotate: "-35deg" }} onClick={onLineClick} />
      <Divider orientation="vertical" style={{ height: 20 }} />
      {items.map(([label, d]) => (
        <button
          key={label}
          type="button"
          className="tray__shape"
          aria-label={label}
          title={label}
          onClick={() => onSelectShape?.(label)}
        >
          {shape(d)}
        </button>
      ))}
      <Divider orientation="vertical" style={{ height: 20 }} />
      <Button size="sm" variant="secondary" onClick={onMoreShapes}>
        More shapes
      </Button>
    </div>
  );
}
