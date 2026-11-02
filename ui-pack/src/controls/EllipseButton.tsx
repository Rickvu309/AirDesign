import type { AirDesignProps } from "../types.ts";

export function EllipseButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Ellipse" type="button" className={className} {...rest}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(var(--ad-ink-subtle, rgba(0, 0, 0, 0.3)) 0px 0px 0.5px) drop-shadow(var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
  <svg style={{
        "display": "block",
        "height": "26px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "var(--ad-accent, rgb(61, 56, 245))",
        "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
        "strokeWidth": "2px"
      }} width="27" height="26" viewBox="0 0 27 26">
    <circle style={{
          "strokeOpacity": "0.9"
        }} cx="13.5" cy="13" r="12.458" strokeLinecap="square" strokeOpacity=".9"></circle>
  </svg>
</span>
                </button>;
}
