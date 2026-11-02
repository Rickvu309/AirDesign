import type { AirDesignProps } from "../types.js";

export function LeftArrowButton({
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
  }} aria-current="false" aria-label="Left arrow" type="button" className={className} {...rest}>
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
        "height": "25px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "var(--ad-accent, rgb(61, 56, 245))",
        "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
        "strokeWidth": "2px"
      }} width="33" height="25" viewBox="0 0 33 25">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="var(--ad-ink-strong, #000)" strokeOpacity=".9" d="M13.786 18.639h-.5v4.416c0 .675-.816 1.013-1.293.536L1.103 12.717c-.297-.296-.297-.776 0-1.072L11.993.77c.477-.477 1.293-.138 1.293.537V5.73H31.1c.419 0 .758.34.758.758v11.392c0 .418-.34.758-.758.758z"></path>
    </svg>
  </span>
</button>;
}
