import type { AirDesignProps } from "../types.js";

export function ShapesFrameButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true" className={className} {...rest}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
      }} fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
  </svg>
</button>;
}
