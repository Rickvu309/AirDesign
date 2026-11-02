import type { AirDesignComponentProps } from "../types.ts";

export function HomeFileToolbar({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "boxSizing": "border-box",
    "columnGap": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "justifyContent": "space-between",
    "minHeight": "64px",
    "paddingBottom": "16px",
    "paddingTop": "16px",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 1165,
    ...style
  }} className={className}>
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0"
    }}></div>
    <div style={{
      "alignItems": "center",
      "columnGap": "8px",
      "display": "flex",
      "flexShrink": "0",
      "rowGap": "8px"
    }}>
      <div style={{
        "backgroundColor": "rgb(229, 244, 255)",
        "boxShadow": "rgb(13, 153, 255) 0px 0px 0px 1px inset",
        "color": "rgb(0, 123, 229)",
        "display": "flex",
        "flexShrink": "0",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontWeight": "450",
        "height": "24px",
        "isolation": "isolate",
        "letterSpacing": "0.05504px",
        "maxWidth": "100%",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative",
        "width": "fit-content",
        "borderRadius": "5px"
      }}>
        <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "bottom": "0px",
          "color": "rgb(0, 0, 0)",
          "display": "flex",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "11px",
          "fontWeight": "450",
          "justifyItems": "center",
          "left": "0px",
          "lineHeight": "16px",
          "position": "absolute",
          "right": "0px",
          "textAlign": "start",
          "top": "0px",
          "zIndex": "-1",
          "minWidth": "0px",
          "minHeight": "0px",
          "padding": "0px"
        }} aria-haspopup="listbox" aria-expanded="false" role="combobox" type="button"></button>
        <div style={{
          "alignItems": "center",
          "display": "flex",
          "position": "relative",
          "width": "88px",
          "minWidth": "88px"
        }}>
          <span style={{
            "alignItems": "center",
            "display": "flex",
            "flexShrink": "0",
            "justifyContent": "center",
            "minWidth": "24px"
          }}>
            <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
              <svg style={{
                "display": "block",
                "height": "16px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "width": "16px"
              }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                <path style={{
                  "fill": "rgb(255, 92, 22)"
                }} fill="var(--color-bg-brand)" d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z"></path>
                <path style={{
                  "fill": "rgb(255, 255, 255)"
                }} fill="var(--color-icon-onbrand)" d="M12 3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 0 1-.957.292l-.5-1.646H5.479l-.5 1.646a.5.5 0 0 1-.958-.292L4.434 12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm1 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
              </svg>
            </div>
          </span>
          <span style={{
            "display": "block",
            "flexGrow": "1",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "minWidth": "0px",
            "whiteSpace": "nowrap"
          }}>
            <span aria-hidden="true">
              <span>
                <span style={{
                  "display": "contents"
                }}>
                  <span style={{
                    "whiteSpace": "nowrap"
                  }}>Slides</span>
                </span>
              </span>
            </span>
          </span>
          <span style={{
            "alignItems": "center",
            "display": "flex",
            "flexShrink": "0",
            "justifyContent": "center"
          }}>
            <svg style={{
              "display": "block",
              "height": "16px",
              "marginRight": "2px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "16px"
            }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
              <path style={{
                "fill": "rgb(0, 123, 229)"
              }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
            </svg>
          </span>
        </div>
      </div>
      <div style={{
        "display": "contents",
        "minWidth": "0px",
        "minHeight": "0px"
      }} role="presentation">
        <div style={{
          "backgroundColor": "rgb(255, 255, 255)",
          "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
          "display": "flex",
          "flexShrink": "0",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontWeight": "450",
          "height": "24px",
          "isolation": "isolate",
          "letterSpacing": "0.05504px",
          "maxWidth": "100%",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "width": "fit-content",
          "borderRadius": "5px"
        }}>
          <button style={{
            "alignItems": "center",
            "appearance": "auto",
            "backgroundColor": "rgba(0, 0, 0, 0)",
            "bottom": "0px",
            "color": "rgb(0, 0, 0)",
            "display": "flex",
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontSize": "11px",
            "fontWeight": "450",
            "justifyItems": "center",
            "left": "0px",
            "lineHeight": "16px",
            "position": "absolute",
            "right": "0px",
            "textAlign": "start",
            "top": "0px",
            "zIndex": "-1",
            "minWidth": "0px",
            "minHeight": "0px",
            "padding": "0px"
          }} aria-haspopup="menu" aria-expanded="false" type="button"></button>
          <div style={{
            "alignItems": "center",
            "display": "flex",
            "position": "relative",
            "width": "95.7578px"
          }}>
            <span style={{
              "boxSizing": "content-box",
              "display": "block",
              "flexGrow": "1",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "paddingLeft": "8px",
              "textOverflow": "ellipsis",
              "minWidth": "0px",
              "whiteSpace": "nowrap"
            }}>
              <span aria-hidden="true">
                <span>
                  <span style={{
                    "display": "contents"
                  }}>
                    <span style={{
                      "whiteSpace": "nowrap"
                    }}>Last modified</span>
                  </span>
                </span>
              </span>
            </span>
            <span style={{
              "alignItems": "center",
              "display": "flex",
              "flexShrink": "0",
              "justifyContent": "center"
            }}>
              <svg style={{
                "display": "block",
                "height": "16px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "width": "16px"
              }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                <path style={{
                  "fill": "rgba(0, 0, 0, 0.5)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
              </svg>
            </span>
          </div>
        </div>
      </div>
      <form>
        <fieldset style={{
          "display": "flex",
          "lineHeight": "0px",
          "marginLeft": "0px",
          "marginRight": "0px",
          "minWidth": "0px",
          "padding": "0px"
        }} role="radiogroup">
          <legend style={{
            "clipPath": "inset(50%)",
            "height": "1px",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "paddingLeft": "0px",
            "paddingRight": "0px",
            "position": "absolute",
            "width": "1px",
            "minWidth": "0px",
            "minHeight": "0px",
            "whiteSpace": "nowrap",
            "margin": "-1px -1px 4px -1px"
          }}>
            <span style={{
              "whiteSpace": "nowrap"
            }}>View mode</span>
          </legend>
          <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "display": "flex",
            "width": "48px",
            "borderRadius": "5px"
          }}>
            <div style={{
              "flexBasis": "0%",
              "flexGrow": "1",
              "position": "relative"
            }}>
              <input style={{
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "bottom": "0px",
                "color": "rgb(0, 0, 0)",
                "display": "block",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "height": "24px",
                "left": "0px",
                "lineHeight": "0px",
                "opacity": "0",
                "overflowX": "visible",
                "overflowY": "visible",
                "position": "absolute",
                "right": "0px",
                "top": "0px",
                "width": "24px",
                "borderRadius": "50%",
                "padding": "0px"
              }} type="radio" value="1" checked={true}></input>
              <span style={{
                "alignItems": "center",
                "backgroundColor": "rgb(255, 255, 255)",
                "boxShadow": "rgb(230, 230, 230) 0px 0px 0px 1px inset",
                "display": "flex",
                "height": "24px",
                "justifyContent": "center",
                "minWidth": "24px",
                "borderRadius": "5px"
              }} aria-hidden="true">
                <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.653 13.008A1.5 1.5 0 0 1 11 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L6 16.5v-2A1.5 1.5 0 0 1 7.5 13h2zm7 0A1.5 1.5 0 0 1 18 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L13 16.5v-2a1.5 1.5 0 0 1 1.5-1.5h2zM7.5 14a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM9.653 6.008A1.5 1.5 0 0 1 11 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L6 9.5v-2A1.5 1.5 0 0 1 7.5 6h2zm7 0A1.5 1.5 0 0 1 18 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L13 9.5v-2A1.5 1.5 0 0 1 14.5 6h2zM7.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z"></path>
                </svg>
              </span>
              <label style={{
                "clipPath": "inset(50%)",
                "color": "rgba(0, 0, 0, 0.898)",
                "display": "block",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "height": "1px",
                "lineHeight": "0px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "absolute",
                "width": "1px",
                "whiteSpace": "nowrap",
                "margin": "-1px"
              }}>
                <span style={{
                  "whiteSpace": "nowrap"
                }}>Show as grid</span>
              </label>
            </div>
            <div style={{
              "flexBasis": "0%",
              "flexGrow": "1",
              "position": "relative"
            }}>
              <input style={{
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "bottom": "0px",
                "color": "rgb(0, 0, 0)",
                "display": "block",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "height": "24px",
                "left": "0px",
                "lineHeight": "0px",
                "opacity": "0",
                "overflowX": "visible",
                "overflowY": "visible",
                "position": "absolute",
                "right": "0px",
                "top": "0px",
                "width": "24px",
                "borderRadius": "50%",
                "padding": "0px"
              }} type="radio" value="0"></input>
              <span style={{
                "alignItems": "center",
                "display": "flex",
                "height": "24px",
                "justifyContent": "center",
                "minWidth": "24px",
                "borderRadius": "5px"
              }} aria-hidden="true">
                <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
                    "fill": "rgba(0, 0, 0, 0.5)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M7 16a1 1 0 1 1 0 2 1 1 0 0 1 0-2m10.5.5a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1zM7 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2m10.5.5a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1zM7 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2m10.5.5a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1z"></path>
                </svg>
              </span>
              <label style={{
                "clipPath": "inset(50%)",
                "color": "rgba(0, 0, 0, 0.898)",
                "display": "block",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "height": "1px",
                "lineHeight": "0px",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "position": "absolute",
                "width": "1px",
                "whiteSpace": "nowrap",
                "margin": "-1px"
              }}>
                <span style={{
                  "whiteSpace": "nowrap"
                }}>Show as list</span>
              </label>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  </div>;
}
