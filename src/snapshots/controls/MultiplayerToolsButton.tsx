import type { AirDesignProps } from "../types.js";

export function MultiplayerToolsButton({
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
    "height": "24px",
    "justifyContent": "center",
    "lineHeight": "16px",
    "outlineColor": "rgba(0, 0, 0, 0)",
    "outlineStyle": "solid",
    "outlineWidth": "2px",
    "textAlign": "center",
    "borderRadius": "50px",
    "padding": "0px 2px 0px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" aria-label="Multiplayer tools" aria-haspopup="dialog" className={className} {...rest}>
                            <div style={{
      "alignItems": "center",
      "display": "flex"
    }} role="none">
                              <span style={{
        "display": "flex",
        "flexShrink": "0",
        "position": "relative"
      }}>
                                <span style={{
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "6px",
          "margin": "-6px"
        }}>
                                  <span style={{
            "display": "block"
          }}>
  <span style={{
              "display": "block",
              "position": "relative"
            }}>
    <div style={{
                "alignItems": "center",
                "display": "flex",
                "flexBasis": "30px",
                "flexShrink": "0",
                "height": "40px",
                "justifyContent": "center",
                "position": "relative",
                "width": "24px"
              }}>
      <div style={{
                  "display": "flex"
                }}>
        <svg style={{
                    "bottom": "-20px",
                    "display": "block",
                    "height": "40px",
                    "left": "12px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "position": "absolute",
                    "right": "-18px",
                    "top": "20px",
                    "transform": "matrix(1, 0, 0, 1, -15, -20)",
                    "transformOrigin": "15px 20px",
                    "width": "30px",
                    "minWidth": "0px",
                    "minHeight": "0px"
                  }} viewBox="0 0 30 40" aria-hidden="true">
          <circle style={{
                      "stroke": "var(--ad-brand, rgb(255, 92, 22))",
                      "strokeWidth": "2px",
                      "strokeDasharray": "400px",
                      "strokeDashoffset": "400px"
                    }} cx="15" cy="20" r="13" fill="none" stroke="var(--color-bg-brand)" strokeWidth="2"></circle>
        </svg>
        <div>
          <div style={{
                      "alignItems": "center",
                      "display": "inline-flex",
                      "flexShrink": "0",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "12px",
                      "justifyContent": "center",
                      "lineHeight": "24px",
                      "position": "relative",
                      "verticalAlign": "top",
                      "borderRadius": "100%"
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
                        "verticalAlign": "top",
                        "width": "24px",
                        "borderRadius": "9999px"
                      }} aria-label="Your Name" role="img">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </span>
</span>
                                </span>
                              </span>
                              <span style={{
        "display": "flex",
        "flexShrink": "0",
        "marginLeft": "-3px",
        "position": "relative"
      }}>
                                <span style={{
          "boxSizing": "content-box",
          "display": "flex",
          "maskImage": "radial-gradient(14px at -3px 50%, rgba(0, 0, 0, 0) 99%, var(--ad-surface, rgb(255, 255, 255)) 100%)",
          "padding": "6px",
          "margin": "-6px"
        }}>
                                  <span style={{
            "alignItems": "center",
            "display": "flex"
          }}>
  <div style={{
              "alignItems": "center",
              "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
              "boxSizing": "content-box",
              "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
              "display": "flex",
              "height": "24px",
              "justifyContent": "center",
              "width": "24px",
              "border": "2px solid var(--ad-surface, rgb(255, 255, 255))",
              "borderRadius": "9999px"
            }}>
    <svg style={{
                "display": "block",
                "height": "24px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "width": "24px"
              }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                  "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </div>
</span>
                                </span>
                              </span>
                            </div>
                          </button>;
}
