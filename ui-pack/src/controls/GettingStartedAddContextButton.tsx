import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedAddContextButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "grid",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "gridTemplateColumns": "24px",
    "gridTemplateRows": "32px",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "minWidth": "32px",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "width": "32px",
    "borderRadius": "9999px",
    "padding": "0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Add context" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "display": "flex",
      "height": "24px",
      "justifyContent": "center",
      "minWidth": "24px",
      "width": "24px",
      "borderRadius": "9999px"
    }} aria-hidden="true">
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6"></path>
    </svg>
  </span>
</button>;
}
