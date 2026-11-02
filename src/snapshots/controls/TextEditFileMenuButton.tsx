import type { AirDesignProps } from "../types.js";

export function TextEditFileMenuButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "borderBottomRightRadius": "5px",
    "borderTopRightRadius": "5px",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "grid",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "gridTemplateColumns": "24px",
    "gridTemplateRows": "24px",
    "height": "24px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "minWidth": "24px",
    "outlineColor": "rgba(0, 0, 0, 0)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "width": "24px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button" className={className} {...rest}>
  <span style={{
      "alignItems": "center",
      "borderBottomRightRadius": "5px",
      "borderTopRightRadius": "5px",
      "display": "flex",
      "height": "24px",
      "justifyContent": "center",
      "minWidth": "24px",
      "width": "24px"
    }} aria-hidden="true">
    <svg style={{
        "display": "block",
        "height": "16px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "16px"
      }} width="16" height="16" fill="none" viewBox="0 0 16 16">
      <path style={{
          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
        }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
    </svg>
  </span>
</button>;
}
