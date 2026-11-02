import type { AirDesignProps } from "../types.js";

export function PlanButton({
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
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "4px",
    "padding": "0px 0px 0px 4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Plan: Your Name" type="button" className={className} {...rest}>
                <div style={{
      "alignItems": "center",
      "display": "flex",
      "overflowX": "hidden",
      "overflowY": "hidden"
    }}>
                  <div style={{
        "alignItems": "center",
        "display": "flex",
        "flexShrink": "0",
        "height": "24px",
        "justifyContent": "center",
        "width": "24px"
      }}>
  <div style={{
          "position": "relative"
        }}>
    <span aria-hidden="true">
      <div style={{
              "alignItems": "center",
              "backgroundColor": "rgb(242, 72, 34)",
              "color": "var(--ad-surface, rgb(255, 255, 255))",
              "display": "flex",
              "flexShrink": "0",
              "height": "16px",
              "justifyContent": "center",
              "minWidth": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "position": "relative",
              "width": "16px",
              "borderRadius": "9999px"
            }} aria-label="Your Name" role="img">
        <span style={{
                "display": "block",
                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                "fontSize": "10px",
                "fontWeight": "500",
                "textAlign": "center"
              }}>
          Q
        </span>
      </div>
    </span>
    <div style={{
            "boxShadow": "rgba(255, 255, 255, 0.4) 0px 0px 0px 1px inset",
            "height": "16px",
            "position": "absolute",
            "top": "0px",
            "width": "16px",
            "borderRadius": "100%"
          }}></div>
  </div>
</div>
                  <div style={{
        "display": "flex",
        "marginLeft": "8px",
        "overflowX": "hidden",
        "overflowY": "hidden"
      }}>
  <span style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "block",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "13px",
          "fontWeight": "550",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px",
          "maxWidth": "100%",
          "overflowWrap": "break-word",
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
                </div>
                <svg style={{
      "display": "block",
      "flexShrink": "0",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
      }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
                </svg>
              </button>;
}
