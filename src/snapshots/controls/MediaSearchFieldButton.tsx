import type { AirDesignProps } from "../types.js";

export function MediaSearchFieldButton({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "alignItems": "center",
    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
    "boxSizing": "border-box",
    "display": "flex",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "5px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 274,
    ...style
  }} className={className} {...rest}>
    <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
      }} d="M11.5 6a5.5 5.5 0 0 1 4.226 9.019l2.127 2.127a.5.5 0 1 1-.707.707l-2.127-2.127A5.5 5.5 0 1 1 11.5 6m0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"></path>
    </svg>
    <input style={{
      "appearance": "auto",
      "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
      "display": "block",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "11px",
      "fontWeight": "450",
      "letterSpacing": "0.05504px",
      "lineHeight": "16px",
      "overflowX": "clip",
      "overflowY": "clip",
      "unicodeBidi": "isolate",
      "padding": "0px"
    }} aria-label="Search stock photos" placeholder="Search images" type="text" value=""></input>
  </div>;
}
