import type { AirDesignProps } from "../types.js";

export function AgentsSidebar({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return (<div style={{
  position: "relative",
  fontFamily: "Inter, sans-serif",
  fontSize: 11,
  lineHeight: "16px",
  boxSizing: "border-box",
  flexShrink: 0,
  display: "block",
  height: 923,
  width: 365,
  ...style
}} role="region" aria-label="Left sidebar" className={className} {...rest}>
  <div style={{
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "borderRightColor": "var(--ad-divider, rgb(230, 230, 230))",
    "borderRightStyle": "solid",
    "borderRightWidth": "1px",
    "boxSizing": "border-box",
    "display": "flex",
    "flexDirection": "column",
    "height": "923px",
    "justifyContent": "space-between",
    "paddingBottom": "16px",
    "paddingTop": "8px",
    "position": "relative",
    "top": "0px",
    "width": "57px",
    "zIndex": "6"
  }} aria-label="Navigation Bar" role="toolbar" aria-orientation="vertical">
    <div style={{
      "alignItems": "center",
      "display": "flex",
      "flexDirection": "column"
    }}>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "4px",
        "flexShrink": 0
      }} aria-label="Main menu" aria-haspopup="menu" aria-expanded="false" type="button">
        <svg style={{
          "display": "block",
          "width": 24,
          "height": 24,
          "flexShrink": 0
        }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true" width={24} height={24}>
          <path d="M13 57l19-50 19 50" fill="none" stroke="var(--ad-ink, #1A1A1A)" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
          <path d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        </svg>
      </button>
      <div style={{
        "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
        "borderBottomStyle": "solid",
        "borderBottomWidth": "1px",
        "boxSizing": "content-box",
        "marginBottom": "7px",
        "marginTop": "8px",
        "width": "16px"
      }} role="separator"></div>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "columnGap": "2px",
        "display": "flex",
        "flexDirection": "column",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyContent": "center",
        "justifyItems": "center",
        "lineHeight": "16px",
        "rowGap": "2px",
        "textAlign": "start",
        "width": "56px",
        "padding": "4px 0px"
      }} aria-expanded="false" aria-label="File" type="button">
        <div style={{
          "alignItems": "center",
          "display": "flex",
          "height": "32px",
          "justifyContent": "center",
          "width": "32px",
          "borderRadius": "5px"
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
            }} d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "block",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "9px",
          "fontWeight": "450",
          "height": "14px",
          "letterSpacing": "0.04496px",
          "lineHeight": "14px",
          "marginLeft": "8px",
          "marginRight": "8px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "textAlign": "center",
          "width": "40px",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>File</span>
        </span>
      </button>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "columnGap": "2px",
        "display": "flex",
        "flexDirection": "column",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyContent": "center",
        "justifyItems": "center",
        "lineHeight": "16px",
        "rowGap": "2px",
        "textAlign": "start",
        "width": "56px",
        "padding": "4px 0px"
      }} aria-expanded="true" aria-label="Agents" type="button">
        <div style={{
          "alignItems": "center",
          "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
          "display": "flex",
          "height": "32px",
          "justifyContent": "center",
          "width": "32px",
          "borderRadius": "5px"
        }}>
          <span style={{
            "display": "flex"
          }}>
            <div style={{
              "height": "fit-content",
              "position": "relative",
              "width": "fit-content"
            }}>
              <svg style={{
                "display": "block",
                "height": "24px",
                "maskComposite": "exclude",
                "overflowX": "hidden",
                "overflowY": "hidden",
                "width": "24px"
              }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path style={{
                  "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
                }} fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "block",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "9px",
          "fontWeight": "450",
          "height": "14px",
          "letterSpacing": "0.04496px",
          "lineHeight": "14px",
          "marginLeft": "8px",
          "marginRight": "8px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "textAlign": "center",
          "width": "40px",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>Agents</span>
        </span>
      </button>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "boxSizing": "border-box",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "columnGap": "2px",
        "display": "flex",
        "flexDirection": "column",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyContent": "center",
        "justifyItems": "center",
        "lineHeight": "16px",
        "rowGap": "2px",
        "textAlign": "start",
        "width": "56px",
        "padding": "4px 0px"
      }} aria-expanded="false" aria-label="Inserts" type="button">
        <div style={{
          "alignItems": "center",
          "display": "flex",
          "height": "32px",
          "justifyContent": "center",
          "width": "32px",
          "borderRadius": "5px"
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
            }} fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "block",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "9px",
          "fontWeight": "450",
          "height": "14px",
          "letterSpacing": "0.04496px",
          "lineHeight": "14px",
          "marginLeft": "8px",
          "marginRight": "8px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "textAlign": "center",
          "width": "40px",
          "whiteSpace": "nowrap"
        }}>
          <span style={{
            "whiteSpace": "nowrap"
          }}>Inserts</span>
        </span>
      </button>
    </div>
    <div style={{
      "alignItems": "center",
      "columnGap": "8px",
      "display": "flex",
      "flexDirection": "column",
      "rowGap": "8px"
    }}>
      <div></div>
    </div>
  </div>
  <div style={{
    "bottom": "0px",
    "left": "57px",
    "position": "absolute",
    "top": "0px",
    "zIndex": "6"
  }}>
    <div>
      <div style={{
        "bottom": "0px",
        "left": "0px",
        "position": "absolute",
        "top": "0px"
      }}>
        <div style={{
          "display": "flex",
          "flexDirection": "column",
          "height": "923px",
          "maxHeight": "923px",
          "maxWidth": "306px",
          "width": "306px"
        }}>
          <div style={{
            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
            "borderRightColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
            "borderRightStyle": "solid",
            "borderRightWidth": "1px",
            "boxSizing": "content-box",
            "display": "flex",
            "flexDirection": "column",
            "flexGrow": "1",
            "overflowX": "hidden",
            "overflowY": "auto",
            "position": "relative",
            "scrollbarWidth": "none",
            "width": "306px"
          }}>
            <div style={{
              "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
              "borderBottomStyle": "solid",
              "borderBottomWidth": "1px",
              "boxSizing": "content-box",
              "paddingBottom": "8px",
              "paddingLeft": "16px",
              "paddingRight": "16px"
            }}>
              <div style={{
                "alignItems": "center",
                "boxSizing": "content-box",
                "columnGap": "8px",
                "display": "flex",
                "justifyContent": "space-between",
                "marginTop": "8px",
                "paddingBottom": "4px",
                "paddingTop": "4px",
                "rowGap": "8px"
              }}>
                <div style={{
                  "display": "contents",
                  "minWidth": "0px",
                  "minHeight": "0px"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "columnGap": "4px",
                    "display": "flex",
                    "flexBasis": "0%",
                    "flexGrow": "1",
                    "marginLeft": "-4px",
                    "marginRight": "-4px",
                    "rowGap": "4px"
                  }}>
  <div style={{
                      "alignItems": "center",
                      "display": "flex",
                      "minWidth": "0px"
                    }}>
    <span style={{
                        "boxSizing": "content-box",
                        "display": "flex",
                        "paddingLeft": "4px",
                        "paddingRight": "4px",
                        "position": "relative",
                        "minWidth": "0px",
                        "border": "1px solid rgba(0, 0, 0, 0)"
                      }}>
      <button style={{
                          "alignItems": "center",
                          "appearance": "auto",
                          "backgroundColor": "rgba(0, 0, 0, 0)",
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                          "display": "block",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "13px",
                          "fontWeight": "550",
                          "justifyItems": "center",
                          "letterSpacing": "-0.032px",
                          "lineHeight": "22px",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "textAlign": "start",
                          "textOverflow": "ellipsis",
                          "verticalAlign": "top",
                          "whiteSpace": "nowrap",
                          "padding": "0px"
                        }} aria-label="Untitled, file name" type="button">
        <span style={{
                            "whiteSpace": "nowrap"
                          }}>Untitled</span>
      </button>
      <label style={{
                          "clip": "rect(0px, 0px, 0px, 0px)",
                          "clipPath": "inset(50%)",
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                          "display": "block",
                          "fontFamily": "Inter, sans-serif",
                          "fontSize": "11px",
                          "fontWeight": "400",
                          "height": "1px",
                          "lineHeight": "16px",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "position": "absolute",
                          "width": "1px",
                          "minWidth": "0px",
                          "minHeight": "0px",
                          "whiteSpace": "nowrap"
                        }}>
        <span style={{
                            "whiteSpace": "nowrap"
                          }}>File name</span>
      </label>
    </span>
  </div>
  <div>
    <div style={{
                        "borderBottomRightRadius": "5px",
                        "borderLeftColor": "rgba(0, 0, 0, 0)",
                        "borderLeftStyle": "solid",
                        "borderLeftWidth": "1px",
                        "borderTopRightRadius": "5px",
                        "boxSizing": "content-box",
                        "marginLeft": "-4px"
                      }}>
      <div style={{
                          "display": "contents"
                        }} role="presentation">
        <span>
          <button style={{
                              "alignItems": "center",
                              "appearance": "auto",
                              "backgroundColor": "rgba(0, 0, 0, 0)",
                              "borderBottomRightRadius": "5px",
                              "borderTopRightRadius": "5px",
                              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                              "display": "grid",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "gridTemplateColumns": "24px",
                              "gridTemplateRows": "24px",
                              "height": "24px",
                              "justifyItems": "center",
                              "lineHeight": "16px",
                              "minWidth": "24px",
                              "outlineColor": "rgba(0, 0, 0, 0)",
                              "outlineOffset": "-1px",
                              "outlineStyle": "solid",
                              "outlineWidth": "1px",
                              "textAlign": "start",
                              "width": "24px",
                              "padding": "0px"
                            }} aria-haspopup="menu" aria-expanded="false" aria-label="Edit file menu" type="button">
            <span style={{
                                "alignItems": "center",
                                "borderBottomRightRadius": "5px",
                                "borderTopRightRadius": "5px",
                                "display": "flex",
                                "height": "24px",
                                "justifyContent": "center",
                                "minWidth": "24px",
                                "width": "24px"
                              }} aria-hidden="true">
              <svg style={{
                                  "display": "block",
                                  "height": "16px",
                                  "overflowX": "hidden",
                                  "overflowY": "hidden",
                                  "width": "16px"
                                }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                <path style={{
                                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                                  }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
              </svg>
            </span>
          </button>
        </span>
      </div>
    </div>
  </div>
</div>
                </div>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                  "display": "grid",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "gridTemplateColumns": "24px",
                  "gridTemplateRows": "24px",
                  "height": "24px",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "minWidth": "24px",
                  "outlineColor": "rgba(0, 0, 0, 0)",
                  "outlineOffset": "-1px",
                  "outlineStyle": "solid",
                  "outlineWidth": "1px",
                  "textAlign": "start",
                  "width": "24px",
                  "borderRadius": "5px",
                  "padding": "0px"
                }} aria-label="Grid view" type="button">
                  <span style={{
                    "alignItems": "center",
                    "display": "flex",
                    "height": "24px",
                    "justifyContent": "center",
                    "minWidth": "24px",
                    "width": "24px",
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
                        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                      }} fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</span>
                </button>
              </div>
              <div style={{
                "alignItems": "center",
                "columnGap": "4px",
                "display": "flex",
                "flexBasis": "0%",
                "flexGrow": "1",
                "marginLeft": "-4px",
                "marginRight": "-4px",
                "rowGap": "4px"
              }}>
                <span style={{
                  "alignItems": "center",
                  "display": "flex",
                  "overflowX": "hidden",
                  "overflowY": "hidden"
                }}>
                  <a style={{
                    "boxSizing": "content-box",
                    "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                    "display": "block",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontSize": "11px",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px",
                    "lineHeight": "16px",
                    "outlineColor": "rgba(0, 0, 0, 0)",
                    "outlineStyle": "solid",
                    "outlineWidth": "2px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "paddingLeft": "4px",
                    "paddingRight": "4px",
                    "textOverflow": "ellipsis",
                    "whiteSpace": "nowrap",
                    "borderRadius": "5px"
                  }} aria-label="Drafts" href="#" rel="noopener" target="_blank">
  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Drafts</span>
</a>
                </span>
              </div>
            </div>
            <div style={{
              "alignItems": "flex-start",
              "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
              "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
              "borderBottomStyle": "solid",
              "borderBottomWidth": "1px",
              "boxSizing": "content-box",
              "display": "flex",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontSize": "13px",
              "fontWeight": "550",
              "justifyContent": "space-between",
              "letterSpacing": "-0.032px",
              "lineHeight": "22px",
              "position": "relative",
              "zIndex": "100",
              "padding": "12px 12px 12px 16px"
            }}>
              <div style={{
                "alignItems": "flex-start",
                "columnGap": "4px",
                "display": "flex",
                "minHeight": "24px",
                "rowGap": "4px",
                "minWidth": "0px"
              }}>
                <div style={{
                  "display": "flex",
                  "flexDirection": "column",
                  "minWidth": "0px"
                }}>
                  <h2 style={{
                    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontSize": "13px",
                    "fontWeight": "550",
                    "lineHeight": "22px",
                    "marginBottom": "0px",
                    "marginTop": "0px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "textOverflow": "ellipsis",
                    "minWidth": "0px",
                    "whiteSpace": "nowrap"
                  }}>
  <span style={{
                      "whiteSpace": "nowrap"
                    }}>New chat</span>
</h2>
                  <div style={{
                    "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                    "fontSize": "11px",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px",
                    "lineHeight": "16px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "textOverflow": "ellipsis",
                    "whiteSpace": "nowrap"
                  }}>
  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Shared</span>
</div>
                </div>
              </div>
              <div style={{
                "alignItems": "center",
                "columnGap": "4px",
                "display": "flex",
                "flexShrink": "0",
                "marginLeft": "8px",
                "rowGap": "4px",
                "minWidth": "0px"
              }}>
                <div style={{
                  "display": "flex",
                  "justifyContent": "space-between",
                  "marginLeft": "8px"
                }}>
                  <a style={{
                    "alignItems": "center",
                    "color": "rgb(0, 0, 238)",
                    "display": "flex",
                    "flexShrink": "0",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontSize": "13px",
                    "fontWeight": "550",
                    "lineHeight": "22px",
                    "borderRadius": "5px"
                  }} aria-label="Beta, Learn more" href="#" rel="noopener" target="_blank">
  <div style={{
                      "alignItems": "center",
                      "boxSizing": "content-box",
                      "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                      "columnGap": "4px",
                      "display": "flex",
                      "fontSize": "11px",
                      "height": "16px",
                      "justifyContent": "center",
                      "paddingLeft": "4px",
                      "paddingRight": "4px",
                      "rowGap": "4px",
                      "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
                      "borderRadius": "5px"
                    }}>
    Beta
  </div>
</a>
                  <div style={{
                    "alignItems": "center",
                    "columnGap": "4px",
                    "display": "flex",
                    "marginLeft": "8px",
                    "rowGap": "4px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                      "display": "grid",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "13px",
                      "fontWeight": "550",
                      "gridTemplateColumns": "24px",
                      "gridTemplateRows": "24px",
                      "height": "24px",
                      "justifyItems": "center",
                      "lineHeight": "22px",
                      "minWidth": "24px",
                      "outlineColor": "rgba(0, 0, 0, 0)",
                      "outlineOffset": "-1px",
                      "outlineStyle": "solid",
                      "outlineWidth": "1px",
                      "textAlign": "start",
                      "width": "24px",
                      "borderRadius": "5px",
                      "padding": "0px"
                    }} aria-haspopup="menu" aria-expanded="false" aria-label="More options" type="button">
    <span style={{
                        "alignItems": "center",
                        "display": "flex",
                        "height": "24px",
                        "justifyContent": "center",
                        "minWidth": "24px",
                        "width": "24px",
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
                            "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                          }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
                </div>
              </div>
            </div>
            <div style={{
              "display": "flex",
              "flexDirection": "column",
              "flexGrow": "1",
              "height": "795px",
              "overflowX": "hidden",
              "overflowY": "hidden"
            }}>
              <div style={{
                "display": "flex",
                "flexBasis": "0px",
                "flexDirection": "row-reverse",
                "flexGrow": "1",
                "height": "795px",
                "transform": "matrix(1, 0, 0, 1, 0, 0)",
                "transformOrigin": "153px 397.5px",
                "minHeight": "0px"
              }}>
                <div style={{
                  "display": "flex",
                  "flexDirection": "column",
                  "flexShrink": "0",
                  "height": "795px",
                  "overflowX": "auto",
                  "overflowY": "auto",
                  "width": "306px",
                  "minHeight": "0px"
                }} aria-hidden="false">
                  <div style={{
                    "display": "flex",
                    "flexDirection": "column",
                    "height": "795px",
                    "minHeight": "0px"
                  }}>
  <div style={{
                      "display": "flex",
                      "flexDirection": "column",
                      "flexGrow": "1",
                      "minHeight": "0px"
                    }}>
    <div style={{
                        "display": "flex",
                        "flexDirection": "column",
                        "flexGrow": "1",
                        "height": "795px",
                        "position": "relative",
                        "width": "306px",
                        "minHeight": "0px"
                      }}>
      <div style={{
                          "display": "contents",
                          "minWidth": "0px",
                          "minHeight": "0px"
                        }} aria-hidden="false">
        <div style={{
                            "display": "flex",
                            "flexDirection": "column",
                            "flexGrow": "1",
                            "height": "795px",
                            "width": "306px"
                          }}>
          <div style={{
                              "display": "flex",
                              "flexDirection": "column",
                              "flexGrow": "1",
                              "height": "795px",
                              "width": "306px",
                              "minHeight": "0px"
                            }}>
            <div style={{
                                "display": "flex",
                                "flexDirection": "column",
                                "height": "795px",
                                "position": "relative",
                                "width": "306px"
                              }}>
              <div style={{
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "height": "639px",
                                  "position": "relative",
                                  "width": "306px"
                                }}>
                <div style={{
                                    "display": "flex",
                                    "flexDirection": "column",
                                    "height": "639px",
                                    "position": "relative",
                                    "width": "306px"
                                  }}>
                  <div style={{
                                      "display": "flex",
                                      "flexBasis": "0%",
                                      "flexDirection": "column",
                                      "flexGrow": "1",
                                      "justifyContent": "safe center",
                                      "overflowX": "auto",
                                      "overflowY": "auto"
                                    }}>
                    <div style={{
                                        "alignItems": "stretch",
                                        "boxSizing": "border-box",
                                        "display": "flex",
                                        "flexDirection": "column",
                                        "flexGrow": "1",
                                        "flexShrink": "0",
                                        "justifyContent": "flex-start",
                                        "width": "306px",
                                        "padding": "16px"
                                      }}>
                      <div style={{
                                          "alignItems": "center",
                                          "boxSizing": "content-box",
                                          "columnGap": "12px",
                                          "display": "flex",
                                          "flexDirection": "column",
                                          "flexShrink": "0",
                                          "justifyContent": "center",
                                          "paddingBottom": "16px",
                                          "paddingTop": "16px",
                                          "rowGap": "12px"
                                        }}>
                        <div style={{
                                            "alignItems": "center",
                                            "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
                                            "boxSizing": "content-box",
                                            "display": "flex",
                                            "justifyContent": "center",
                                            "borderRadius": "9999px",
                                            "padding": "8px"
                                          }}>
                          <svg style={{
                                              "display": "block",
                                              "height": "24px",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "width": "24px"
                                            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path style={{
                                                "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
                                              }} d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
                          </svg>
                        </div>
                        <h2 style={{
                                            "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                            "fontSize": "15px",
                                            "fontWeight": "550",
                                            "letterSpacing": "-0.07504px",
                                            "lineHeight": "25px",
                                            "marginBottom": "0px",
                                            "marginTop": "0px",
                                            "textAlign": "center"
                                          }}>
                          What do you want to do?
                        </h2>
                      </div>
                      <div style={{
                                          "columnGap": "8px",
                                          "display": "flex",
                                          "flexDirection": "column",
                                          "flexShrink": "0",
                                          "rowGap": "8px",
                                          "width": "274px"
                                        }}>
                        <div style={{
                                            "boxSizing": "border-box",
                                            "display": "flex",
                                            "flexDirection": "column",
                                            "overflowX": "hidden",
                                            "overflowY": "hidden",
                                            "width": "274px",
                                            "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                              "display": "flex",
                                              "fontFamily": "Inter, sans-serif",
                                              "fontSize": "11px",
                                              "fontWeight": "400",
                                              "lineHeight": "16px",
                                              "textAlign": "left",
                                              "width": "272px",
                                              "borderRadius": "13px",
                                              "padding": "8px"
                                            }} type="button" aria-expanded="false">
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "width": "24px"
                                              }} aria-hidden="true">
                              <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                                                    "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                                                  }} d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
</svg>
                            </span>
                            <span style={{
                                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                                "display": "block",
                                                "flexGrow": "1",
                                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                                "fontSize": "13px",
                                                "fontWeight": "450",
                                                "letterSpacing": "-0.032px",
                                                "lineHeight": "22px",
                                                "marginLeft": "8px"
                                              }}>
                              Improve the deck
                            </span>
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "marginLeft": "4px",
                                                "width": "24px"
                                              }} aria-hidden="true">
                              <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                                                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                                                  }} d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
</svg>
                            </span>
                          </button>
                        </div>
                        <div style={{
                                            "boxSizing": "border-box",
                                            "display": "flex",
                                            "flexDirection": "column",
                                            "overflowX": "hidden",
                                            "overflowY": "hidden",
                                            "width": "274px",
                                            "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                              "display": "flex",
                                              "fontFamily": "Inter, sans-serif",
                                              "fontSize": "11px",
                                              "fontWeight": "400",
                                              "lineHeight": "16px",
                                              "textAlign": "left",
                                              "width": "272px",
                                              "borderRadius": "13px",
                                              "padding": "8px"
                                            }} type="button" aria-expanded="false">
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "width": "24px"
                                              }} aria-hidden="true">
                              <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                                                    "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                                                  }} fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
</svg>
                            </span>
                            <span style={{
                                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                                "display": "block",
                                                "flexGrow": "1",
                                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                                "fontSize": "13px",
                                                "fontWeight": "450",
                                                "letterSpacing": "-0.032px",
                                                "lineHeight": "22px",
                                                "marginLeft": "8px"
                                              }}>
  Add to the deck
</span>
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "marginLeft": "4px",
                                                "width": "24px"
                                              }} aria-hidden="true">
  <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                                                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                                                  }} d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>
                        </div>
                        <div style={{
                                            "boxSizing": "border-box",
                                            "display": "flex",
                                            "flexDirection": "column",
                                            "overflowX": "hidden",
                                            "overflowY": "hidden",
                                            "width": "274px",
                                            "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                              "display": "flex",
                                              "fontFamily": "Inter, sans-serif",
                                              "fontSize": "11px",
                                              "fontWeight": "400",
                                              "lineHeight": "16px",
                                              "textAlign": "left",
                                              "width": "272px",
                                              "borderRadius": "13px",
                                              "padding": "8px"
                                            }} type="button" aria-expanded="false">
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "width": "24px"
                                              }} aria-hidden="true">
  <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                                                    "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                                                  }} d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
  </svg>
</span>
                            <span style={{
                                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                                "display": "block",
                                                "flexGrow": "1",
                                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                                "fontSize": "13px",
                                                "fontWeight": "450",
                                                "letterSpacing": "-0.032px",
                                                "lineHeight": "22px",
                                                "marginLeft": "8px"
                                              }}>
  Prepare to present
</span>
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "marginLeft": "4px",
                                                "width": "24px"
                                              }} aria-hidden="true">
  <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                                                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                                                  }} d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>
                        </div>
                        <div style={{
                                            "boxSizing": "border-box",
                                            "display": "flex",
                                            "flexDirection": "column",
                                            "overflowX": "hidden",
                                            "overflowY": "hidden",
                                            "width": "274px",
                                            "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                              "display": "flex",
                                              "fontFamily": "Inter, sans-serif",
                                              "fontSize": "11px",
                                              "fontWeight": "400",
                                              "lineHeight": "16px",
                                              "textAlign": "left",
                                              "width": "272px",
                                              "borderRadius": "13px",
                                              "padding": "8px"
                                            }} type="button" aria-expanded="false">
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "width": "24px"
                                              }} aria-hidden="true">
  <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                                                    "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                                                  }} fillRule="evenodd" d="M6.057 14.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.458.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 16a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.057 9.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.457.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 11a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.058 4.763c.185-.35.7-.35.884 0l.034.08.295.886.886.294c.457.153.457.8 0 .953l-.886.295-.295.885a.502.502 0 0 1-.952 0l-.295-.885-.886-.295a.502.502 0 0 1 0-.953l.885-.295.296-.885zM18.5 6a.5.5 0 0 1 0 1h-8a.5.5 0 0 1 0-1z" clipRule="evenodd"></path>
  </svg>
</span>
                            <span style={{
                                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                                "display": "block",
                                                "flexGrow": "1",
                                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                                "fontSize": "13px",
                                                "fontWeight": "450",
                                                "letterSpacing": "-0.032px",
                                                "lineHeight": "22px",
                                                "marginLeft": "8px"
                                              }}>
  Understand the deck
</span>
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "marginLeft": "4px",
                                                "width": "24px"
                                              }} aria-hidden="true">
  <svg style={{
                                                  "display": "block",
                                                  "height": "24px",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "width": "24px"
                                                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                                                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                                                  }} d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
  </svg>
</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{
                                    "width": "306px",
                                    "marginRight": "auto",
                                    "marginLeft": "auto"
                                  }}>
                  <div style={{
                                      "height": "0px",
                                      "position": "relative",
                                      "zIndex": "1"
                                    }}>
                    <div style={{
                                        "display": "flex",
                                        "justifyContent": "flex-end",
                                        "position": "absolute",
                                        "right": "10px",
                                        "top": "-30px",
                                        "width": "306px"
                                      }}></div>
                  </div>
                </div>
                <div style={{
                                    "backgroundImage": "linear-gradient(to top, var(--ad-surface, rgb(255, 255, 255)) 0%, rgba(0, 0, 0, 0) 100%)",
                                    "bottom": "0px",
                                    "height": "20px",
                                    "left": "0px",
                                    "position": "absolute",
                                    "right": "0px",
                                    "minWidth": "0px",
                                    "minHeight": "0px"
                                  }}></div>
              </div>
              <div style={{
                                  "width": "306px",
                                  "marginRight": "auto",
                                  "marginLeft": "auto"
                                }}>
                <div></div>
              </div>
              <form style={{
                                  "width": "306px",
                                  "marginRight": "auto",
                                  "marginLeft": "auto"
                                }}>
                <div style={{
                                    "display": "flex",
                                    "flexDirection": "column",
                                    "flexShrink": "0",
                                    "position": "relative",
                                    "margin": "2px 16px 16px 16px"
                                  }}>
                  <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "display": "flex",
                                      "justifyContent": "space-between",
                                      "paddingBottom": "8px",
                                      "position": "relative"
                                    }}></div>
                  <div style={{
                                      "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                                      "bottom": "0px",
                                      "boxSizing": "content-box",
                                      "columnGap": "12px",
                                      "display": "flex",
                                      "flexDirection": "column",
                                      "flexShrink": "0",
                                      "outlineColor": "rgba(0, 0, 0, 0)",
                                      "outlineStyle": "solid",
                                      "outlineWidth": "1px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingBottom": "12px",
                                      "paddingTop": "4px",
                                      "position": "relative",
                                      "rowGap": "12px",
                                      "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
                                      "borderRadius": "13px"
                                    }}>
                    <div style={{
                                        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                                        "display": "flex",
                                        "flexBasis": "0px",
                                        "flexDirection": "column",
                                        "flexGrow": "1"
                                      }}>
                      <div style={{
                                          "display": "flex",
                                          "flexGrow": "1",
                                          "position": "relative"
                                        }}>
                        <div style={{
                                            "clipPath": "inset(50%)",
                                            "height": "1px",
                                            "overflowX": "hidden",
                                            "overflowY": "hidden",
                                            "position": "absolute",
                                            "width": "1px",
                                            "minWidth": "0px",
                                            "minHeight": "0px",
                                            "whiteSpace": "nowrap",
                                            "margin": "-1px"
                                          }}>
                          <span style={{
                                              "whiteSpace": "nowrap"
                                            }}>The button action for this text area changes between Send and Stop as the agent works.</span>
                        </div>
                        <div style={{
                                            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                                            "display": "flex",
                                            "flexGrow": "1",
                                            "position": "relative"
                                          }}>
                          <div style={{
                                              "boxSizing": "border-box",
                                              "flexGrow": "1",
                                              "fontFamily": "Inter",
                                              "fontSize": "13px",
                                              "lineHeight": "20px",
                                              "maxHeight": "198.75px",
                                              "minHeight": "68px",
                                              "overflowWrap": "break-word",
                                              "overflowX": "auto",
                                              "overflowY": "auto",
                                              "position": "relative",
                                              "width": "272px",
                                              "wordBreak": "break-word",
                                              "whiteSpace": "pre-wrap",
                                              "padding": "12px 16px"
                                            }} aria-label="Prompt for AI agent" role="textbox" aria-disabled="false" aria-placeholder="">
                            <p style={{
                                                "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                                "fontFamily": "Inter",
                                                "fontSize": "13px",
                                                "fontWeight": "450",
                                                "lineHeight": "20px",
                                                "marginBottom": "0px",
                                                "marginTop": "0px"
                                              }}>
  

</p>
                          </div>
                          <div aria-hidden="true"></div>
                          <div style={{
                                              "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                                              "display": "-webkit-box",
                                              "fontFamily": "Inter",
                                              "fontSize": "13px",
                                              "left": "16px",
                                              "lineHeight": "20px",
                                              "overflowWrap": "break-word",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "position": "absolute",
                                              "right": "16px",
                                              "top": "12px",
                                              "WebkitBoxOrient": "vertical",
                                              "WebkitLineClamp": "2",
                                              "minWidth": "0px",
                                              "minHeight": "0px"
                                            }} aria-hidden="true">
                            Ask for changes
                          </div>
                        </div>
                        <div style={{
                                            "clipPath": "inset(50%)",
                                            "height": "1px",
                                            "overflowX": "hidden",
                                            "overflowY": "hidden",
                                            "position": "absolute",
                                            "width": "1px",
                                            "minWidth": "0px",
                                            "minHeight": "0px",
                                            "whiteSpace": "nowrap",
                                            "margin": "-1px"
                                          }}>
                          <div aria-relevant="all" role="status"></div>
                        </div>
                      </div>
                    </div>
                    <div style={{
                                        "alignItems": "center",
                                        "boxSizing": "content-box",
                                        "display": "flex",
                                        "justifyContent": "space-between",
                                        "minHeight": "32px",
                                        "paddingLeft": "12px",
                                        "paddingRight": "12px"
                                      }}>
                      <div style={{
                                          "alignItems": "center",
                                          "columnGap": "8px",
                                          "display": "flex",
                                          "flexGrow": "1",
                                          "justifyContent": "space-between",
                                          "rowGap": "8px",
                                          "minWidth": "0px"
                                        }}>
                        <div style={{
                                            "alignItems": "center",
                                            "display": "flex",
                                            "flexShrink": "0"
                                          }}>
                          <div style={{
                                              "alignItems": "center",
                                              "columnGap": "8px",
                                              "display": "flex",
                                              "rowGap": "8px"
                                            }}>
                            <span style={{
                                                "display": "flex",
                                                "position": "relative"
                                              }}>
  <button style={{
                                                  "alignItems": "center",
                                                  "appearance": "auto",
                                                  "backgroundColor": "rgba(0, 0, 0, 0)",
                                                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                                  "display": "grid",
                                                  "fontFamily": "Inter, sans-serif",
                                                  "fontSize": "11px",
                                                  "fontWeight": "400",
                                                  "gridTemplateColumns": "24px",
                                                  "gridTemplateRows": "24px",
                                                  "height": "24px",
                                                  "justifyItems": "center",
                                                  "lineHeight": "16px",
                                                  "minWidth": "24px",
                                                  "outlineColor": "rgba(0, 0, 0, 0)",
                                                  "outlineOffset": "-1px",
                                                  "outlineStyle": "solid",
                                                  "outlineWidth": "1px",
                                                  "textAlign": "start",
                                                  "width": "24px",
                                                  "borderRadius": "5px",
                                                  "padding": "0px"
                                                }} aria-label="Add context" aria-haspopup="menu" aria-expanded="false" type="button">
    <span style={{
                                                    "alignItems": "center",
                                                    "display": "flex",
                                                    "height": "24px",
                                                    "justifyContent": "center",
                                                    "minWidth": "24px",
                                                    "width": "24px",
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
                                                        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                                                      }} d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6"></path>
      </svg>
    </span>
  </button>
</span>
                          </div>
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                              "display": "grid",
                                              "fontFamily": "Inter, sans-serif",
                                              "fontSize": "11px",
                                              "fontWeight": "400",
                                              "gridTemplateColumns": "24px",
                                              "gridTemplateRows": "24px",
                                              "height": "24px",
                                              "justifyItems": "center",
                                              "lineHeight": "16px",
                                              "minWidth": "24px",
                                              "outlineColor": "rgba(0, 0, 0, 0)",
                                              "outlineOffset": "-1px",
                                              "outlineStyle": "solid",
                                              "outlineWidth": "1px",
                                              "textAlign": "start",
                                              "width": "24px",
                                              "borderRadius": "5px",
                                              "padding": "0px"
                                            }} aria-haspopup="dialog" aria-label="Select deck template" aria-expanded="false" type="button">
                            <span style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "height": "24px",
                                                "justifyContent": "center",
                                                "minWidth": "24px",
                                                "width": "24px",
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
                                                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                                                  }} d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
  </svg>
</span>
                          </button>
                        </div>
                        <div style={{
                                            "alignItems": "center",
                                            "columnGap": "8px",
                                            "display": "flex",
                                            "marginLeft": "auto",
                                            "rowGap": "8px",
                                            "minWidth": "0px"
                                          }}>
                          <div style={{
                                              "flexShrink": "0"
                                            }}>
                            <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "rowGap": "8px"
                                              }}>
  <div style={{
                                                  "alignItems": "center",
                                                  "display": "flex"
                                                }}>
    <button style={{
                                                    "alignItems": "center",
                                                    "appearance": "auto",
                                                    "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
                                                    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                                    "display": "grid",
                                                    "fontFamily": "Inter, sans-serif",
                                                    "fontSize": "11px",
                                                    "fontWeight": "400",
                                                    "gridTemplateColumns": "24px",
                                                    "gridTemplateRows": "24px",
                                                    "height": "24px",
                                                    "justifyItems": "center",
                                                    "lineHeight": "16px",
                                                    "minWidth": "24px",
                                                    "outlineColor": "rgba(0, 0, 0, 0)",
                                                    "outlineOffset": "-1px",
                                                    "outlineStyle": "solid",
                                                    "outlineWidth": "1px",
                                                    "textAlign": "start",
                                                    "width": "24px",
                                                    "borderRadius": "9999px",
                                                    "padding": "0px"
                                                  }} aria-label="Dictate" type="button">
      <span style={{
                                                      "alignItems": "center",
                                                      "display": "flex",
                                                      "height": "24px",
                                                      "justifyContent": "center",
                                                      "minWidth": "24px",
                                                      "width": "24px",
                                                      "borderRadius": "9999px"
                                                    }} aria-hidden="true">
        <svg style={{
                                                        "display": "block",
                                                        "height": "24px",
                                                        "overflowX": "hidden",
                                                        "overflowY": "hidden",
                                                        "width": "24px"
                                                      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path style={{
                                                          "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
                                                        }} d="M16.5 11.5a.5.5 0 0 1 .5.5 5 5 0 0 1-4.5 4.975V18h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.025A5 5 0 0 1 7 12a.5.5 0 0 1 1 0 4 4 0 0 0 8 0 .5.5 0 0 1 .5-.5M12 5a3 3 0 0 1 3 3v4l-.004.154a3 3 0 0 1-5.992 0L9 12V8a3 3 0 0 1 3-3m0 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V8a2 2 0 0 0-2-2"></path>
        </svg>
      </span>
    </button>
  </div>
  <div style={{
                                                  "alignItems": "center",
                                                  "display": "flex",
                                                  "justifyContent": "center"
                                                }}>
    <button style={{
                                                    "alignItems": "center",
                                                    "appearance": "auto",
                                                    "backgroundColor": "var(--ad-divider-strong, rgb(217, 217, 217))",
                                                    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                                                    "display": "flex",
                                                    "flexShrink": "0",
                                                    "fontFamily": "Inter, sans-serif",
                                                    "fontSize": "11px",
                                                    "fontWeight": "400",
                                                    "height": "24px",
                                                    "justifyContent": "start",
                                                    "lineHeight": "16px",
                                                    "textAlign": "center",
                                                    "width": "24px",
                                                    "borderRadius": "9999px",
                                                    "padding": "0px"
                                                  }} aria-disabled="true" type="button" aria-label="Send">
      <div style={{
                                                      "alignItems": "center",
                                                      "display": "flex",
                                                      "height": "24px",
                                                      "justifyContent": "center",
                                                      "position": "relative",
                                                      "width": "24px"
                                                    }}>
        <div style={{
                                                        "position": "absolute",
                                                        "minWidth": "0px",
                                                        "minHeight": "0px"
                                                      }}>
          <svg style={{
                                                          "display": "block",
                                                          "flexShrink": "0",
                                                          "height": "24px",
                                                          "overflowX": "hidden",
                                                          "overflowY": "hidden",
                                                          "width": "24px"
                                                        }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
                                                            "fill": "var(--ad-surface, rgb(255, 255, 255))"
                                                          }} d="M11.725 5.582a.5.5 0 0 1 .629.064l4.5 4.5a.5.5 0 1 1-.707.707L12.5 7.208V18a.5.5 0 0 1-1 0V7.207l-3.646 3.647a.5.5 0 1 1-.708-.707l4.5-4.5z"></path>
          </svg>
        </div>
      </div>
    </button>
  </div>
</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
                </div>
                <div style={{
                  "display": "flex",
                  "flexDirection": "column",
                  "flexShrink": "0",
                  "height": "795px",
                  "overflowX": "auto",
                  "overflowY": "auto",
                  "width": "306px",
                  "minHeight": "0px"
                }} aria-hidden="true">
                  <div style={{
                    "display": "flex",
                    "flexDirection": "column",
                    "flexGrow": "1",
                    "minHeight": "0px"
                  }} role="region" aria-label="Chat history">
  <div style={{
                      "clipPath": "inset(50%)",
                      "height": "1px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "position": "absolute",
                      "width": "1px",
                      "minWidth": "0px",
                      "minHeight": "0px",
                      "whiteSpace": "nowrap",
                      "margin": "-1px"
                    }} aria-atomic="true" aria-live="polite"></div>
  <div style={{
                      "boxSizing": "content-box",
                      "columnGap": "4px",
                      "display": "flex",
                      "flexDirection": "column",
                      "flexGrow": "1",
                      "overflowX": "auto",
                      "overflowY": "auto",
                      "rowGap": "4px",
                      "minHeight": "0px",
                      "padding": "8px 8px 68px 8px"
                    }}>
    <div style={{
                        "columnGap": "4px",
                        "display": "flex",
                        "flexDirection": "column",
                        "flexGrow": "1",
                        "rowGap": "4px"
                      }}>
      <div style={{
                          "alignItems": "center",
                          "boxSizing": "content-box",
                          "display": "flex",
                          "padding": "8px 8px 4px 8px"
                        }}>
        <h3 style={{
                            "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontSize": "11px",
                            "fontWeight": "450",
                            "letterSpacing": "0.05504px",
                            "lineHeight": "16px",
                            "marginBottom": "0px",
                            "marginTop": "0px",
                            "whiteSpace": "pre"
                          }}>
          <span style={{
                              "whiteSpace": "pre"
                            }}>Today</span>
        </h3>
      </div>
      <div style={{
                          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                          "minHeight": "48px",
                          "position": "relative",
                          "minWidth": "0px",
                          "borderRadius": "5px"
                        }}>
        <button style={{
                            "alignItems": "flex-start",
                            "appearance": "auto",
                            "backgroundColor": "rgba(0, 0, 0, 0)",
                            "boxSizing": "border-box",
                            "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                            "columnGap": "14px",
                            "display": "flex",
                            "fontFamily": "Inter, sans-serif",
                            "fontSize": "11px",
                            "fontWeight": "400",
                            "justifyItems": "center",
                            "lineHeight": "16px",
                            "rowGap": "14px",
                            "textAlign": "left",
                            "width": "290px",
                            "borderRadius": "5px",
                            "padding": "8px"
                          }} type="button">
          <div style={{
                              "flexShrink": "0",
                              "height": "32px",
                              "position": "relative",
                              "width": "32px"
                            }}>
            <div style={{
                                "alignItems": "center",
                                "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                                "boxSizing": "content-box",
                                "display": "flex",
                                "height": "32px",
                                "justifyContent": "center",
                                "width": "32px",
                                "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
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
                                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                                  }} fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </div>
          <div style={{
                              "columnGap": "2px",
                              "display": "flex",
                              "flexDirection": "column",
                              "flexGrow": "1",
                              "rowGap": "2px",
                              "minWidth": "0px"
                            }}>
            <div style={{
                                "alignItems": "center",
                                "columnGap": "8px",
                                "display": "flex",
                                "rowGap": "8px",
                                "minWidth": "0px"
                              }}>
              <div style={{
                                  "alignItems": "center",
                                  "columnGap": "4px",
                                  "display": "flex",
                                  "flexGrow": "1",
                                  "rowGap": "4px",
                                  "minWidth": "0px"
                                }}>
                <div style={{
                                    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                    "fontWeight": "550",
                                    "letterSpacing": "0.05504px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textOverflow": "ellipsis",
                                    "minWidth": "0px",
                                    "whiteSpace": "nowrap"
                                  }}>
                  <span style={{
                                      "whiteSpace": "nowrap"
                                    }}>New chat</span>
                </div>
              </div>
              <div style={{
                                  "alignItems": "center",
                                  "columnGap": "8px",
                                  "display": "flex",
                                  "flexShrink": "0",
                                  "justifyContent": "flex-end",
                                  "rowGap": "8px"
                                }}>
                <div style={{
                                    "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                                    "flexShrink": "0",
                                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                    "fontWeight": "450",
                                    "letterSpacing": "0.05504px",
                                    "maxWidth": "80px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textOverflow": "ellipsis",
                                    "whiteSpace": "nowrap"
                                  }}>
                  <span style={{
                                      "whiteSpace": "nowrap"
                                    }}>Just now</span>
                </div>
              </div>
            </div>
            <div style={{
                                "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
                                "display": "-webkit-box",
                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                "fontWeight": "450",
                                "letterSpacing": "0.05504px",
                                "overflowX": "hidden",
                                "overflowY": "hidden",
                                "textOverflow": "ellipsis",
                                "WebkitBoxOrient": "vertical",
                                "WebkitLineClamp": "2"
                              }}>
              Not started
            </div>
          </div>
        </button>
        <div style={{
                            "position": "absolute",
                            "left": "0px",
                            "top": "50px",
                            "width": "0px"
                          }} aria-hidden="true"></div>
      </div>
    </div>
  </div>
</div>
                </div>
              </div>
            </div>
            <div style={{
              "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
              "borderRightColor": "var(--ad-divider, rgb(230, 230, 230))",
              "borderRightStyle": "solid",
              "borderRightWidth": "1px",
              "boxSizing": "content-box",
              "display": "flex",
              "flexDirection": "column",
              "height": "923px",
              "position": "absolute",
              "width": "72px",
              "zIndex": "-1",
              "minWidth": "0px",
              "minHeight": "0px",
              "left": "306px",
              "top": "0px"
            }}>
              <div style={{
                "alignItems": "center",
                "borderBottomColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
                "borderBottomStyle": "solid",
                "borderBottomWidth": "1px",
                "boxSizing": "content-box",
                "display": "flex",
                "height": "64px",
                "justifyContent": "center",
                "top": "0px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                  "boxSizing": "border-box",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "height": "28px",
                  "justifyContent": "center",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "width": "48px",
                  "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
                  "borderRadius": "2px",
                  "padding": "0px"
                }} aria-label="New slide" type="button">
  <svg style={{
                    "display": "block",
                    "height": "24px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "width": "24px"
                  }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                      "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                    }} fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
  </svg>
</button>
              </div>
              <div style={{
                "display": "contents",
                "minWidth": "0px",
                "minHeight": "0px"
              }}>
                <div style={{
                  "alignItems": "center",
                  "boxSizing": "border-box",
                  "flexGrow": "1",
                  "height": "858px",
                  "overflowAnchor": "none",
                  "overflowX": "auto",
                  "overflowY": "scroll",
                  "paddingBottom": "8px",
                  "paddingRight": "2px",
                  "paddingTop": "8px",
                  "position": "relative",
                  "scrollbarWidth": "none",
                  "width": "72px"
                }}>
  <ul style={{
                    "alignItems": "center",
                    "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                    "boxSizing": "border-box",
                    "columnGap": "12px",
                    "display": "flex",
                    "flexDirection": "column",
                    "height": "40px",
                    "justifyContent": "flex-start",
                    "left": "0px",
                    "listStyleImage": "none",
                    "listStylePosition": "outside",
                    "listStyleType": "none",
                    "marginBottom": "0px",
                    "marginTop": "0px",
                    "position": "absolute",
                    "rowGap": "12px",
                    "top": "0px",
                    "width": "72px",
                    "padding": "12px"
                  }}>
    <li style={{
                      "boxSizing": "border-box",
                      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "40px",
                      "left": "0px",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none",
                      "paddingLeft": "12px",
                      "paddingRight": "12px",
                      "position": "absolute",
                      "top": "0px",
                      "transform": "matrix(1, 0, 0, 1, 0, 12)",
                      "transformOrigin": "36px 20px",
                      "width": "72px",
                      "minWidth": "0px",
                      "minHeight": "0px"
                    }} value="1:42">
      <button style={{
                        "appearance": "auto",
                        "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
                        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "28px",
                        "lineHeight": "16px",
                        "outlineColor": "var(--ad-selection-strong, rgb(0, 123, 229))",
                        "outlineStyle": "solid",
                        "outlineWidth": "2px",
                        "position": "relative",
                        "textAlign": "center",
                        "width": "48px",
                        "zIndex": "0",
                        "borderRadius": "2px",
                        "padding": "0px"
                      }} aria-label="Slide 1" aria-pressed="true" aria-selected="true">
        <div style={{
                          "alignItems": "center",
                          "display": "inline-flex",
                          "height": "28px",
                          "justifyContent": "center",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "width": "48px",
                          "borderRadius": "2px"
                        }}>
          <div style={{
                            "display": "flex",
                            "height": "28px",
                            "position": "relative",
                            "width": "48px"
                          }}>
            <div style={{
                              "alignItems": "center",
                              "backgroundColor": "var(--ad-selection-subtle, rgb(242, 249, 255))",
                              "display": "flex",
                              "height": "28px",
                              "justifyContent": "center",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "width": "48px"
                            }}>
              <div style={{
                                "alignItems": "flex-end",
                                "boxSizing": "border-box",
                                "columnGap": "4px",
                                "display": "flex",
                                "flexDirection": "column",
                                "height": "28px",
                                "left": "0px",
                                "position": "absolute",
                                "rowGap": "4px",
                                "top": "0px",
                                "width": "48px",
                                "zIndex": "1",
                                "minWidth": "0px",
                                "minHeight": "0px",
                                "padding": "4px"
                              }}></div>
              <img style={{
                                "aspectRatio": "16 / 9",
                                "display": "block",
                                "height": "28px",
                                "objectFit": "cover",
                                "overflowX": "clip",
                                "overflowY": "clip",
                                "width": "48px"
                              }} alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAADKCAYAAACIRtqEAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAACLRJREFUeAHt3Ytx2zoWBmB5dwtJJ0kqSTqJU0oqidNJUonXx3NPBovLp23p/pn9vhmN9aAIgB79AkEKvHt8cgEgyt2Tf10AiCSgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUL953JDDw8Plx8/fvzPc1++fFldpl/7+PHj8/P39/d/W3729evX57/v37+/fPjw4fIava7ZXh3e0kvas7Sd11RbavnaxuX79++75bzlNgY2PN7I0wf5sYpbuj0F7+/l6n4/3/pxrWPP0jpfaq2+XZenMHu8tpe0Z9yGe7d5+W5T/a3n6za38y23MbCs8vkmPejqcVUvrXWvq5+rnvFWb6x6ddUjrGVSVN3rdqTHmW7cI+i21Pau/0upv3rKcHs3GYPuD3qpL4YKtb61teGEUuFQIbIUEh2UR81fFkdU/avefRvb00MDrymrltlq/1m1rdbqOz7/15f07/e81dDNS7YxsODxBi7TLvWod6N7d3lriGPcpa7d7su0uz4+N+9+Lw2x7O2iby031nOu19GyloYi5qGTpfeP6z8yzLC0TbdeXxsi2arTmXYD+24W0OMHt+5vfWiPBvRlZ2x1LdDq/vx4zV7I7NVrDqy1Op0Jw/FL6MiY/No23Xr9JQF9tN3AMZXPNxniGHed+2yMu7u759tLdu3H99Swx+Nfu+tLQyDj7vY4tNK7/W+xK97rGuvV5Yz1Gsvscsf67w35jGdb1PvG5d9S/b/GYZEe4llztN3AOTc5SNghVB/k+cNaj+t25mDbGKpjSNX9Cv21ZevA19LpZ1Wvtxh/Hds2llXt6nrMp8CNba77vY75gGh/sfVy1wrnl1hr96jq70AjnHPT86DHA1Hds+3gqscvCegzy16rJ7e03rWy9s4DX/ui+FMOum21W0DDOVcP6LHHOJ5K12HdPd5bBNBaeLzk9L29s07WwqjKGkP6JT3LPuvjlj+YOWKv3cBJj1e2d1Drcln/0cS8zNKZHuMZD0tncWwdIFv6EcZS3eaDXPMZJG08OLZV1toZIEtlzttuLPfoD2XOHiQ8W8e1dvePXYDzKp+v3oMee1R9kGvp4NGZXuTYG6v1jT+o2Ft2HmIpe+Pf4/jx3NMfx4L7Z9NbZdV2Hw/CjXUe1z33OLt+VV4fKDwzLHTWWH7Xa63HvtfuvYOMwIrHG1g6Z/kynZbVjp5mt3Sa2tr5wVvlHznNbu221IPdOn1urbe/Vae9tl/jPOi19nf9j/4/trYTsK3y+eZncZS59zj2zKrntnSmR7/Wqic59kz714bjRD5j+f1z8bHsvcl+tg4qrvUmq5wed98qa9wm3TNfWm6r7UctbdMjr4/1O1KnI+0GjrvrpAYgx90T80EDhBLQAKEENEAoAQ0QSkADhBLQAKEENEAoAQ0QSkADhLp6QPfUmH2bJxx62Ljo69YUpK+5yOrDwQvNnp0C9UidjpZ9rffvrXvr8d57j/5fgWOuHtA9R0apv/MVN7bmEN6aw+HIXMhzYPbjtat+zI4sc7ZOW+094hoT34/bZXSmnDP/V+CYm15Rpc09q3GSo35celL6cYrSfq0m+u/JfPr9PRl+rb8n7xkn65l7eK2W6ak758l95smXev39ZTOb69tljY/HZbquXU4/buNyPa3nWMexrPFiAOP9Lr/XvbbOub31/qW6zo/nbTq3ad4+wDH/SEDPM8+VDpGtK28c+XCPYTj34sZyx/tjr3TuoY5fFuN6OvzWXu+rxdSMbkvt/TDsWcxltf7yGduz1oMeA3Wsz7j3smRc59L757rW82vXQ1xq01j2a4al4P9RzEHCvgRWT0a/9NqRD3iHx9nxzwq4KmPpYq3juroutdzDcD3F1xp7n2Odxl7wkq7PfBmtPeP1Ic/ovY2yNoXp0p7KuIcAHPPv+/srXUl1wbt3737/ne///Pnz8u3bt+fQ6Nf69Xq+AqjCoV/rK4T32Gfv9ncQfP78+flvrXdcX62r19PP17Jdxvh8qed+/fr1uyfbPe56T916aKWWGetXf6sHPZc13x+fqzrU3+4h9+v1/KdPn/72vn6t29/16frOZcxl1XJdVm+nedvP7+/l6/3zHkqtr+oy1rX+R+M2mssAlj19br7+kfNB98Tw//R4ZtejvLYua2PQiZaOF6zpbfQntAuS1HzQJuwHCGTCfoBgAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJaIBQAhoglIAGCCWgAUIJ6AtAJgENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4QS0AChBDRAKAENEEpAA4T6L8RAeLiOZHZCAAAAAElFTkSuQmCC"></img>
            </div>
          </div>
        </div>
      </button>
    </li>
  </ul>
</div>
              </div>
            </div>
          </div>
          <div style={{
            "alignItems": "center",
            "backfaceVisibility": "hidden",
            "display": "flex",
            "height": "923px",
            "justifyContent": "center",
            "position": "absolute",
            "right": "-6px",
            "top": "0px",
            "width": "8px",
            "minWidth": "0px",
            "minHeight": "0px"
          }} role="slider" aria-label="Resize handle" aria-orientation="horizontal" aria-valuenow={306} aria-valuetext="306 pixels (max)" aria-valuemin={200} aria-valuemax={306}></div>
        </div>
      </div>
    </div>
  </div>
</div>);
}
