import type { AirDesignProps } from "../types.js";

export function ShapesRectangleToolGroup({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Rectangle" role="group" className={className} {...rest}>
    <button style={{
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
      "padding": "4px"
    }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
        }} fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
      </svg>
    </button>
    <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
        "display": "block"
      }} aria-hidden="true">
        <svg style={{
          "display": "block",
          "height": "24px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "24px"
        }} width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path style={{
            "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
          }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>;
}
