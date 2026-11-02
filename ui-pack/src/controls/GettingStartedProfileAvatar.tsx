import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedProfileAvatar({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "color": "rgb(255, 255, 255)",
    "display": "flex",
    "flexShrink": "0",
    "height": "24px",
    "justifyContent": "center",
    "minWidth": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "verticalAlign": "top",
    "width": "24px",
    "borderRadius": "9999px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    ...style
  }} aria-label="Quan Vu (Richard)" role="img" className={className}>
              <span style={{
      "display": "block",
      "fontSize": "13px",
      "fontWeight": "450",
      "verticalAlign": "top"
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
      "verticalAlign": "top",
      "width": "24px",
      "minWidth": "0px",
      "minHeight": "0px"
    }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
              <span style={{
      "bottom": "0px",
      "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
      "display": "block",
      "height": "24px",
      "left": "0px",
      "position": "absolute",
      "right": "0px",
      "top": "0px",
      "width": "24px",
      "minWidth": "0px",
      "minHeight": "0px",
      "borderRadius": "9999px"
    }}></span>
            </div>;
}
