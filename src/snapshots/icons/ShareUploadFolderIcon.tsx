import type { AirDesignProps } from "../types.js";

export function ShareUploadFolderIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
    <path style={{
      "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
    }} d="M11.725 11.082a.5.5 0 0 1 .629.064l2.5 2.5a.5.5 0 0 1-.707.707L12.5 12.708V18.5a.5.5 0 0 1-1 0v-5.793l-1.646 1.646a.5.5 0 1 1-.707-.707l2.5-2.5zM10.379 6a2 2 0 0 1 1.414.586l1.411 1.411.007.003h3.29a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-2a.5.5 0 1 1 0-1h2a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-3.704l-.007-.003-1.704-1.704A1 1 0 0 0 10.379 7H7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h2a.5.5 0 0 1 0 1h-2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
  </svg>;
}
