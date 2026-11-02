import type { AirDesignProps } from "../types.js";

export function ShareCloseButton({
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
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Close" type="button" className={className} {...rest}>
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
        }} d="M16.224 7.082a.501.501 0 0 1 .694.693l-.065.078L12.707 12l4.146 4.146.065.078a.5.5 0 0 1-.694.694l-.078-.065L12 12.706l-4.147 4.147a.5.5 0 1 1-.707-.707l4.147-4.147-4.147-4.146-.064-.078a.501.501 0 0 1 .693-.693l.078.064L12 11.293l4.146-4.147z"></path>
          </svg>
        </span>
      </button>;
}
