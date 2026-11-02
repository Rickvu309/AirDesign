import type { AirDesignComponentProps } from "../types.ts";

export function PrepareToPresentButton({
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
    "lineHeight": "16px",
    "textAlign": "left",
    "width": "272px",
    "borderRadius": "13px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-expanded="false" className={className}>
                            <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "height": "24px",
      "justifyContent": "center",
      "width": "24px"
    }} aria-hidden="true">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "rgba(0, 0, 0, 0.5)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
  </svg>
</span>
                            <span style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "13px",
      "fontWeight": "450",
      "letterSpacing": "-0.032px",
      "lineHeight": "22px",
      "marginLeft": "8px"
    }}>
  Prepare to present
</span>
                            <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "height": "24px",
      "justifyContent": "center",
      "marginLeft": "4px",
      "width": "24px"
    }} aria-hidden="true">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>;
}
