import type { AirDesignProps } from "../types.js";

export function RecentFileButtonVietjetProject({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "space-between",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "240px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-description="Folder" type="button" className={className} {...rest}>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "height": "28px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingLeft": "4px",
      "paddingRight": "4px",
      "width": "224px",
      "borderRadius": "5px",
      "margin": "2px 8px"
    }}>
        <div></div>
        <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "rowGap": "8px",
        "width": "216px"
      }}>
          <div style={{
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
              "fill": "var(--ad-folder, rgb(175, 188, 207))"
            }} d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
          "display": "block",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "textOverflow": "ellipsis",
          "whiteSpace": "nowrap"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Vietjet Project</span>
          </span>
        </div>
        <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0"
      }}></div>
      </div>
    </button>;
}
