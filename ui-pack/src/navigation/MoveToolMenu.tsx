import type { AirDesignProps } from "../types.ts";

export function MoveToolMenu({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "backgroundColor": "rgb(30, 30, 30)",
    "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.12) 0px 10px 16px 0px, rgba(0, 0, 0, 0.12) 0px 0px 0.5px 0px",
    "boxSizing": "border-box",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "direction": "ltr",
    "fontFamily": "Inter, sans-serif",
    "fontFeatureSettings": "\"calt\", \"liga\"",
    "fontSize": "11px",
    "fontStyle": "normal",
    "fontWeight": "400",
    "letterSpacing": "normal",
    "lineHeight": "16px",
    "maxHeight": "855px",
    "maxWidth": "950px",
    "minWidth": "80px",
    "overflowWrap": "normal",
    "overflowX": "auto",
    "overflowY": "auto",
    "paddingBottom": "8px",
    "paddingTop": "8px",
    "scrollbarWidth": "none",
    "textAlign": "start",
    "textTransform": "none",
    "wordBreak": "normal",
    "WebkitFontSmoothing": "antialiased",
    "whiteSpace": "normal",
    "borderRadius": "13px",
    position: "relative",
    flexShrink: 0,
    width: 151,
    ...style
  }} className={className} {...rest}>
  <div style={{
      "display": "contents"
    }}>
    <ul style={{
        "listStyleImage": "none",
        "listStylePosition": "outside",
        "listStyleType": "none",
        "marginBottom": "0px",
        "marginTop": "0px",
        "paddingLeft": "0px"
      }} role="menu" aria-orientation="vertical">
      <ul style={{
          "listStyleImage": "none",
          "listStylePosition": "outside",
          "listStyleType": "none",
          "marginBottom": "0px",
          "marginTop": "0px",
          "paddingLeft": "0px"
        }} role="group">
        <li style={{
            "clipPath": "inset(50%)",
            "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
            "fontFamily": "Inter, sans-serif",
            "fontSize": "11px",
            "fontWeight": "400",
            "height": "1px",
            "lineHeight": "16px",
            "listStyleImage": "none",
            "listStylePosition": "outside",
            "listStyleType": "none",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "position": "absolute",
            "width": "1px",
            "whiteSpace": "nowrap",
            "margin": "-1px"
          }} role="none">
          <span style={{
              "whiteSpace": "nowrap"
            }}>Move tools</span>
        </li>
        <li style={{
            "alignItems": "center",
            "boxSizing": "content-box",
            "color": "var(--ad-surface, rgb(255, 255, 255))",
            "display": "flex",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontSize": "11px",
            "fontWeight": "450",
            "letterSpacing": "0.05504px",
            "lineHeight": "16px",
            "listStyleImage": "none",
            "listStylePosition": "outside",
            "listStyleType": "none",
            "paddingLeft": "8px",
            "paddingRight": "8px"
          }} role="menuitemradio" aria-checked="true" aria-disabled="false">
          <span style={{
              "alignItems": "center",
              "boxSizing": "border-box",
              "display": "flex",
              "minHeight": "24px",
              "width": "135.297px",
              "whiteSpace": "nowrap",
              "borderRadius": "5px",
              "padding": "4px 8px 4px 4px"
            }}>
            <svg style={{
                "bottom": "0px",
                "display": "block",
                "height": "16px",
                "left": "0px",
                "marginBottom": "-4px",
                "marginRight": "4px",
                "marginTop": "-4px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "relative",
                "right": "0px",
                "top": "0px",
                "width": "16px"
              }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
              <path style={{
                  "fill": "var(--ad-surface, rgb(255, 255, 255))"
                }} d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
            </svg>
            <span style={{
                "alignItems": "center",
                "display": "flex",
                "marginBottom": "-4px",
                "marginRight": "4px",
                "marginTop": "-4px",
                "position": "relative"
              }}>
              <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
                    "fill": "var(--ad-surface, rgb(255, 255, 255))"
                  }} d="M6.586 6.586a2 2 0 0 1 2.005-.497l.14.05 9 3.535a2.002 2.002 0 0 1-.143 3.773l-3.167.974-.974 3.167a2 2 0 0 1-3.773.142l-3.535-9a2 2 0 0 1 .447-2.144m1.78.483a1 1 0 0 0-1.073.224l-.097.111a1 1 0 0 0-.127.961l3.536 9a1 1 0 0 0 .811.627l.157.007a1 1 0 0 0 .86-.559l.058-.146 1.13-3.673 3.673-1.13a1 1 0 0 0 .686-.762l.02-.156a1 1 0 0 0-.493-.9l-.142-.069z"></path>
              </svg>
            </span>
            <div>
              <span style={{
                  "whiteSpace": "nowrap"
                }}>Move</span>
              <div style={{
                  "color": "rgba(255, 255, 255, 0.698)"
                }}></div>
            </div>
            <span style={{
                "boxSizing": "content-box",
                "display": "block",
                "marginLeft": "auto",
                "paddingLeft": "16px"
              }}>
              <div style={{
                  "color": "rgba(255, 255, 255, 0.698)"
                }} aria-hidden="true">
                <span style={{
                    "whiteSpace": "nowrap"
                  }}>V</span>
              </div>
            </span>
          </span>
        </li>
        <li style={{
            "alignItems": "center",
            "boxSizing": "content-box",
            "color": "var(--ad-surface, rgb(255, 255, 255))",
            "display": "flex",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontSize": "11px",
            "fontWeight": "450",
            "letterSpacing": "0.05504px",
            "lineHeight": "16px",
            "listStyleImage": "none",
            "listStylePosition": "outside",
            "listStyleType": "none",
            "paddingLeft": "8px",
            "paddingRight": "8px"
          }} role="menuitemradio" aria-checked="false">
          <span style={{
              "alignItems": "center",
              "boxSizing": "border-box",
              "display": "flex",
              "minHeight": "24px",
              "width": "135.297px",
              "whiteSpace": "nowrap",
              "borderRadius": "5px",
              "padding": "4px 8px 4px 4px"
            }}>
            <svg style={{
                "bottom": "0px",
                "display": "block",
                "height": "16px",
                "left": "0px",
                "marginBottom": "-4px",
                "marginRight": "4px",
                "marginTop": "-4px",
                "opacity": "0",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "relative",
                "right": "0px",
                "top": "0px",
                "width": "16px"
              }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
              <path style={{
                  "fill": "var(--ad-surface, rgb(255, 255, 255))"
                }} d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
            </svg>
            <span style={{
                "alignItems": "center",
                "display": "flex",
                "marginBottom": "-4px",
                "marginRight": "4px",
                "marginTop": "-4px",
                "position": "relative"
              }}>
              <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
                    "fill": "var(--ad-surface, rgb(255, 255, 255))"
                  }} fillRule="evenodd" d="M12 6.5v4a.5.5 0 0 0 1 0v-3a.5.5 0 0 1 1 0v3a.5.5 0 0 0 1 0v-2a.5.5 0 0 1 1 0v4.272l.002.097.002.03-.002.016c-.095 1.35-.514 2.358-1.147 3.021-.619.648-1.536 1.064-2.847 1.064q-.258 0-.493-.012c-2-.097-3.577-1.723-4.963-3.836a6 6 0 0 1-.153-.242c-.217-.374-.345-.632-.388-.823l-.01-.07a.2.2 0 0 1 .08-.053.2.2 0 0 1 .094-.004c.106.014.28.085.469.262l.08.068.673.508A1 1 0 0 0 9 12V7.5a.5.5 0 0 1 1 0v3a.5.5 0 0 0 1 0v-4a.5.5 0 0 1 1 0m5 2v4.272l.002.072c.002.048.005.095-.002.141C16.786 16.01 15.087 18 12.008 18q-.282 0-.541-.013c-2.536-.123-4.36-2.164-5.752-4.287a7 7 0 0 1-.18-.286c-.423-.727-.831-1.533-.236-2.11.493-.478 1.147-.424 1.701-.068q.172.11.327.256L8 12V7.5a1.5 1.5 0 0 1 2.053-1.395 1.5 1.5 0 0 1 2.894 0q.26-.103.553-.105a1.5 1.5 0 0 1 1.447 1.105q.26-.103.553-.105A1.5 1.5 0 0 1 17 8.5" clipRule="evenodd"></path>
              </svg>
            </span>
            <div>
              <span style={{
                  "whiteSpace": "nowrap"
                }}>Hand tool</span>
              <div style={{
                  "color": "rgba(255, 255, 255, 0.698)"
                }}></div>
            </div>
            <span style={{
                "boxSizing": "content-box",
                "display": "block",
                "paddingLeft": "16px",
                "marginLeft": "auto"
              }}>
              <div style={{
                  "color": "rgba(255, 255, 255, 0.698)"
                }} aria-hidden="true">
                <span style={{
                    "whiteSpace": "nowrap"
                  }}>H</span>
              </div>
            </span>
          </span>
        </li>
        <li style={{
            "alignItems": "center",
            "boxSizing": "content-box",
            "color": "var(--ad-surface, rgb(255, 255, 255))",
            "display": "flex",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontSize": "11px",
            "fontWeight": "450",
            "letterSpacing": "0.05504px",
            "lineHeight": "16px",
            "listStyleImage": "none",
            "listStylePosition": "outside",
            "listStyleType": "none",
            "paddingLeft": "8px",
            "paddingRight": "8px"
          }} role="menuitemradio" aria-checked="false" aria-disabled="false">
          <span style={{
              "alignItems": "center",
              "boxSizing": "border-box",
              "display": "flex",
              "minHeight": "24px",
              "width": "135.297px",
              "whiteSpace": "nowrap",
              "borderRadius": "5px",
              "padding": "4px 8px 4px 4px"
            }}>
            <svg style={{
                "bottom": "0px",
                "display": "block",
                "height": "16px",
                "left": "0px",
                "marginBottom": "-4px",
                "marginRight": "4px",
                "marginTop": "-4px",
                "opacity": "0",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "relative",
                "right": "0px",
                "top": "0px",
                "width": "16px"
              }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
              <path style={{
                  "fill": "var(--ad-surface, rgb(255, 255, 255))"
                }} d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
            </svg>
            <span style={{
                "alignItems": "center",
                "display": "flex",
                "marginBottom": "-4px",
                "marginRight": "4px",
                "marginTop": "-4px",
                "position": "relative"
              }}>
              <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
                    "fill": "var(--ad-surface, rgb(255, 255, 255))"
                  }} d="M14.5 9a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-1.793l-2.148 2.147c.093.196.148.415.148.646v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 6 16.5v-3A1.5 1.5 0 0 1 7.5 12h3c.231 0 .449.054.645.148L13.293 10H11.5a.5.5 0 0 1 0-1zM16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2a.5.5 0 0 1 0-1h2a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a.5.5 0 0 1-1 0V8a2 2 0 0 1 2-2zm-8.5 7a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z"></path>
              </svg>
            </span>
            <div>
              <span style={{
                  "whiteSpace": "nowrap"
                }}>Scale</span>
              <div style={{
                  "color": "rgba(255, 255, 255, 0.698)"
                }}></div>
            </div>
            <span style={{
                "boxSizing": "content-box",
                "display": "block",
                "marginLeft": "auto",
                "paddingLeft": "16px"
              }}>
              <div style={{
                  "color": "rgba(255, 255, 255, 0.698)"
                }} aria-hidden="true">
                <span style={{
                    "whiteSpace": "nowrap"
                  }}>K</span>
              </div>
            </span>
          </span>
        </li>
      </ul>
    </ul>
  </div>
</div>;
}
