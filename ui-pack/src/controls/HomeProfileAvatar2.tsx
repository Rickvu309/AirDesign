import type { AirDesignComponentProps } from "../types.ts";

export function HomeProfileAvatar2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "backgroundColor": "rgb(242, 72, 34)",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "flexShrink": "0",
    "height": "16px",
    "justifyContent": "center",
    "minWidth": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "width": "16px",
    "borderRadius": "9999px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    ...style
  }} aria-label="Quan Vu" role="img" className={className}>
        <span style={{
      "display": "block",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "10px",
      "fontWeight": "500",
      "textAlign": "center"
    }}>
          Q
        </span>
      </div>;
}
