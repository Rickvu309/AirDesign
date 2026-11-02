import type { AirDesignComponentProps } from "../types.ts";

export function MoreButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(245, 245, 245)",
    "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "flexShrink": "0",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="More" type="button" className={className}>
                <div style={{
      "display": "grid",
      "gridTemplateColumns": "75.0391px",
      "gridTemplateRows": "32px"
    }}>
                  <div style={{
        "gridColumnEnd": "auto",
        "gridRowEnd": "auto",
        "gridColumnStart": "1",
        "gridRowStart": "1"
      }}>
                    <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                      <span style={{
            "color": "rgba(0, 0, 0, 0.898)",
            "display": "block",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontWeight": "450",
            "letterSpacing": "0.05504px"
          }}>
                        More
                      </span>
                      <svg style={{
            "display": "block",
            "height": "16px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "width": "16px"
          }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                        <path style={{
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                      </svg>
                    </div>
                  </div>
                  <div style={{
        "gridColumnEnd": "auto",
        "gridRowEnd": "auto",
        "opacity": "0",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "gridColumnStart": "1",
        "gridRowStart": "1"
      }}>
                    <div style={{
          "backgroundColor": "rgb(255, 255, 255)"
        }}>
                      <div style={{
            "backgroundColor": "rgba(0, 0, 0, 0.05)",
            "height": "32px",
            "minHeight": "12px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "borderRadius": "2px"
          }}>
                        <div style={{
              "backgroundColor": "rgba(255, 255, 255, 0.1)",
              "height": "32px",
              "opacity": "0.560982"
            }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>;
}
