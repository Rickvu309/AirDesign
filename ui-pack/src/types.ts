import type React from "react";
import type { CSSProperties } from "react";

export interface AirDesignComponentProps {
  style?: CSSProperties;
  className?: string;
}

/** Native props of the root element (onClick, ref, aria-*, data-*, ...) plus style and className. */
export type AirDesignProps<Tag extends keyof React.JSX.IntrinsicElements> = React.ComponentProps<Tag>;
