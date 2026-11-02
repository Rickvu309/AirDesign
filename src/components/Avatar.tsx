import type { ComponentProps } from "react";
import { cx } from "../lib/cx.js";

export type AvatarProps = Omit<ComponentProps<"span">, "children"> & {
  name: string;
  src?: string;
  /** Pixel size. Default 24. */
  size?: number;
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

export function Avatar({ name, src, size = 24, className, style, ...rest }: AvatarProps) {
  return (
    <span role="img" aria-label={name} className={cx("ad ad-avatar", className)} style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), ...style }} {...rest}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
