import type { AirDesignComponentProps } from "../types.ts";

export function ShapeCrossIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "26px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "fill": "rgb(61, 56, 245)",
    "stroke": "rgb(43, 39, 172)",
    "strokeWidth": "2px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="27" height="26" viewBox="0 0 27 26" className={className}>
      <path style={{
      "strokeOpacity": "0.9"
    }} stroke="#000" strokeOpacity=".9" d="M7.972 8.083h.5V1.477c0-.54.438-.977.978-.977h7.878c.54 0 .978.438.978.977v6.606h6.606c.54 0 .977.438.977.978v7.878c0 .54-.437.978-.977.978h-6.606v6.606c0 .54-.438.977-.978.977H9.45c-.54 0-.978-.437-.978-.977v-6.606H1.866c-.54 0-.977-.438-.977-.978V9.061c0-.54.438-.978.977-.978z"></path>
    </svg>;
}
