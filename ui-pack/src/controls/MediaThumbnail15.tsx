import type { AirDesignComponentProps } from "../types.ts";

export function MediaThumbnail15({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "outlineColor": "rgba(0, 0, 0, 0.1)",
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
  }} type="button" className={className}>
  <img style={{
      "display": "block",
      "height": "199.5px",
      "overflowX": "clip",
      "overflowY": "clip",
      "width": "133px"
    }} alt="Green palm fronds silhouetted against a bright sky with soft white clouds" src="https://images.unsplash.com/photo-1793457984081-2fa841fac172?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw1fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>;
}
