import type { AirDesignProps } from "../types.ts";

export function DiamondButton({
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
  }} aria-current="false" aria-label="Diamond" type="button" className={className} {...rest}>
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
        "height": "30px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "var(--ad-accent, rgb(61, 56, 245))",
        "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
        "strokeWidth": "2px"
      }} width="29" height="30" viewBox="0 0 29 30">
    <rect style={{
          "strokeOpacity": "0.9"
        }} width="21" height="21" x="-.383" y="15.106" strokeOpacity=".9" rx="2.556" transform="rotate(-45 -.383 15.106)"></rect>
  </svg>
</span>
                </button>;
}
