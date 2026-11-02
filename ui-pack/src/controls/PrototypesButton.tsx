import type { AirDesignComponentProps } from "../types.ts";

export function PrototypesButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "columnGap": "8px",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "lineHeight": "16px",
    "rowGap": "8px",
    "textAlign": "start",
    "width": "290px",
    "borderRadius": "5px",
    "padding": "8px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" className={className}>
  <div style={{
      "alignItems": "center",
      "backgroundColor": "rgb(180, 178, 255)",
      "display": "flex",
      "flexShrink": "0",
      "height": "56px",
      "justifyContent": "center",
      "width": "56px",
      "borderRadius": "5px"
    }}>
    <img style={{
        "display": "block",
        "height": "48px",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "48px"
      }} alt="Prototypes" src="https://static.figma.com/uploads/90daffd5edf313ad0d686805b52c6cb6617ec7b9"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Prototypes
  </div>
</button>;
}
