import type { AirDesignProps } from "../types.js";

export function StyleOptionsButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "appearance": "auto",
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "48px",
    "lineHeight": "16px",
    "textAlign": "left",
    "width": "208px",
    "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} type="button" aria-disabled="true" aria-haspopup="listbox" aria-expanded="false" role="combobox" aria-label="Style: Light slides, Fonts: Inter" className={className} {...rest}>
  <div style={{
      "isolation": "isolate",
      "position": "relative",
      "width": "206px"
    }}>
    <div style={{
        "alignItems": "center",
        "boxSizing": "border-box",
        "display": "flex",
        "height": "46px",
        "position": "relative",
        "width": "206px",
        "padding": "7px"
      }}>
      <div style={{
          "display": "flex",
          "flexShrink": "0",
          "height": "32px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "32px",
          "borderRadius": "2px"
        }}>
        <div style={{
            "height": "32px",
            "position": "relative",
            "width": "32px"
          }}>
          <div style={{
              "boxSizing": "border-box",
              "height": "32px",
              "left": "0px",
              "position": "absolute",
              "top": "0px",
              "width": "32px",
              "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
              "borderRadius": "2px"
            }}></div>
          <div style={{
              "display": "flex",
              "height": "32px",
              "width": "32px"
            }}>
            <div style={{
                "backgroundColor": "rgb(207, 207, 207)",
                "flexGrow": "1",
                "height": "32px"
              }}></div>
            <div style={{
                "backgroundColor": "rgb(81, 131, 148)",
                "flexGrow": "1",
                "height": "32px"
              }}></div>
            <div style={{
                "backgroundColor": "var(--ad-accent, rgb(61, 56, 245))",
                "flexGrow": "1",
                "height": "32px"
              }}></div>
          </div>
        </div>
        <span style={{
            "bottom": "0px",
            "display": "block",
            "height": "46px",
            "left": "0px",
            "position": "absolute",
            "right": "0px",
            "top": "0px",
            "width": "206px",
            "zIndex": "-1",
            "minWidth": "0px",
            "minHeight": "0px"
          }}></span>
      </div>
      <div style={{
          "alignItems": "center",
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "flex",
          "flexGrow": "1",
          "justifyContent": "space-between",
          "overflowX": "hidden",
          "overflowY": "hidden"
        }}>
        <div style={{
            "flexGrow": "1",
            "marginLeft": "8px",
            "overflowX": "hidden",
            "overflowY": "hidden"
          }}>
          <div style={{
              "fontWeight": "550",
              "height": "16px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "textOverflow": "ellipsis",
              "width": "140px",
              "whiteSpace": "nowrap"
            }}>
            <span style={{
                "whiteSpace": "nowrap"
              }}>Light slides</span>
          </div>
          <div style={{
              "alignItems": "flex-start",
              "display": "flex",
              "height": "16px",
              "scale": "0.7",
              "transformOrigin": "0px 8px",
              "width": "140px"
            }}>
            <div>
              <p style={{
                  "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "15px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "marginBottom": "0px",
                  "marginTop": "0px",
                  "whiteSpace": "nowrap"
                }} aria-hidden="true">
                <span style={{
                    "whiteSpace": "nowrap"
                  }}>Inter</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</button>;
}
