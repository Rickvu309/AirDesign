import type { AirDesignProps } from "../types.ts";

export function ShapeArrowLeftIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "25px",
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
  }} width="33" height="25" viewBox="0 0 33 25" className={className} {...rest}>
      <path style={{
      "strokeOpacity": "0.9"
    }} stroke="var(--ad-ink-strong, #000)" strokeOpacity=".9" d="M13.786 18.639h-.5v4.416c0 .675-.816 1.013-1.293.536L1.103 12.717c-.297-.296-.297-.776 0-1.072L11.993.77c.477-.477 1.293-.138 1.293.537V5.73H31.1c.419 0 .758.34.758.758v11.392c0 .418-.34.758-.758.758z"></path>
    </svg>;
}
