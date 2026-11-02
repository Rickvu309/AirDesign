import type { AirDesignComponentProps } from "../types.ts";

export function SlideNumberButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <span style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "4px",
      "display": "flex",
      "maxWidth": "100%",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "rowGap": "4px",
      "padding": "8px"
    }}>
    <span style={{
        "alignItems": "center",
        "display": "flex"
      }} aria-hidden="true">
      <svg style={{
          "display": "block",
          "height": "24px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "24px"
        }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
            "fill": "rgba(0, 0, 0, 0.898)"
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 1a8 8 0 1 0 0 16 8 8 0 0 0 0-16m3.056 3.003a.5.5 0 0 1 .441.553L15.336 9H16.5a.5.5 0 0 1 0 1h-1.274l-.445 4H16.5a.5.5 0 0 1 0 1h-1.83l-.173 1.556a.5.5 0 0 1-.994-.112L13.664 15H9.67l-.173 1.556a.5.5 0 0 1-.994-.112L8.664 15H7.5a.5.5 0 0 1 0-1h1.274l.445-4H7.5a.5.5 0 0 1 0-1h1.83l.173-1.556a.5.5 0 0 1 .994.112L10.336 9h3.994l.173-1.556a.5.5 0 0 1 .553-.441M9.78 14h3.993l.445-4h-3.993z"></path>
      </svg>
    </span>
    <span style={{
        "display": "block",
        "flexGrow": "1",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "fontWeight": "450",
        "letterSpacing": "-0.032px",
        "lineHeight": "22px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }}>
      <span style={{
          "whiteSpace": "nowrap"
        }}>Slide number</span>
    </span>
  </span>
</button>;
}
