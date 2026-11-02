import type { AirDesignProps } from "../types.js";

export function ShareMoreActions({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
    "display": "grid",
    "gridTemplateAreas": "\"header header\" \"sidebar body\" \"sidebar footer\"",
    "gridTemplateColumns": "0px 480px",
    "gridTemplateRows": "0px 160px 0px",
    "maxHeight": "738.4px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "borderRadius": "13px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 480,
    ...style
  }} className={className} {...rest}>
  <div style={{
      "gridColumnEnd": "body",
      "gridColumnStart": "body",
      "gridRowEnd": "body",
      "gridRowStart": "body",
      "height": "160px",
      "position": "relative",
      "width": "480px",
      "minWidth": "0px",
      "minHeight": "0px"
    }} role="none">
    <div style={{
        "height": "160px",
        "overflowX": "hidden",
        "overflowY": "auto",
        "position": "relative",
        "scrollbarWidth": "none",
        "width": "480px"
      }} role="none">
      <div style={{
          "boxSizing": "border-box",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontWeight": "450",
          "letterSpacing": "0.05504px",
          "paddingLeft": "16px",
          "paddingRight": "16px"
        }} role="none">
        <div style={{
            "boxSizing": "content-box",
            "display": "flex",
            "flexDirection": "column",
            "paddingBottom": "8px",
            "paddingTop": "8px",
            "borderRadius": "2px"
          }}>
          <div style={{
              "display": "flex"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "bottom": "0px",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "32px",
                  "justifyContent": "center",
                  "marginRight": "4px",
                  "width": "32px"
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
                    }} fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    Publish template
                  </div>
                </div>
              </div>
              <div style={{
                  "boxSizing": "content-box",
                  "display": "flex",
                  "justifyContent": "center",
                  "paddingBottom": "1px",
                  "width": "24px"
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
                    }} d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
                </svg>
              </div>
            </div>
          </div>
          <div style={{
              "display": "flex"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "bottom": "0px",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "32px",
                  "justifyContent": "center",
                  "marginRight": "4px",
                  "width": "32px"
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
                    }} fillRule="evenodd" d="M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    Copy presentation link
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{
              "display": "flex"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "bottom": "0px",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "32px",
                  "justifyContent": "center",
                  "marginRight": "4px",
                  "width": "32px"
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
                    }} fillRule="evenodd" d="M16.5 7h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5m-9-1A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 16.5 6zm3.354 4.146a.5.5 0 0 1 0 .708L9.707 12l1.147 1.146a.5.5 0 0 1-.708.708l-1.5-1.5a.5.5 0 0 1 0-.708l1.5-1.5a.5.5 0 0 1 .708 0m2.292.708a.5.5 0 0 1 .708-.708l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708-.708L14.293 12z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    Get embed code
                  </div>
                </div>
              </div>
              <div style={{
                  "boxSizing": "content-box",
                  "display": "flex",
                  "justifyContent": "center",
                  "paddingBottom": "1px",
                  "width": "24px"
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
                    }} d="M10.647 9.147a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .707l-2.5 2.5a.5.5 0 0 1-.707-.707L12.793 12l-2.146-2.146a.5.5 0 0 1 0-.707"></path>
                </svg>
              </div>
            </div>
          </div>
          <div style={{
              "display": "flex",
              "whiteSpace": "nowrap"
            }}>
            <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "display": "flex",
                "isolation": "isolate",
                "marginLeft": "-8px",
                "marginRight": "-8px",
                "minHeight": "36px",
                "position": "relative",
                "width": "464px",
                "border": "1px solid rgba(0, 0, 0, 0)",
                "borderRadius": "5px"
              }}>
              <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
                  "bottom": "0px",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                  "borderRadius": "5px",
                  "padding": "0px"
                }} type="button"></button>
              <div style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "32px",
                  "justifyContent": "center",
                  "marginRight": "4px",
                  "width": "32px"
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
                    }} d="M11.725 11.082a.5.5 0 0 1 .629.064l2.5 2.5a.5.5 0 0 1-.707.707L12.5 12.708V18.5a.5.5 0 0 1-1 0v-5.793l-1.646 1.646a.5.5 0 1 1-.707-.707l2.5-2.5zM10.379 6a2 2 0 0 1 1.414.586l1.411 1.411.007.003h3.29a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-2a.5.5 0 1 1 0-1h2a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-3.704l-.007-.003-1.704-1.704A1 1 0 0 0 10.379 7H7.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h2a.5.5 0 0 1 0 1h-2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
                </svg>
              </div>
              <div style={{
                  "columnGap": "10px",
                  "display": "flex",
                  "flexGrow": "1",
                  "rowGap": "10px",
                  "textAlign": "left"
                }} aria-hidden="true">
                <div style={{
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexDirection": "column",
                    "flexGrow": "1"
                  }}>
                  <div style={{
                      "alignItems": "center",
                      "columnGap": "10px",
                      "display": "flex",
                      "rowGap": "10px"
                    }}>
                    <span style={{
                        "whiteSpace": "nowrap"
                      }}>Ready to share with your team?</span>
                    <span style={{
                        "clipPath": "inset(50%)",
                        "display": "block",
                        "height": "1px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "position": "absolute",
                        "width": "1px",
                        "minWidth": "0px",
                        "minHeight": "0px",
                        "margin": "-1px"
                      }}>
                      <span style={{
                          "whiteSpace": "nowrap"
                        }}>Move to folder</span>
                    </span>
                  </div>
                </div>
              </div>
              <div style={{
                  "position": "relative"
                }}>
                <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
                    "color": "var(--ad-brand-strong, rgb(226, 76, 12))",
                    "display": "inline-flex",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontSize": "11px",
                    "fontWeight": "450",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "marginRight": "8px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "0px"
                  }} type="button">
                  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Move to folder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>;
}
