import type { ComponentProps } from "react";
import { iconData, type IconName, type IconShape } from "./icon-data.js";
import { cx } from "../lib/cx.js";

export type IconProps = Omit<ComponentProps<"svg">, "children"> & {
  name: IconName;
  /** Pixel size (square). Default 16. */
  size?: number;
  /** Accessible name. Without it the icon is decorative and hidden from assistive tech. */
  label?: string;
};

/** Single-colour icon that follows the text colour (`currentColor`). */
export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  const shape: IconShape = iconData[name];
  return (
    <svg
      className={cx("ad-icon", className)}
      width={size}
      height={size}
      viewBox={shape.viewBox}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...(shape.stroke ? { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const } : {})}
      {...rest}
    >
      {shape.paths.map((p, i) => (
        <path key={i} d={p.d} fillRule={"evenodd" in p ? "evenodd" : undefined} clipRule={"evenodd" in p ? "evenodd" : undefined} />
      ))}
    </svg>
  );
}
