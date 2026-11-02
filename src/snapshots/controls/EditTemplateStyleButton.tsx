import type { AirDesignProps } from "../types.js";

export function EditTemplateStyleButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "grid",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "550",
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
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Edit template style" type="button" className={className} {...rest}>
                        <span style={{
      "alignItems": "center",
      "display": "flex",
      "height": "24px",
      "justifyContent": "center",
      "minWidth": "24px",
      "width": "24px",
      "borderRadius": "5px"
    }} aria-hidden="true">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
        }} d="M8.5 18a.5.5 0 0 0 .5-.5v-1.55a2.5 2.5 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v4.55a2.501 2.501 0 0 0 0 4.9v1.55a.5.5 0 0 0 .5.5m7 0a.5.5 0 0 0 .5-.5v-4.55a2.501 2.501 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v1.55a2.5 2.5 0 0 0 0 4.9v4.55a.5.5 0 0 0 .5.5m0-6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-7 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"></path>
  </svg>
</span>
                      </button>;
}
