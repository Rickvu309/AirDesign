import type { AirDesignProps } from "../types.ts";

export function MediaThumbnail20({
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
      "height": "88.4375px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="A woman in a white headscarf and t-shirt watching colorful koi fish in a pond" src="https://images.unsplash.com/photo-1793067321405-31bad6764f8d?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxN3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
