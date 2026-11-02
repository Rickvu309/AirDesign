import type { AirDesignComponentProps } from "../types.ts";

export function UnderstandTheDeckButton({
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
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6.057 14.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.458.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 16a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.057 9.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.457.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 11a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.058 4.763c.185-.35.7-.35.884 0l.034.08.295.886.886.294c.457.153.457.8 0 .953l-.886.295-.295.885a.502.502 0 0 1-.952 0l-.295-.885-.886-.295a.502.502 0 0 1 0-.953l.885-.295.296-.885zM18.5 6a.5.5 0 0 1 0 1h-8a.5.5 0 0 1 0-1z" clipRule="evenodd"></path>
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
  Understand the deck
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
