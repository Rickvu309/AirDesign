import type { AirDesignProps } from "../types.js";

export function ShareMoveToFolderButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
    "color": "var(--ad-brand-strong, rgb(226, 76, 12))",
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
  }} type="button" className={className} {...rest}>
    <span style={{
      "whiteSpace": "nowrap"
    }}>Move to folder</span>
  </button>;
}
