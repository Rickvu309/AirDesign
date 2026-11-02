import type { AirDesignProps } from "../types.js";

export function ShapeSpeechBubbleIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "29px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "fill": "var(--ad-accent, rgb(61, 56, 245))",
    "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
    "strokeWidth": "2px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="33" height="29" viewBox="0 0 33 29" className={className} {...rest}>
      <path style={{
      "strokeOpacity": "0.9"
    }} stroke="var(--ad-ink-strong, #000)" strokeOpacity=".9" d="M10 21.392v-.5H2.063c-.437 0-.792-.355-.792-.792V1.684c0-.437.355-.792.792-.792H31.48c.437 0 .792.355.792.792V20.1c0 .437-.355.792-.792.792H19.49l-.141.125-8.034 7.102c-.511.452-1.317.089-1.317-.594z"></path>
    </svg>;
}
