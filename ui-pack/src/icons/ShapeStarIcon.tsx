import type { AirDesignComponentProps } from "../types.ts";

export function ShapeStarIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "27px",
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
  }} width="29" height="27" viewBox="0 0 29 27" className={className}>
      <path style={{
      "strokeOpacity": "0.9"
    }} stroke="#000" strokeOpacity=".9" d="m15.181 1.718 3.16 6.359c.274.552.801.935 1.411 1.025l7.024 1.04c.723.107 1.012.995.49 1.507l-5.071 4.97c-.441.431-.642 1.051-.54 1.66l1.182 7c.122.721-.634 1.27-1.282.932l-6.293-3.287c-.547-.286-1.199-.286-1.745 0L7.223 26.21c-.648.338-1.403-.21-1.282-.931l1.182-7.002c.102-.608-.099-1.228-.54-1.66l-5.07-4.969c-.523-.511-.234-1.4.49-1.507l7.023-1.04c.61-.09 1.137-.473 1.412-1.025l3.159-6.359c.325-.654 1.259-.654 1.584 0Z"></path>
    </svg>;
}
