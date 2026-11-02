import type { AirDesignComponentProps } from "../types.ts";

export function AirDesignLogo({ style, className }: AirDesignComponentProps) {
  return (<div style={{
  "color": "rgb(26, 26, 26)",
  "direction": "ltr",
  "flexShrink": "0",
  "fontFamily": "Geist, system-ui, sans-serif",
  "fontSize": "16px",
  "fontStyle": "normal",
  "fontWeight": "400",
  "height": "28px",
  "letterSpacing": "normal",
  "lineHeight": "normal",
  "overflowWrap": "normal",
  "textAlign": "start",
  "textTransform": "none",
  "wordBreak": "normal",
  "whiteSpace": "normal",
  "backgroundColor": "rgb(255, 255, 255)",
  position: "relative",
  boxSizing: "border-box",
  width: 28,
  ...style
}} className={className}>
  <svg style={{
    "bottom": "0px",
    "display": "block",
    "height": "28px",
    "left": "0px",
    "position": "absolute",
    "right": "0px",
    "top": "0px",
    "width": "28px",
    "zIndex": "0"
  }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true">
    <path style={{
      "stroke": "rgb(26, 26, 26)",
      "strokeWidth": "3.063px"
    }} d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth="3.063" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
  </svg>
  <svg style={{
    "bottom": "0px",
    "display": "block",
    "height": "28px",
    "left": "0px",
    "position": "absolute",
    "right": "0px",
    "top": "0px",
    "width": "28px",
    "zIndex": "1"
  }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true">
    <path style={{
      "stroke": "rgb(255, 88, 174)",
      "strokeWidth": "2.188px"
    }} d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth="2.188" strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
  </svg>
</div>);
}
