import type { AirDesignComponentProps } from "../types.ts";

export function SearchStockPhotosInput({
  style,
  className
}: AirDesignComponentProps) {
  return <input style={{
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "color": "rgba(0, 0, 0, 0.898)",
    "display": "block",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "overflowX": "clip",
    "overflowY": "clip",
    "unicodeBidi": "isolate",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 200,
    ...style
  }} aria-label="Search stock photos" placeholder="Search images" type="text" value="" className={className}></input>;
}
