import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedSelectDeckTemplateButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.898)",
    "columnGap": "4px",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "maxWidth": "240px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "rowGap": "4px",
    "textAlign": "start",
    "minWidth": "0px",
    "border": "1px solid rgb(230, 230, 230)",
    "borderRadius": "9999px",
    "padding": "4px 8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="Select deck template" type="button" className={className}>
                            <svg style={{
      "display": "block",
      "flexShrink": "0",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M8 2a6 6 0 0 1 5.934 6.895C13.719 10.325 12.39 11 11.274 11H9c0 .821-.343 1.61-.93 2.129-.576.508-1.394.75-2.238.463l-.169-.065A6.001 6.001 0 0 1 8 2m0 1a5 5 0 0 0-1.947 9.606C7.07 13.036 8 12.104 8 11a1 1 0 0 1 1-1h2.274l.149-.006c.69-.05 1.321-.452 1.492-1.104l.03-.144Q13 8.381 13 8a5 5 0 0 0-5-5M5.25 7.986a.75.75 0 1 1-.002 1.502.75.75 0 0 1 .002-1.502m5.5-1.486a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m-5-1.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m3-.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5"></path>
</svg>
                            <span style={{
      "display": "block",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "textOverflow": "ellipsis",
      "minWidth": "0px",
      "whiteSpace": "nowrap"
    }}>
  <span style={{
        "whiteSpace": "nowrap"
      }}>Select deck template</span>
</span>
                          </button>;
}
