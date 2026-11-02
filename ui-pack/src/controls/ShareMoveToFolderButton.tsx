import type { AirDesignComponentProps } from "../types.ts";

export function ShareMoveToFolderButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 223, 204)",
    "color": "rgb(226, 76, 12)",
    "display": "inline-flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "justifyItems": "center",
    "lineHeight": "16px",
    "marginRight": "8px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
    <span style={{
      "whiteSpace": "nowrap"
    }}>Move to folder</span>
  </button>;
}
