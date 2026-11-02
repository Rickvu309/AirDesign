import type { AirDesignComponentProps } from "../types.ts";

export function InviteButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(217, 217, 217)",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "flexShrink": "0",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "550",
    "height": "32px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "center",
    "width": "53.3984px",
    "minWidth": "0px",
    "borderRadius": "5px",
    "padding": "4px 12px",
    position: "relative",
    ...style
  }} type="submit" aria-disabled="true" disabled={true} className={className}>
  Invite
</button>;
}
