import type { AirDesignComponentProps } from "../types.ts";

export function InsertTextButton({
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
      "backgroundColor": "rgb(189, 227, 255)",
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
      }} alt="Text" src="https://static.figma.com/uploads/e614e423effbdc48395995943326a08f9627c698"></img>
  </div>
  <div style={{
      "color": "rgba(0, 0, 0, 0.898)",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "450",
      "letterSpacing": "0.05504px"
    }}>
    Text
  </div>
</button>;
}
