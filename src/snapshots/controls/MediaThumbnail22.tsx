import type { AirDesignProps } from "../types.js";

export function MediaThumbnail22({
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
    "justifyItems": "center",
    "lineHeight": "16px",
    "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} type="button" className={className} {...rest}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A gold necklace, ring, and stud earrings with diamond accents on a white fabric background" src="https://images.unsplash.com/photo-1793054733110-b22c822e97b6?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
