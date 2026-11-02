import type { AirDesignComponentProps } from "../types.ts";

export function AccountButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "minWidth": "24px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-haspopup="dialog" aria-expanded="false" aria-label="Quan Vu (Richard)" type="button" className={className}>
                      <span style={{
      "alignItems": "center",
      "bottom": "0px",
      "display": "flex",
      "justifyContent": "center",
      "left": "0px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "absolute",
      "right": "0px",
      "top": "0px",
      "minWidth": "0px",
      "minHeight": "0px",
      "borderRadius": "9999px"
    }}>
                        <span style={{
        "display": "block",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "15px",
        "fontWeight": "450",
        "lineHeight": "24px",
        "textAlign": "center"
      }}>
                          Q
                        </span>
                        <img style={{
        "bottom": "0px",
        "display": "block",
        "height": "24px",
        "left": "0px",
        "objectFit": "cover",
        "overflowX": "clip",
        "overflowY": "clip",
        "position": "absolute",
        "right": "0px",
        "top": "0px",
        "width": "24px",
        "minWidth": "0px",
        "minHeight": "0px"
      }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
                        <span style={{
        "bottom": "0px",
        "boxSizing": "border-box",
        "display": "block",
        "height": "24px",
        "left": "0px",
        "position": "absolute",
        "right": "0px",
        "top": "0px",
        "width": "24px",
        "minWidth": "0px",
        "minHeight": "0px",
        "border": "1px solid rgba(0, 0, 0, 0.1)",
        "borderRadius": "9999px"
      }}></span>
                      </span>
                      <span style={{
      "bottom": "-2px",
      "display": "block",
      "left": "-2px",
      "position": "absolute",
      "right": "-2px",
      "top": "-2px",
      "minWidth": "0px",
      "minHeight": "0px",
      "borderRadius": "9999px"
    }}></span>
                    </button>;
}
