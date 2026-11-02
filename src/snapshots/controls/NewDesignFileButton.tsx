import type { AirDesignProps } from "../types.js";

export function NewDesignFileButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
    "boxShadow": "var(--ad-divider, rgb(230, 230, 230)) 0px 0px 0px 1px inset",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
  }} aria-label="New Design file" type="button" className={className} {...rest}>
                <div style={{
      "display": "grid",
      "gridTemplateColumns": "92.4375px",
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
          "columnGap": "8px",
          "display": "flex",
          "rowGap": "8px",
          "padding": "8px 16px"
        }}>
                      <div style={{
            "backgroundColor": "var(--ad-selection, rgb(13, 153, 255))",
            "borderRadius": "2px"
          }}>
                        <svg style={{
              "display": "block",
              "height": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "16px"
            }} width="16" height="16" fill="none" viewBox="0 0 64 64"><path d="M13 57l19-50 19 50" fill="none" stroke="var(--ad-ink, #1A1A1A)" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
                      </div>
                      <span style={{
            "alignItems": "center",
            "columnGap": "4px",
            "display": "flex",
            "rowGap": "4px"
          }}>
                        <span style={{
              "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
              "display": "block",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontWeight": "450",
              "letterSpacing": "0.05504px"
            }}>
                          Design
                        </span>
                      </span>
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
          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))"
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
