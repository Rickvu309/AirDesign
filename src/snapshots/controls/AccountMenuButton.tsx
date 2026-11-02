import type { AirDesignProps } from "../types.js";

export function AccountMenuButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyItems": "center",
    "lineHeight": "0px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "4px",
    "padding": "0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Account dropdown for Your Name" type="button" className={className} {...rest}>
    <div style={{
      "alignItems": "center",
      "columnGap": "8px",
      "display": "flex",
      "rowGap": "8px",
      "minWidth": "0px"
    }}>
      <div style={{
        "display": "flex",
        "position": "relative"
      }}>
        <span style={{
          "display": "block"
        }} aria-hidden="true">
          <div style={{
            "alignItems": "center",
            "color": "var(--ad-surface, rgb(255, 255, 255))",
            "display": "flex",
            "flexShrink": "0",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "position": "relative",
            "width": "24px",
            "borderRadius": "9999px"
          }} aria-label="Your Name" role="img">
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
          </div>
        </span>
      </div>
      <span style={{
        "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "500",
        "letterSpacing": "-0.003px",
        "lineHeight": "24px",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }}>
        <span style={{
          "whiteSpace": "nowrap"
        }}>Your Name</span>
      </span>
    </div>
    <svg style={{
      "display": "block",
      "flexShrink": "0",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
      <path style={{
        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
      }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
    </svg>
  </button>;
}
