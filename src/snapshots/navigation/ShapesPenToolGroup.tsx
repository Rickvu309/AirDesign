import type { AirDesignProps } from "../types.js";

export function ShapesPenToolGroup({
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
  }} aria-label="Pen" role="group" className={className} {...rest}>
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
    }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
        }} d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
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
    }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
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
