import type { AirDesignProps } from "../types.ts";

export function AccountButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-surface, rgb(255, 255, 255))",
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
  }} aria-haspopup="dialog" aria-expanded="false" aria-label="Your Name" type="button" className={className} {...rest}>
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
      }} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" alt=""></img>
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
        "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
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
