import type { ComponentProps } from "react";
import { iconData, type IconName } from "./icon-data.ts";
import { cx } from "./cx.ts";

export type IconProps = Omit<ComponentProps<"svg">, "children"> & {
  name: IconName;
  /** Pixel size (square). Default 16. */
  size?: number;
  /** Accessible name. Without it the icon is decorative and hidden from assistive tech. */
  label?: string;
};

/** Single-colour icon that follows the text colour (`currentColor`). */
export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  const shape = iconData[name];
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
      {...rest}
    >
      {shape.paths.map((p, i) => (
        <path key={i} d={p.d} fillRule={"evenodd" in p ? "evenodd" : undefined} clipRule={"evenodd" in p ? "evenodd" : undefined} />
      ))}
    </svg>
  );
}
