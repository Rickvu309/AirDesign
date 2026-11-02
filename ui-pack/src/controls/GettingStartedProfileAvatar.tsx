import type { AirDesignProps } from "../types.ts";

export function GettingStartedProfileAvatar({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "alignItems": "center",
    "color": "var(--ad-surface, rgb(255, 255, 255))",
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
  }} aria-label="Your Name" role="img" className={className} {...rest}>
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
    }} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" alt=""></img>
              <span style={{
      "bottom": "0px",
      "boxShadow": "var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 0px 0px 1px inset",
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
