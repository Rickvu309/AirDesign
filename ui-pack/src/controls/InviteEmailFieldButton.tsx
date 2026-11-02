import type { AirDesignComponentProps } from "../types.ts";

export function InviteEmailFieldButton({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignContent": "flex-start",
    "columnGap": "4px",
    "display": "flex",
    "flexWrap": "wrap",
    "rowGap": "4px",
    "minWidth": "0px",
    "borderRadius": "3px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 448,
    ...style
  }} className={className}>
      <input style={{
      "appearance": "auto",
      "backgroundColor": "rgb(245, 245, 245)",
      "boxSizing": "content-box",
      "color": "rgba(0, 0, 0, 0.898)",
      "display": "block",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "11px",
      "fontWeight": "450",
      "lineHeight": "16px",
      "marginLeft": "4px",
      "overflowX": "clip",
      "overflowY": "clip",
      "unicodeBidi": "isolate",
      "width": "367.602px",
      "border": "1px solid rgba(0, 0, 0, 0)",
      "padding": "3px 3px 3px 0px"
    }} aria-expanded="false" aria-label="Add comma separated emails to invite" placeholder="Add comma separated emails to invite" role="combobox" value=""></input>
    </div>;
}
