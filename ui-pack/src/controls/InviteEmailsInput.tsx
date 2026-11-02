import type { AirDesignComponentProps } from "../types.ts";

export function InviteEmailsInput({
  style,
  className
}: AirDesignComponentProps) {
  return <input style={{
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxSizing": "content-box",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "block",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "lineHeight": "16px",
    "marginLeft": "4px",
    "overflowX": "clip",
    "overflowY": "clip",
    "unicodeBidi": "isolate",
    "border": "1px solid rgba(0, 0, 0, 0)",
    "padding": "3px 3px 3px 0px",
    position: "relative",
    flexShrink: 0,
    width: 200,
    ...style
  }} aria-expanded="false" aria-label="Add comma separated emails to invite" placeholder="Add comma separated emails to invite" role="combobox" value="" className={className}></input>;
}
