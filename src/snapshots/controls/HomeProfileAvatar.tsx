import type { AirDesignProps } from "../types.js";

export function HomeProfileAvatar({
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
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "13px",
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
