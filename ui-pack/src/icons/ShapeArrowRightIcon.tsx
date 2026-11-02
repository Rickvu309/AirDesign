import type { AirDesignComponentProps } from "../types.ts";

export function ShapeArrowRightIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "25px",
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
  }} width="33" height="25" viewBox="0 0 33 25" className={className}>
      <path style={{
      "strokeOpacity": "0.9"
    }} stroke="#000" strokeOpacity=".9" d="M19.213 19.484v-.5H1.4c-.418 0-.758-.34-.758-.759V6.836c0-.42.34-.759.758-.759h17.813V1.653c0-.675.816-1.014 1.294-.537l10.89 10.874c.296.296.296.776 0 1.072l-10.89 10.874c-.478.477-1.294.139-1.294-.537z"></path>
    </svg>;
}
