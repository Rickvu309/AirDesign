import type { AirDesignProps } from "../types.ts";

export function SpeechBubbleButton({
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
  }} aria-current="false" aria-label="Speech bubble" type="button" className={className} {...rest}>
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
        "height": "29px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "var(--ad-accent, rgb(61, 56, 245))",
        "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
        "strokeWidth": "2px"
      }} width="33" height="29" viewBox="0 0 33 29">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="var(--ad-ink-strong, #000)" strokeOpacity=".9" d="M10 21.392v-.5H2.063c-.437 0-.792-.355-.792-.792V1.684c0-.437.355-.792.792-.792H31.48c.437 0 .792.355.792.792V20.1c0 .437-.355.792-.792.792H19.49l-.141.125-8.034 7.102c-.511.452-1.317.089-1.317-.594z"></path>
    </svg>
  </span>
</button>;
}
