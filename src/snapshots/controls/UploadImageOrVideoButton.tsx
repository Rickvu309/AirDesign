import type { AirDesignProps } from "../types.js";

export function UploadImageOrVideoButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "display": "flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "24px",
    "justifyItems": "center",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "maxWidth": "100%",
    "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "center",
    "width": "274px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Upload image or video" type="button" className={className} {...rest}>
    <span style={{
      "display": "flex",
      "height": "24px",
      "maxWidth": "100%",
      "width": "274px"
    }}>
      <span style={{
        "alignItems": "center",
        "boxSizing": "border-box",
        "display": "flex",
        "justifyContent": "center",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "paddingLeft": "8px",
        "paddingRight": "8px",
        "width": "274px"
      }}>
        <span style={{
          "alignItems": "center",
          "display": "flex",
          "height": "24px",
          "marginLeft": "-8px",
          "marginRight": "4px"
        }} aria-hidden="true">
          <svg style={{
            "display": "block",
            "height": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "24px"
          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
            }} d="M17.5 13a.5.5 0 0 1 .5.5v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-3a.5.5 0 0 1 1 0v3a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 .5-.5m-5.775-7.918a.5.5 0 0 1 .629.064l3.5 3.5a.5.5 0 0 1-.707.708L12.5 6.707V12.5a.5.5 0 0 1-1 0V6.707L8.854 9.354a.5.5 0 1 1-.708-.708l3.5-3.5z"></path>
          </svg>
        </span>
        <span style={{
          "display": "block",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>Upload image or video</span>
        </span>
      </span>
    </span>
  </button>;
}
