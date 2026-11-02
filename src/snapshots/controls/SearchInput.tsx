import type { AirDesignProps } from "../types.js";

export function SearchInput({
  style,
  className,
  ...rest
}: AirDesignProps<"input">) {
  return <input style={{
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "marginRight": "10px",
    "overflowX": "clip",
    "overflowY": "clip",
    "textOverflow": "ellipsis",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 200,
    ...style
  }} aria-description="Search results; results will update as you type" aria-label="Search" placeholder="Search" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox" type="text" value="" className={className} {...rest}></input>;
}
