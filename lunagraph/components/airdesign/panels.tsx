import type { CSSProperties } from "react";

export interface AirDesignComponentProps { style?: CSSProperties; className?: string; }

export function AgentsSidebar({ style, className }: AirDesignComponentProps) {
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
}} role="region" aria-label="Left sidebar" className={className}>
  <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "borderRightColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
          <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
          <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        </svg>
      </button>
      <div style={{
        "borderBottomColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
          "backgroundColor": "rgb(255, 223, 204)",
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
                  "fill": "rgb(226, 76, 12)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
            "backgroundColor": "rgb(255, 255, 255)",
            "borderRightColor": "rgba(0, 0, 0, 0.1)",
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
              "borderBottomColor": "rgb(230, 230, 230)",
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
                          "color": "rgba(0, 0, 0, 0.898)",
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
                          "color": "rgba(0, 0, 0, 0.898)",
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
                              "color": "rgb(0, 0, 0)",
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
                                    "fill": "rgba(0, 0, 0, 0.898)"
                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
                  "color": "rgb(0, 0, 0)",
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
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
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
                    "color": "rgba(0, 0, 0, 0.5)",
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
                  }} aria-label="Drafts" href="https://www.figma.com/files/team/1505619433971646255/project/386051928" rel="noopener" target="_blank">
  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Drafts</span>
</a>
                </span>
              </div>
            </div>
            <div style={{
              "alignItems": "flex-start",
              "backgroundColor": "rgb(255, 255, 255)",
              "borderBottomColor": "rgb(230, 230, 230)",
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
                    "color": "rgba(0, 0, 0, 0.898)",
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
                    "color": "rgba(0, 0, 0, 0.5)",
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
                  }} aria-label="Beta, Learn more" href="https://help.figma.com/hc/articles/37998629035799" rel="noopener" target="_blank">
  <div style={{
                      "alignItems": "center",
                      "boxSizing": "content-box",
                      "color": "rgba(0, 0, 0, 0.5)",
                      "columnGap": "4px",
                      "display": "flex",
                      "fontSize": "11px",
                      "height": "16px",
                      "justifyContent": "center",
                      "paddingLeft": "4px",
                      "paddingRight": "4px",
                      "rowGap": "4px",
                      "border": "1px solid rgb(230, 230, 230)",
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
                      "color": "rgb(0, 0, 0)",
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
                            "fill": "rgba(0, 0, 0, 0.898)"
                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
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
                                            "backgroundColor": "rgb(255, 223, 204)",
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
                                                "fill": "rgb(226, 76, 12)"
                                              }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
                          </svg>
                        </div>
                        <h2 style={{
                                            "color": "rgba(0, 0, 0, 0.898)",
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
                                            "border": "1px solid rgb(230, 230, 230)",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "rgb(0, 0, 0)",
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
                                                    "fill": "rgba(0, 0, 0, 0.5)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
</svg>
                            </span>
                            <span style={{
                                                "color": "rgba(0, 0, 0, 0.898)",
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
                                                    "fill": "rgba(0, 0, 0, 0.3)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
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
                                            "border": "1px solid rgb(230, 230, 230)",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "rgb(0, 0, 0)",
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
                                                    "fill": "rgba(0, 0, 0, 0.5)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
</svg>
                            </span>
                            <span style={{
                                                "color": "rgba(0, 0, 0, 0.898)",
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
                                                    "fill": "rgba(0, 0, 0, 0.3)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
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
                                            "border": "1px solid rgb(230, 230, 230)",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "rgb(0, 0, 0)",
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
                                                    "fill": "rgba(0, 0, 0, 0.5)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
  </svg>
</span>
                            <span style={{
                                                "color": "rgba(0, 0, 0, 0.898)",
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
                                                    "fill": "rgba(0, 0, 0, 0.3)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
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
                                            "border": "1px solid rgb(230, 230, 230)",
                                            "borderRadius": "13px"
                                          }} role="group">
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "boxSizing": "border-box",
                                              "color": "rgb(0, 0, 0)",
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
                                                    "fill": "rgba(0, 0, 0, 0.5)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6.057 14.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.458.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 16a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.057 9.763c.184-.35.7-.35.884 0l.034.08.295.886.886.294c.458.153.457.8 0 .953l-.886.294-.295.886a.502.502 0 0 1-.952 0l-.295-.886-.886-.294a.502.502 0 0 1 0-.953l.885-.296.296-.884zM18.5 11a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1zM6.058 4.763c.185-.35.7-.35.884 0l.034.08.295.886.886.294c.457.153.457.8 0 .953l-.886.295-.295.885a.502.502 0 0 1-.952 0l-.295-.885-.886-.295a.502.502 0 0 1 0-.953l.885-.295.296-.885zM18.5 6a.5.5 0 0 1 0 1h-8a.5.5 0 0 1 0-1z" clipRule="evenodd"></path>
  </svg>
</span>
                            <span style={{
                                                "color": "rgba(0, 0, 0, 0.898)",
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
                                                    "fill": "rgba(0, 0, 0, 0.3)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M15.647 10.147a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L12 13.793z"></path>
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
                                    "backgroundImage": "linear-gradient(to top, rgb(255, 255, 255) 0%, rgba(0, 0, 0, 0) 100%)",
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
                                      "backgroundColor": "rgb(255, 255, 255)",
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
                                      "border": "1px solid rgb(230, 230, 230)",
                                      "borderRadius": "13px"
                                    }}>
                    <div style={{
                                        "backgroundColor": "rgb(255, 255, 255)",
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
                                            "backgroundColor": "rgb(255, 255, 255)",
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
                                                "color": "rgba(0, 0, 0, 0.898)",
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
                                              "color": "rgba(0, 0, 0, 0.5)",
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
                                                  "color": "rgb(0, 0, 0)",
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
                                                        "fill": "rgba(0, 0, 0, 0.898)"
                                                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6"></path>
      </svg>
    </span>
  </button>
</span>
                          </div>
                          <button style={{
                                              "alignItems": "center",
                                              "appearance": "auto",
                                              "backgroundColor": "rgba(0, 0, 0, 0)",
                                              "color": "rgb(0, 0, 0)",
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
                                                    "fill": "rgba(0, 0, 0, 0.898)"
                                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
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
                                                    "backgroundColor": "rgb(255, 223, 204)",
                                                    "color": "rgb(0, 0, 0)",
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
                                                          "fill": "rgb(226, 76, 12)"
                                                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.5 11.5a.5.5 0 0 1 .5.5 5 5 0 0 1-4.5 4.975V18h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.025A5 5 0 0 1 7 12a.5.5 0 0 1 1 0 4 4 0 0 0 8 0 .5.5 0 0 1 .5-.5M12 5a3 3 0 0 1 3 3v4l-.004.154a3 3 0 0 1-5.992 0L9 12V8a3 3 0 0 1 3-3m0 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V8a2 2 0 0 0-2-2"></path>
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
                                                    "backgroundColor": "rgb(217, 217, 217)",
                                                    "color": "rgb(0, 0, 0)",
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
                                                            "fill": "rgb(255, 255, 255)"
                                                          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.725 5.582a.5.5 0 0 1 .629.064l4.5 4.5a.5.5 0 1 1-.707.707L12.5 7.208V18a.5.5 0 0 1-1 0V7.207l-3.646 3.647a.5.5 0 1 1-.708-.707l4.5-4.5z"></path>
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
                            "color": "rgba(0, 0, 0, 0.5)",
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
                          "backgroundColor": "rgb(255, 255, 255)",
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
                            "color": "rgb(0, 0, 0)",
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
                                "backgroundColor": "rgb(245, 245, 245)",
                                "boxSizing": "content-box",
                                "display": "flex",
                                "height": "32px",
                                "justifyContent": "center",
                                "width": "32px",
                                "border": "1px solid rgba(0, 0, 0, 0.1)",
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
                                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
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
                                    "color": "rgba(0, 0, 0, 0.898)",
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
                                    "color": "rgba(0, 0, 0, 0.5)",
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
                                "color": "rgba(0, 0, 0, 0.5)",
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
              "backgroundColor": "rgb(245, 245, 245)",
              "borderRightColor": "rgb(230, 230, 230)",
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
                "borderBottomColor": "rgba(0, 0, 0, 0.1)",
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
                  "backgroundColor": "rgb(255, 255, 255)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
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
                  "border": "1px solid rgba(0, 0, 0, 0.1)",
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
                      "fill": "rgba(0, 0, 0, 0.898)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
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
                    "backgroundColor": "rgb(245, 245, 245)",
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
                      "color": "rgba(0, 0, 0, 0.898)",
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
                        "backgroundColor": "rgb(245, 245, 245)",
                        "color": "rgb(0, 0, 0)",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "28px",
                        "lineHeight": "16px",
                        "outlineColor": "rgb(0, 123, 229)",
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
                              "backgroundColor": "rgb(242, 249, 255)",
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

export function FileSidebar({ style, className }: AirDesignComponentProps) {
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
}} role="region" aria-label="Left sidebar" className={className}>
  <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "borderRightColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
          <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
          <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        </svg>
      </button>
      <div style={{
        "borderBottomColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-expanded="true" aria-label="File" type="button">
        <div style={{
          "alignItems": "center",
          "backgroundColor": "rgb(255, 223, 204)",
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
              "fill": "rgb(226, 76, 12)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-expanded="false" aria-label="Agents" type="button">
        <div style={{
          "alignItems": "center",
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
                  "fill": "rgba(0, 0, 0, 0.898)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
          "width": "240px"
        }}>
          <div style={{
            "backgroundColor": "rgb(255, 255, 255)",
            "borderRightColor": "rgba(0, 0, 0, 0.1)",
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
            "width": "240px"
          }}>
            <div>
              <div style={{
                "borderBottomColor": "rgb(230, 230, 230)",
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
                            "color": "rgba(0, 0, 0, 0.898)",
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
                            "color": "rgba(0, 0, 0, 0.898)",
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
                                "color": "rgb(0, 0, 0)",
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
                                      "fill": "rgba(0, 0, 0, 0.898)"
                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
                    "color": "rgb(0, 0, 0)",
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
                          "fill": "rgba(0, 0, 0, 0.898)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
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
                      "color": "rgba(0, 0, 0, 0.5)",
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
                    }} aria-label="Drafts" href="https://www.figma.com/files/team/1505619433971646255/project/386051928" rel="noopener" target="_blank">
  <span style={{
                        "whiteSpace": "nowrap"
                      }}>Drafts</span>
</a>
                  </span>
                </div>
              </div>
              <div style={{
                "boxSizing": "border-box",
                "columnGap": "8px",
                "display": "flex",
                "rowGap": "8px",
                "width": "240px",
                "padding": "16px 16px 8px 16px"
              }}>
                <div style={{
                  "display": "flex",
                  "height": "24px",
                  "justifyContent": "center",
                  "width": "208px"
                }}>
                  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(255, 255, 255)",
                    "borderBottomColor": "rgb(230, 230, 230)",
                    "borderBottomLeftRadius": "6px",
                    "borderBottomStyle": "solid",
                    "borderBottomWidth": "1px",
                    "borderLeftColor": "rgb(230, 230, 230)",
                    "borderLeftStyle": "solid",
                    "borderLeftWidth": "1px",
                    "borderTopColor": "rgb(230, 230, 230)",
                    "borderTopLeftRadius": "6px",
                    "borderTopStyle": "solid",
                    "borderTopWidth": "1px",
                    "boxSizing": "border-box",
                    "color": "rgb(0, 0, 0)",
                    "display": "flex",
                    "flexGrow": "1",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "height": "24px",
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "padding": "0px 0px 0px 24px"
                  }} aria-label="New slide" aria-description="Add slide from template" aria-haspopup="dialog" aria-expanded="false" type="button">
                    <p style={{
                      "color": "rgb(0, 0, 0)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "marginBottom": "0px",
                      "marginTop": "0px",
                      "whiteSpace": "nowrap"
                    }}>
  <span style={{
                        "whiteSpace": "nowrap"
                      }}>New slide</span>
</p>
                    <svg style={{
                      "display": "block",
                      "height": "16px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "16px"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
</svg>
                  </button>
                  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(255, 255, 255)",
                    "borderBottomRightRadius": "6px",
                    "borderTopRightRadius": "6px",
                    "boxSizing": "border-box",
                    "color": "rgb(0, 0, 0)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "border": "1px solid rgb(230, 230, 230)",
                    "padding": "0px"
                  }} aria-label="Add blank slide" type="button">
                    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
</svg>
                  </button>
                </div>
              </div>
            </div>
            <div style={{
              "display": "flex",
              "flexDirection": "column",
              "flexGrow": "1",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "position": "relative"
            }}>
              <div style={{
                "display": "contents",
                "minWidth": "0px",
                "minHeight": "0px"
              }}>
                <div style={{
                  "alignItems": "flex-end",
                  "bottom": "0px",
                  "display": "flex",
                  "height": "64px",
                  "justifyContent": "center",
                  "left": "0px",
                  "opacity": "0",
                  "position": "absolute",
                  "width": "240px",
                  "zIndex": "1"
                }}>
                  <div style={{
                    "backgroundImage": "linear-gradient(0deg, rgb(255, 255, 255) -30%, rgba(0, 0, 0, 0) 100%)",
                    "bottom": "0px",
                    "height": "100px",
                    "left": "0px",
                    "position": "absolute",
                    "width": "240px",
                    "minWidth": "0px",
                    "minHeight": "0px"
                  }}></div>
                  <div style={{
                    "backgroundColor": "rgb(255, 255, 255)",
                    "lineHeight": "0px",
                    "marginBottom": "16px",
                    "borderRadius": "5px"
                  }}>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "rgba(0, 0, 0, 0.898)",
                      "display": "inline-flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "height": "24px",
                      "justifyItems": "center",
                      "letterSpacing": "0.05504px",
                      "lineHeight": "16px",
                      "maxWidth": "100%",
                      "outlineColor": "rgba(0, 0, 0, 0.1)",
                      "outlineOffset": "-1px",
                      "outlineStyle": "solid",
                      "outlineWidth": "1px",
                      "position": "relative",
                      "textAlign": "center",
                      "borderRadius": "5px",
                      "padding": "0px"
                    }} type="button">
  <span style={{
                        "display": "flex",
                        "height": "24px",
                        "maxWidth": "100%",
                        "width": "148.211px"
                      }}>
    <span style={{
                          "alignItems": "center",
                          "display": "flex",
                          "justifyContent": "center",
                          "marginLeft": "8px",
                          "marginRight": "8px",
                          "maxWidth": "100%",
                          "overflowX": "hidden",
                          "overflowY": "hidden"
                        }}>
      <span style={{
                            "alignItems": "center",
                            "display": "flex",
                            "height": "24px",
                            "marginLeft": "-4px"
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
                              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M8.854 7.146a.5.5 0 0 1 0 .708L6.707 10H15.5a3.5 3.5 0 1 1 0 7h-1a.5.5 0 1 1 0-1h1a2.5 2.5 0 0 0 0-5H6.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.707l3-3a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
        </svg>
      </span>
      <span style={{
                            "display": "block",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "textOverflow": "ellipsis",
                            "whiteSpace": "nowrap"
                          }}>
        <span style={{
                              "whiteSpace": "nowrap"
                            }}>Scroll to current slide</span>
      </span>
    </span>
  </span>
</button>
                  </div>
                </div>
                <div style={{
                  "alignItems": "center",
                  "boxSizing": "border-box",
                  "flexGrow": "1",
                  "height": "810px",
                  "overflowAnchor": "none",
                  "overflowX": "auto",
                  "overflowY": "scroll",
                  "paddingBottom": "8px",
                  "paddingRight": "2px",
                  "paddingTop": "8px",
                  "position": "relative",
                  "scrollbarWidth": "none",
                  "width": "240px"
                }}>
                  <ul style={{
                    "alignItems": "flex-end",
                    "display": "flex",
                    "flexDirection": "column",
                    "height": "169px",
                    "justifyContent": "flex-start",
                    "left": "0px",
                    "listStyleImage": "none",
                    "listStylePosition": "outside",
                    "listStyleType": "none",
                    "marginBottom": "0px",
                    "marginTop": "0px",
                    "paddingLeft": "0px",
                    "position": "absolute",
                    "top": "0px",
                    "width": "240px"
                  }}>
  <li style={{
                      "boxSizing": "border-box",
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "121px",
                      "left": "0px",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none",
                      "paddingLeft": "8px",
                      "paddingRight": "8px",
                      "position": "absolute",
                      "top": "0px",
                      "transform": "matrix(1, 0, 0, 1, 0, 8)",
                      "transformOrigin": "120px 60.5px",
                      "width": "240px",
                      "minWidth": "0px",
                      "minHeight": "0px"
                    }} value="1:42">
    <button style={{
                        "appearance": "auto",
                        "backgroundColor": "rgb(217, 217, 217)",
                        "color": "rgb(0, 0, 0)",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "lineHeight": "16px",
                        "position": "relative",
                        "textAlign": "center",
                        "width": "224px",
                        "zIndex": "0",
                        "borderRadius": "9px",
                        "padding": "0px"
                      }} aria-label="Slide 1" aria-pressed="true" aria-selected="true">
      <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "inline-flex",
                          "justifyContent": "center",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "width": "224px",
                          "borderRadius": "5px",
                          "padding": "8px"
                        }}>
        <div style={{
                            "alignItems": "center",
                            "alignSelf": "flex-start",
                            "display": "flex",
                            "flexDirection": "column",
                            "flexShrink": "0",
                            "marginRight": "8px",
                            "width": "12px"
                          }}>
          <span style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "display": "block",
                              "fontSize": "13px"
                            }}>
            1
          </span>
        </div>
        <div style={{
                            "display": "flex",
                            "position": "relative",
                            "width": "188px"
                          }}>
          <div style={{
                              "alignItems": "center",
                              "aspectRatio": "16 / 9",
                              "backgroundColor": "rgb(242, 249, 255)",
                              "display": "flex",
                              "justifyContent": "center",
                              "outlineColor": "rgba(0, 0, 0, 0.1)",
                              "outlineStyle": "solid",
                              "outlineWidth": "1px",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "width": "188px",
                              "borderRadius": "5px"
                            }}>
            <div style={{
                                "alignItems": "flex-end",
                                "boxSizing": "border-box",
                                "columnGap": "4px",
                                "display": "flex",
                                "flexDirection": "column",
                                "height": "105.75px",
                                "left": "0px",
                                "position": "absolute",
                                "rowGap": "4px",
                                "top": "0px",
                                "width": "188px",
                                "zIndex": "1",
                                "minWidth": "0px",
                                "minHeight": "0px",
                                "padding": "4px"
                              }}></div>
            <img style={{
                                "aspectRatio": "16 / 9",
                                "display": "block",
                                "height": "105.75px",
                                "objectFit": "cover",
                                "overflowX": "clip",
                                "overflowY": "clip",
                                "width": "188px"
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
          }} role="slider" aria-label="Resize handle" aria-orientation="horizontal" aria-valuenow={240} aria-valuetext="240 pixels" aria-valuemin={200} aria-valuemax={306}></div>
        </div>
      </div>
    </div>
  </div>
</div>);
}

export function InsertSidebar({ style, className }: AirDesignComponentProps) {
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
}} role="region" aria-label="Left sidebar" className={className}>
  <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "borderRightColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
          <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
          <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        </svg>
      </button>
      <div style={{
        "borderBottomColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-expanded="false" aria-label="Agents" type="button">
        <div style={{
          "alignItems": "center",
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
                  "fill": "rgba(0, 0, 0, 0.898)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-expanded="true" aria-label="Inserts" type="button">
        <div style={{
          "alignItems": "center",
          "backgroundColor": "rgb(255, 223, 204)",
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
              "fill": "rgb(226, 76, 12)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
            "backgroundColor": "rgb(255, 255, 255)",
            "borderRightColor": "rgba(0, 0, 0, 0.1)",
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
              "borderBottomColor": "rgb(230, 230, 230)",
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
                          "color": "rgba(0, 0, 0, 0.898)",
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
                          "color": "rgba(0, 0, 0, 0.898)",
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
                              "color": "rgb(0, 0, 0)",
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
                                    "fill": "rgba(0, 0, 0, 0.898)"
                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
                  "color": "rgb(0, 0, 0)",
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
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
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
                    "color": "rgba(0, 0, 0, 0.5)",
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
                  }} aria-label="Drafts" href="https://www.figma.com/files/team/1505619433971646255/project/386051928" rel="noopener" target="_blank">
  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Drafts</span>
</a>
                </span>
              </div>
            </div>
            <div style={{
              "alignItems": "center",
              "backgroundColor": "rgb(255, 255, 255)",
              "borderBottomColor": "rgb(230, 230, 230)",
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
                "alignItems": "center",
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
                    "color": "rgba(0, 0, 0, 0.898)",
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
                    }}>Inserts</span>
</h2>
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
              }}></div>
            </div>
            <div style={{
              "display": "flex",
              "flexDirection": "column",
              "marginTop": "12px"
            }}>
              <div style={{
                "boxSizing": "content-box",
                "display": "flex",
                "flexDirection": "column",
                "paddingLeft": "12px",
                "paddingRight": "12px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "position": "relative",
                  "textAlign": "start",
                  "border": "1px solid rgba(0, 0, 0, 0)",
                  "borderRadius": "5px",
                  "padding": "0px"
                }} type="button">
                  <span style={{
                    "alignItems": "center",
                    "boxSizing": "content-box",
                    "columnGap": "4px",
                    "display": "flex",
                    "maxWidth": "100%",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "rowGap": "4px",
                    "padding": "8px"
                  }}>
  <span style={{
                      "alignItems": "center",
                      "display": "flex"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M4 14v-4h5v4zm-1 1V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm1-6h5V5H5a1 1 0 0 0-1 1zm6-4v4h10V6a1 1 0 0 0-1-1zm10 5H10v4h10zm0 5H10v4h9a1 1 0 0 0 1-1zM9 19H5a1 1 0 0 1-1-1v-3h5z" clipRule="evenodd"></path>
    </svg>
  </span>
  <span style={{
                      "display": "block",
                      "flexGrow": "1",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "13px",
                      "fontWeight": "450",
                      "letterSpacing": "-0.032px",
                      "lineHeight": "22px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "textOverflow": "ellipsis",
                      "whiteSpace": "nowrap"
                    }}>
    <span style={{
                        "whiteSpace": "nowrap"
                      }}>Table</span>
  </span>
</span>
                </button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "position": "relative",
                  "textAlign": "start",
                  "border": "1px solid rgba(0, 0, 0, 0)",
                  "borderRadius": "5px",
                  "padding": "0px"
                }} type="button">
  <span style={{
                    "alignItems": "center",
                    "boxSizing": "content-box",
                    "columnGap": "4px",
                    "display": "flex",
                    "maxWidth": "100%",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "rowGap": "4px",
                    "padding": "8px"
                  }}>
    <span style={{
                      "alignItems": "center",
                      "display": "flex"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.354 4.146a.5.5 0 0 1 0 .708L5.207 7l2.147 2.146a.5.5 0 1 1-.708.708l-2.5-2.5a.5.5 0 0 1 0-.708l2.5-2.5a.5.5 0 0 1 .708 0M14 4.5a.5.5 0 0 1 .5-.5H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.5a.5.5 0 0 1 1 0V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3.5a.5.5 0 0 1-.5-.5m-4.354.354a.5.5 0 1 1 .708-.708l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 0 1-.708-.708L11.793 7z" clipRule="evenodd"></path>
      </svg>
    </span>
    <span style={{
                      "display": "block",
                      "flexGrow": "1",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "13px",
                      "fontWeight": "450",
                      "letterSpacing": "-0.032px",
                      "lineHeight": "22px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "textOverflow": "ellipsis",
                      "whiteSpace": "nowrap"
                    }}>
      <span style={{
                        "whiteSpace": "nowrap"
                      }}>Code block</span>
    </span>
  </span>
</button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "position": "relative",
                  "textAlign": "start",
                  "border": "1px solid rgba(0, 0, 0, 0)",
                  "borderRadius": "5px",
                  "padding": "0px"
                }} type="button">
  <span style={{
                    "alignItems": "center",
                    "boxSizing": "content-box",
                    "columnGap": "4px",
                    "display": "flex",
                    "maxWidth": "100%",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "rowGap": "4px",
                    "padding": "8px"
                  }}>
    <span style={{
                      "alignItems": "center",
                      "display": "flex"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 1a8 8 0 1 0 0 16 8 8 0 0 0 0-16m3.056 3.003a.5.5 0 0 1 .441.553L15.336 9H16.5a.5.5 0 0 1 0 1h-1.274l-.445 4H16.5a.5.5 0 0 1 0 1h-1.83l-.173 1.556a.5.5 0 0 1-.994-.112L13.664 15H9.67l-.173 1.556a.5.5 0 0 1-.994-.112L8.664 15H7.5a.5.5 0 0 1 0-1h1.274l.445-4H7.5a.5.5 0 0 1 0-1h1.83l.173-1.556a.5.5 0 0 1 .994.112L10.336 9h3.994l.173-1.556a.5.5 0 0 1 .553-.441M9.78 14h3.993l.445-4h-3.993z"></path>
      </svg>
    </span>
    <span style={{
                      "display": "block",
                      "flexGrow": "1",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "13px",
                      "fontWeight": "450",
                      "letterSpacing": "-0.032px",
                      "lineHeight": "22px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "textOverflow": "ellipsis",
                      "whiteSpace": "nowrap"
                    }}>
      <span style={{
                        "whiteSpace": "nowrap"
                      }}>Slide number</span>
    </span>
  </span>
</button>
              </div>
              <div style={{
                "boxSizing": "content-box",
                "display": "flex",
                "flexDirection": "column",
                "flexGrow": "1",
                "padding": "8px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "columnGap": "8px",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "rowGap": "8px",
                  "textAlign": "start",
                  "width": "290px",
                  "borderRadius": "5px",
                  "padding": "8px"
                }} type="button">
  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(189, 227, 255)",
                    "display": "flex",
                    "flexShrink": "0",
                    "height": "56px",
                    "justifyContent": "center",
                    "width": "56px",
                    "borderRadius": "5px"
                  }}>
    <img style={{
                      "display": "block",
                      "height": "48px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "width": "48px"
                    }} alt="Text" src="https://static.figma.com/uploads/e614e423effbdc48395995943326a08f9627c698"></img>
  </div>
  <div style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
    Text
  </div>
</button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "columnGap": "8px",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "rowGap": "8px",
                  "textAlign": "start",
                  "width": "290px",
                  "borderRadius": "5px",
                  "padding": "8px"
                }} type="button">
  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(255, 189, 242)",
                    "display": "flex",
                    "flexShrink": "0",
                    "height": "56px",
                    "justifyContent": "center",
                    "width": "56px",
                    "borderRadius": "5px"
                  }}>
    <img style={{
                      "display": "block",
                      "height": "48px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "width": "48px"
                    }} alt="Media" src="https://static.figma.com/uploads/70d5d9b596cda9a5ad0a74fb2a86cf7eaa2c7d62"></img>
  </div>
  <div style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
    Media
  </div>
</button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "columnGap": "8px",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "rowGap": "8px",
                  "textAlign": "start",
                  "width": "290px",
                  "borderRadius": "5px",
                  "padding": "8px"
                }} type="button">
  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(182, 236, 247)",
                    "display": "flex",
                    "flexShrink": "0",
                    "height": "56px",
                    "justifyContent": "center",
                    "width": "56px",
                    "borderRadius": "5px"
                  }}>
    <img style={{
                      "display": "block",
                      "height": "48px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "width": "48px"
                    }} alt="Shapes" src="https://static.figma.com/uploads/cd5738b523b4155c28b21b7b3af707b7c587b267"></img>
  </div>
  <div style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
    Shapes
  </div>
</button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "columnGap": "8px",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "rowGap": "8px",
                  "textAlign": "start",
                  "width": "290px",
                  "borderRadius": "5px",
                  "padding": "8px"
                }} type="button">
  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(180, 178, 255)",
                    "display": "flex",
                    "flexShrink": "0",
                    "height": "56px",
                    "justifyContent": "center",
                    "width": "56px",
                    "borderRadius": "5px"
                  }}>
    <img style={{
                      "display": "block",
                      "height": "48px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "width": "48px"
                    }} alt="Prototypes" src="https://static.figma.com/uploads/90daffd5edf313ad0d686805b52c6cb6617ec7b9"></img>
  </div>
  <div style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
    Prototypes
  </div>
</button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "columnGap": "8px",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "rowGap": "8px",
                  "textAlign": "start",
                  "width": "290px",
                  "borderRadius": "5px",
                  "padding": "8px"
                }} type="button">
  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(255, 217, 102)",
                    "display": "flex",
                    "flexShrink": "0",
                    "height": "56px",
                    "justifyContent": "center",
                    "width": "56px",
                    "borderRadius": "5px"
                  }}>
    <img style={{
                      "display": "block",
                      "height": "48px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "width": "48px"
                    }} alt="Interactive" src="https://static.figma.com/uploads/96f13404e92d659b4ce0645e976e0c8b0039fa05"></img>
  </div>
  <div style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
    Interactive
  </div>
</button>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "columnGap": "8px",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "lineHeight": "16px",
                  "rowGap": "8px",
                  "textAlign": "start",
                  "width": "290px",
                  "borderRadius": "5px",
                  "padding": "8px"
                }} type="button">
  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(185, 235, 198)",
                    "display": "flex",
                    "flexShrink": "0",
                    "height": "56px",
                    "justifyContent": "center",
                    "width": "56px",
                    "borderRadius": "5px"
                  }}>
    <img style={{
                      "display": "block",
                      "height": "48px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "width": "48px"
                    }} alt="Libraries" src="https://static.figma.com/uploads/c51212a3c827a5555105b7dae8a2bf8861016a1b"></img>
  </div>
  <div style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
    Libraries
  </div>
</button>
              </div>
            </div>
            <div style={{
              "backgroundColor": "rgb(245, 245, 245)",
              "borderRightColor": "rgb(230, 230, 230)",
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
                "borderBottomColor": "rgba(0, 0, 0, 0.1)",
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
                  "backgroundColor": "rgb(255, 255, 255)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
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
                  "border": "1px solid rgba(0, 0, 0, 0.1)",
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
                      "fill": "rgba(0, 0, 0, 0.898)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
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
                    "backgroundColor": "rgb(245, 245, 245)",
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
                      "color": "rgba(0, 0, 0, 0.898)",
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
                        "backgroundColor": "rgb(245, 245, 245)",
                        "color": "rgb(0, 0, 0)",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "28px",
                        "lineHeight": "16px",
                        "outlineColor": "rgb(0, 123, 229)",
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
                              "backgroundColor": "rgb(242, 249, 255)",
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

export function MediaSidebar({ style, className }: AirDesignComponentProps) {
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
}} role="region" aria-label="Left sidebar" className={className}>
  <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "borderRightColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
          <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
          <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        </svg>
      </button>
      <div style={{
        "borderBottomColor": "rgb(230, 230, 230)",
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
        "color": "rgb(0, 0, 0)",
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-expanded="false" aria-label="Agents" type="button">
        <div style={{
          "alignItems": "center",
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
                  "fill": "rgba(0, 0, 0, 0.898)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M10.39 6.057c.599-1.407 2.624-1.407 3.222 0l.056.146L14.7 9.302l3.1 1.034c1.6.534 1.6 2.799 0 3.333L14.7 14.7l-1.032 3.1-.055.145c-.618 1.454-2.76 1.406-3.278-.145l-1.034-3.1-3.099-1.032c-1.551-.517-1.6-2.66-.145-3.279l.145-.054 3.099-1.034 1.034-3.1zm2.3.387c-.256-.59-1.123-.59-1.378 0l-.034.087-1.029 3.087-.158.474-.474.158-3.098 1.034c-.69.23-.69 1.206 0 1.435l3.098 1.033.474.158.158.475 1.034 3.1.052.12c.298.566 1.168.526 1.384-.12l1.032-3.1.158-.475.475-.158 3.1-1.033.12-.05c.566-.298.526-1.17-.12-1.385l-3.1-1.034-.475-.158-.158-.475-1.032-3.099h-.001z" clipRule="evenodd"></path>
              </svg>
            </div>
          </span>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-expanded="true" aria-label="Inserts" type="button">
        <div style={{
          "alignItems": "center",
          "backgroundColor": "rgb(255, 223, 204)",
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
              "fill": "rgb(226, 76, 12)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0m1 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-6.5-2.5a.5.5 0 0 0-1 0v2h-2a.5.5 0 0 0 0 1h2v2a.5.5 0 0 0 1 0v-2h2a.5.5 0 0 0 0-1h-2z" clipRule="evenodd"></path>
          </svg>
        </div>
        <span style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
            "backgroundColor": "rgb(255, 255, 255)",
            "borderRightColor": "rgba(0, 0, 0, 0.1)",
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
              "borderBottomColor": "rgb(230, 230, 230)",
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
                          "color": "rgba(0, 0, 0, 0.898)",
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
                          "color": "rgba(0, 0, 0, 0.898)",
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
                              "color": "rgb(0, 0, 0)",
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
                                    "fill": "rgba(0, 0, 0, 0.898)"
                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
                  "color": "rgb(0, 0, 0)",
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
                }} aria-label="Slide view" type="button">
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
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
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
                    "color": "rgba(0, 0, 0, 0.5)",
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
                  }} aria-label="Drafts" href="https://www.figma.com/files/team/1505619433971646255/project/386051928" rel="noopener" target="_blank">
  <span style={{
                      "whiteSpace": "nowrap"
                    }}>Drafts</span>
</a>
                </span>
              </div>
            </div>
            <div style={{
              "alignItems": "center",
              "backgroundColor": "rgb(255, 255, 255)",
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
              "padding": "12px 12px 12px 8px"
            }}>
              <div style={{
                "alignItems": "center",
                "columnGap": "4px",
                "display": "flex",
                "minHeight": "24px",
                "rowGap": "4px",
                "minWidth": "0px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "color": "rgb(0, 0, 0)",
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
                }} aria-label="Back" type="button">
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
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M13.854 7.146a.5.5 0 0 1 0 .708L9.707 12l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
  </svg>
</span>
                </button>
                <div style={{
                  "display": "flex",
                  "flexDirection": "column",
                  "minWidth": "0px"
                }}>
                  <h2 style={{
                    "color": "rgba(0, 0, 0, 0.898)",
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
                    }}>Media</span>
</h2>
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
              }}></div>
            </div>
            <div style={{
              "alignItems": "center",
              "borderBottomColor": "rgb(230, 230, 230)",
              "borderBottomStyle": "solid",
              "borderBottomWidth": "1px",
              "boxSizing": "content-box",
              "columnGap": "4px",
              "display": "flex",
              "rowGap": "4px",
              "minWidth": "0px"
            }}>
              <div style={{
                "width": "274px",
                "margin": "4px 16px 12px 16px"
              }}>
                <div style={{
                  "width": "274px"
                }} role="presentation">
                  <div style={{
                    "alignItems": "center",
                    "columnGap": "12px",
                    "display": "flex",
                    "marginBottom": "4px",
                    "rowGap": "12px"
                  }}>
  <div style={{
                      "alignItems": "center",
                      "backgroundColor": "rgb(245, 245, 245)",
                      "boxSizing": "border-box",
                      "display": "flex",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "274px",
                      "border": "1px solid rgba(0, 0, 0, 0)",
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
                          "fill": "rgba(0, 0, 0, 0.5)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.5 6a5.5 5.5 0 0 1 4.226 9.019l2.127 2.127a.5.5 0 1 1-.707.707l-2.127-2.127A5.5 5.5 0 1 1 11.5 6m0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"></path>
    </svg>
    <input style={{
                        "appearance": "auto",
                        "backgroundColor": "rgb(245, 245, 245)",
                        "color": "rgba(0, 0, 0, 0.898)",
                        "display": "block",
                        "flexGrow": "1",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "11px",
                        "fontWeight": "450",
                        "letterSpacing": "0.05504px",
                        "lineHeight": "16px",
                        "overflowX": "clip",
                        "overflowY": "clip",
                        "unicodeBidi": "isolate",
                        "padding": "0px"
                      }} aria-label="Search stock photos" placeholder="Search images" type="text" value=""></input>
  </div>
</div>
                </div>
              </div>
            </div>
            <div style={{
              "display": "flex",
              "flexBasis": "0%",
              "flexDirection": "column",
              "flexGrow": "1",
              "minHeight": "0px"
            }}>
              <div style={{
                "display": "flex",
                "flexDirection": "column",
                "height": "765px"
              }}>
                <div style={{
                  "display": "flex",
                  "flexBasis": "0%",
                  "flexDirection": "column",
                  "flexGrow": "1",
                  "overflowX": "auto",
                  "overflowY": "hidden"
                }}>
                  <div style={{
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "position": "relative"
                  }}>
  <div style={{
                      "alignItems": "flex-start",
                      "display": "flex",
                      "height": "676px",
                      "overflowX": "hidden",
                      "overflowY": "scroll",
                      "scrollbarWidth": "none",
                      "width": "306px"
                    }}>
    <div style={{
                        "height": "676px",
                        "width": "306px"
                      }}>
      <div>
        <div style={{
                            "boxSizing": "content-box",
                            "display": "flex",
                            "flexDirection": "column",
                            "padding": "12px 16px"
                          }}>
          <div style={{
                              "alignItems": "flex-start",
                              "boxSizing": "content-box",
                              "display": "flex",
                              "paddingBottom": "4px",
                              "borderRadius": "5px"
                            }}>
            <h2 style={{
                                "boxSizing": "content-box",
                                "color": "rgba(0, 0, 0, 0.5)",
                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                "fontSize": "11px",
                                "fontWeight": "550",
                                "letterSpacing": "0.05504px",
                                "lineHeight": "16px",
                                "marginBottom": "0px",
                                "marginTop": "0px",
                                "paddingBottom": "4px"
                              }}>
              Unsplash
            </h2>
          </div>
          <div style={{
                              "boxSizing": "content-box",
                              "columnGap": "8px",
                              "display": "grid",
                              "gridTemplateColumns": "133px 133px",
                              "gridTemplateRows": "1999.81px",
                              "maxWidth": "100%",
                              "paddingTop": "4px",
                              "rowGap": "8px"
                            }}>
            <div style={{
                                "columnGap": "8px",
                                "display": "flex",
                                "flexDirection": "column",
                                "rowGap": "8px"
                              }}>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
                  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A woman in a white patterned dress standing against a stone wall covered in ivy" src="https://images.unsplash.com/photo-1793291275774-23ae799f2ac8?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyfHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
                  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A woman in a white patterned dress standing against a stone wall covered in ivy" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
                                  "aspectRatio": "0.665344 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
                  <img style={{
                                      "display": "block",
                                      "height": "200.164px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" src="https://images.unsplash.com/photo-1793463986813-7e1b6370ca4a?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw0fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
                  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
                                  "aspectRatio": "1.77753 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
                  <img style={{
                                      "display": "block",
                                      "height": "75.1406px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A short-eared owl in flight over a field of dry golden grass" src="https://images.unsplash.com/photo-1793449162784-fa77abd22ef2?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw3fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
                  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A short-eared owl in flight over a field of dry golden grass" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
                                  "aspectRatio": "0.670279 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
                  <img style={{
                                      "display": "block",
                                      "height": "198.164px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A sharp triangular patch of sunlight on a tiled floor and textured wall" src="https://images.unsplash.com/photo-1793531110179-6af052479cc5?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw5fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
                  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A sharp triangular patch of sunlight on a tiled floor and textured wall" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
                  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" src="https://images.unsplash.com/photo-1793559141324-6e65850719b0?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.49978 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" src="https://images.unsplash.com/photo-1792980205896-4bc34b91b040?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A smooth white stone on a textured rock beside a dropper bottle and dried lavender" src="https://images.unsplash.com/photo-1793100123531-4924ea242f5f?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A smooth white stone on a textured rock beside a dropper bottle and dried lavender" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.49978 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A wooden dining table with chairs and a bowl of apples in a sunlit room" src="https://images.unsplash.com/photo-1793143765092-dd507da9bffe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxOHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A wooden dining table with chairs and a bowl of apples in a sunlit room" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.6668 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A person petting a happy corgi with its mouth open in front of white flowers" src="https://images.unsplash.com/photo-1793243894460-cc1ad3446e33?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A person petting a happy corgi with its mouth open in front of white flowers" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.49978 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A sunlit living room with a grey sofa, a television on a tripod, and large windows" src="https://images.unsplash.com/photo-1793362584700-57e1bb2d8bbe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A sunlit living room with a grey sofa, a television on a tripod, and large windows" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.5 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" src="https://images.unsplash.com/photo-1793296268316-4279a8f9bbc9?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.75 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "177.555px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A stack of dark ribbed steel rebar rods viewed from the end" src="https://images.unsplash.com/photo-1793280251985-79ebf452b285?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A stack of dark ribbed steel rebar rods viewed from the end" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.33221 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "99.75px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A large ocean wave breaking with sea spray in the warm golden hour light" src="https://images.unsplash.com/photo-1793296640109-4f7e6e99fa58?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyOXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A large ocean wave breaking with sea spray in the warm golden hour light" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
            </div>
            <div style={{
                                "columnGap": "8px",
                                "display": "flex",
                                "flexDirection": "column",
                                "rowGap": "8px"
                              }}>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Evergreen trees against a steep rocky mountainside shrouded in thick grey mist" src="https://images.unsplash.com/photo-1793296225976-dd92eeb74bab?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwzfHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Evergreen trees against a steep rocky mountainside shrouded in thick grey mist" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Green palm fronds silhouetted against a bright sky with soft white clouds" src="https://images.unsplash.com/photo-1793457984081-2fa841fac172?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw1fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Green palm fronds silhouetted against a bright sky with soft white clouds" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Blurred clouds in shades of brown and grey with a hint of blue light" src="https://images.unsplash.com/photo-1793531381574-242097e252f7?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw2fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Blurred clouds in shades of brown and grey with a hint of blue light" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.50846 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Low sun over a misty green field with distant trees under a pale sky" src="https://images.unsplash.com/photo-1793531376973-07525fe23962?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Low sun over a misty green field with distant trees under a pale sky" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666738 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A bluethroat bird with a bright blue throat patch singing among tall green reeds" src="https://images.unsplash.com/photo-1793451551758-dc59e0b817b7?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A bluethroat bird with a bright blue throat patch singing among tall green reeds" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.677439 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "196.172px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A baby in a plastic seat resting feet on an adult lying on a sandy beach" src="https://images.unsplash.com/photo-1793004196263-c41e5e44fabc?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxNXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A baby in a plastic seat resting feet on an adult lying on a sandy beach" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.5 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A woman in a white headscarf and t-shirt watching colorful koi fish in a pond" src="https://images.unsplash.com/photo-1793067321405-31bad6764f8d?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxN3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A woman in a white headscarf and t-shirt watching colorful koi fish in a pond" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666611 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="Two people using smartphones in front of a blue and white tiled wall in Porto" src="https://images.unsplash.com/photo-1793363605725-f4dc80e33a34?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxOXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for Two people using smartphones in front of a blue and white tiled wall in Porto" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.666667 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "199.5px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A gold necklace, ring, and stud earrings with diamond accents on a white fabric background" src="https://images.unsplash.com/photo-1793054733110-b22c822e97b6?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A gold necklace, ring, and stud earrings with diamond accents on a white fabric background" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "0.75 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "177.555px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="A 3D render of a modern bedroom with wooden wall panels and a grey bed" src="https://images.unsplash.com/photo-1793378854126-658c2399d99a?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for A 3D render of a modern bedroom with wooden wall panels and a grey bed" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
                                  "aspectRatio": "1.501 / 1",
                                  "display": "flex",
                                  "flexDirection": "column",
                                  "position": "relative"
                                }}>
                <button style={{
                                    "alignItems": "center",
                                    "appearance": "auto",
                                    "backgroundColor": "rgba(0, 0, 0, 0)",
                                    "color": "rgb(0, 0, 0)",
                                    "display": "flex",
                                    "fontFamily": "Inter, sans-serif",
                                    "fontSize": "11px",
                                    "fontWeight": "400",
                                    "justifyItems": "center",
                                    "lineHeight": "16px",
                                    "outlineColor": "rgba(0, 0, 0, 0.1)",
                                    "outlineOffset": "-1px",
                                    "outlineStyle": "solid",
                                    "outlineWidth": "1px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textAlign": "start",
                                    "borderRadius": "5px",
                                    "padding": "0px"
                                  }} type="button">
  <img style={{
                                      "display": "block",
                                      "height": "88.4375px",
                                      "overflowX": "clip",
                                      "overflowY": "clip",
                                      "width": "133px"
                                    }} alt="An aerial view of a person in a conical hat walking among many large ceramic fermentation jars" src="https://images.unsplash.com/photo-1793311163171-a4c1632703d3?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyN3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "height": "24px",
                                    "justifyContent": "center",
                                    "opacity": "0",
                                    "position": "absolute",
                                    "right": "4px",
                                    "top": "4px",
                                    "width": "24px",
                                    "zIndex": "1",
                                    "minWidth": "0px",
                                    "minHeight": "0px",
                                    "borderRadius": "5px"
                                  }}>
  <button style={{
                                      "alignItems": "center",
                                      "appearance": "auto",
                                      "backgroundColor": "rgba(0, 0, 0, 0)",
                                      "color": "rgb(0, 0, 0)",
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
                                    }} aria-label="More details for An aerial view of a person in a conical hat walking among many large ceramic fermentation jars" type="button">
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
                                            "fill": "rgba(0, 0, 0, 0.898)"
                                          }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
            </div>
          </div>
          <div></div>
        </div>
      </div>
    </div>
  </div>
  <div style={{
                      "bottom": "0px",
                      "boxSizing": "content-box",
                      "marginBottom": "2px",
                      "position": "absolute",
                      "right": "0px",
                      "top": "0px",
                      "width": "6px",
                      "zIndex": "7",
                      "padding": "2px"
                    }}></div>
</div>
                </div>
                <div style={{
                  "backgroundColor": "rgb(255, 255, 255)",
                  "borderTopColor": "rgb(230, 230, 230)",
                  "borderTopStyle": "solid",
                  "borderTopWidth": "1px",
                  "boxSizing": "content-box",
                  "display": "flex",
                  "flexDirection": "column",
                  "padding": "12px 16px"
                }}>
                  <div style={{
                    "boxSizing": "content-box",
                    "display": "flex",
                    "flexDirection": "column",
                    "paddingBottom": "4px",
                    "paddingTop": "4px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "rgba(0, 0, 0, 0.898)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "height": "24px",
                      "justifyItems": "center",
                      "letterSpacing": "0.05504px",
                      "lineHeight": "16px",
                      "maxWidth": "100%",
                      "outlineColor": "rgba(0, 0, 0, 0.1)",
                      "outlineOffset": "-1px",
                      "outlineStyle": "solid",
                      "outlineWidth": "1px",
                      "position": "relative",
                      "textAlign": "center",
                      "width": "274px",
                      "borderRadius": "5px",
                      "padding": "0px"
                    }} aria-label="Make an image" type="button">
    <span style={{
                        "display": "flex",
                        "height": "24px",
                        "maxWidth": "100%",
                        "width": "274px"
                      }}>
      <span style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "justifyContent": "center",
                          "maxWidth": "100%",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "8px",
                          "paddingRight": "8px",
                          "width": "274px"
                        }}>
        <span style={{
                            "alignItems": "center",
                            "display": "flex",
                            "height": "24px",
                            "marginLeft": "-8px",
                            "marginRight": "4px"
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
                              }} fill="var(--fpl-icon-color, var(--color-icon))" d="M13.5 5.999a.5.5 0 0 1 0 1h-6a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5zm-3.275 5.082a.5.5 0 0 1 .629.065l4 4a.5.5 0 0 1-.707.706L10.5 12.206l-1.646 1.646a.5.5 0 1 1-.708-.707l2-2zm6.79-6.642c.126-.505.844-.505.97 0L18.3 5.7l1.26.315c.505.126.505.844 0 .97L18.3 7.3l-.315 1.26c-.126.505-.844.505-.97 0L16.7 7.3l-1.26-.315c-.505-.126-.505-.844 0-.97L16.7 5.7z"></path>
          </svg>
        </span>
        <span style={{
                            "display": "block",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "textOverflow": "ellipsis",
                            "whiteSpace": "nowrap"
                          }}>
          <span style={{
                              "display": "contents"
                            }}>
            <span style={{
                                "whiteSpace": "nowrap"
                              }}>Make an image</span>
          </span>
        </span>
      </span>
    </span>
  </button>
</div>
                  <div style={{
                    "boxSizing": "content-box",
                    "display": "flex",
                    "flexDirection": "column",
                    "paddingBottom": "4px",
                    "paddingTop": "4px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "rgba(0, 0, 0, 0.898)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "11px",
                      "fontWeight": "450",
                      "height": "24px",
                      "justifyItems": "center",
                      "letterSpacing": "0.05504px",
                      "lineHeight": "16px",
                      "maxWidth": "100%",
                      "outlineColor": "rgba(0, 0, 0, 0.1)",
                      "outlineOffset": "-1px",
                      "outlineStyle": "solid",
                      "outlineWidth": "1px",
                      "position": "relative",
                      "textAlign": "center",
                      "width": "274px",
                      "borderRadius": "5px",
                      "padding": "0px"
                    }} aria-label="Upload image or video" type="button">
    <span style={{
                        "display": "flex",
                        "height": "24px",
                        "maxWidth": "100%",
                        "width": "274px"
                      }}>
      <span style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "justifyContent": "center",
                          "maxWidth": "100%",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "8px",
                          "paddingRight": "8px",
                          "width": "274px"
                        }}>
        <span style={{
                            "alignItems": "center",
                            "display": "flex",
                            "height": "24px",
                            "marginLeft": "-8px",
                            "marginRight": "4px"
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
                              }} fill="var(--fpl-icon-color, var(--color-icon))" d="M17.5 13a.5.5 0 0 1 .5.5v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-3a.5.5 0 0 1 1 0v3a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 .5-.5m-5.775-7.918a.5.5 0 0 1 .629.064l3.5 3.5a.5.5 0 0 1-.707.708L12.5 6.707V12.5a.5.5 0 0 1-1 0V6.707L8.854 9.354a.5.5 0 1 1-.708-.708l3.5-3.5z"></path>
          </svg>
        </span>
        <span style={{
                            "display": "block",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "textOverflow": "ellipsis",
                            "whiteSpace": "nowrap"
                          }}>
          <span style={{
                              "whiteSpace": "nowrap"
                            }}>Upload image or video</span>
        </span>
      </span>
    </span>
  </button>
</div>
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

export function PresenterNotes({ style, className }: AirDesignComponentProps) {
  return (<div style={{
  "alignItems": "center",
  "display": "flex",
  "flexDirection": "column",
  position: "relative",
  fontFamily: "Inter, sans-serif",
  fontSize: 11,
  lineHeight: "16px",
  boxSizing: "border-box",
  flexShrink: 0,
  width: 932,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  ...style
}} className={className}>
    <div style={{
    "boxSizing": "content-box",
    "display": "flex",
    "justifyContent": "center",
    "width": "64px",
    "padding": "13px"
  }}>
      <div style={{
      "backgroundColor": "rgba(179, 179, 179, 0.5)",
      "flexShrink": "0",
      "height": "4px",
      "position": "relative",
      "width": "64px",
      "borderRadius": "16px"
    }}>
        <div style={{
        "height": "4px",
        "left": "0px",
        "position": "absolute",
        "top": "0px",
        "width": "64px"
      }} role="separator" aria-orientation="horizontal" aria-valuenow={24} aria-valuetext="24% of maximum size" aria-label="Resize presenter notes">
          <div style={{
          "backgroundColor": "rgba(179, 179, 179, 0.5)",
          "boxSizing": "content-box",
          "left": "32px",
          "opacity": "0",
          "position": "absolute",
          "top": "2px",
          "transform": "matrix(0, 0, 0, 0, -65.0703, -10)",
          "transformOrigin": "65.0703px 10px",
          "borderRadius": "16px",
          "padding": "2px 8px"
        }}>
            <p style={{
            "color": "rgba(0, 0, 0, 0.898)",
            "fontFamily": "Inter, sans-serif",
            "fontSize": "11px",
            "fontWeight": "400",
            "lineHeight": "16px",
            "marginBottom": "0px",
            "marginTop": "0px",
            "whiteSpace": "nowrap"
          }}>
              <span style={{
              "whiteSpace": "nowrap"
            }}>Show presenter notes</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <div style={{
    "boxSizing": "border-box",
    "height": "96px",
    "paddingLeft": "32px",
    "paddingRight": "32px",
    "position": "relative",
    "width": "932px"
  }}>
      <div style={{
      "height": "96px",
      "isolation": "isolate",
      "position": "relative"
    }}>
        <div style={{
        "backgroundColor": "rgb(230, 230, 230)",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "13px",
        "height": "96px",
        "letterSpacing": "-0.003px",
        "lineHeight": "17px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative",
        "borderRadius": "8px"
      }}>
          <div style={{
          "alignItems": "flex-start",
          "display": "flex",
          "height": "96px",
          "overflowX": "hidden",
          "overflowY": "scroll",
          "scrollbarWidth": "none",
          "width": "868px"
        }}>
            <div style={{
            "height": "96px",
            "width": "868px"
          }}>
              <div style={{
              "height": "96px"
            }}>
                <div style={{
                "boxSizing": "border-box",
                "height": "96px",
                "padding": "20px"
              }}>
                  <div style={{
                  "height": "56px",
                  "isolation": "isolate"
                }}>
                    <section style={{
                    "height": "56px"
                  }} aria-label="Presenter Notes">
                      <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                      "fontSize": "13px",
                      "fontWeight": "400",
                      "height": "96px",
                      "justifyItems": "center",
                      "left": "0px",
                      "lineHeight": "17px",
                      "opacity": "0",
                      "position": "absolute",
                      "textAlign": "start",
                      "top": "0px",
                      "width": "868px",
                      "zIndex": "-1",
                      "padding": "0px"
                    }} type="button">
                        Press Enter to edit presenter notes
                      </button>
                      <div style={{
                      "height": "56px",
                      "overflowWrap": "break-word",
                      "position": "relative",
                      "wordBreak": "break-word",
                      "zIndex": "1",
                      "whiteSpace": "pre-wrap"
                    }} role="textbox" aria-placeholder="Add presenter notes…">
                        <p style={{
                        "color": "rgba(0, 0, 0, 0.898)",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "13px",
                        "fontWeight": "400",
                        "lineHeight": "17px",
                        "marginBottom": "0px",
                        "marginTop": "0px"
                      }}>
                          

                        </p>
                      </div>
                      <div aria-hidden="true"></div>
                    </section>
                    <div style={{
                    "boxSizing": "content-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "left": "0px",
                    "position": "absolute",
                    "right": "0px",
                    "top": "0px",
                    "padding": "20px"
                  }}>
                      <div style={{
                      "clipPath": "inset(50%)",
                      "height": "1px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "position": "absolute",
                      "width": "1px",
                      "whiteSpace": "nowrap",
                      "margin": "-1px"
                    }}>
                        <div aria-relevant="all" role="status"></div>
                      </div>
                      <div style={{
                      "alignItems": "flex-start",
                      "columnGap": "8px",
                      "display": "flex",
                      "marginBottom": "8px",
                      "position": "relative"
                    }}>
                        <span style={{
                        "display": "block",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "textOverflow": "ellipsis",
                        "minWidth": "0px",
                        "whiteSpace": "nowrap"
                      }}>
                          <span style={{
                          "whiteSpace": "nowrap"
                        }}>Add presenter notes…</span>
                        </span>
                        <div style={{
                        "alignItems": "center",
                        "display": "flex",
                        "flexShrink": "0",
                        "marginLeft": "auto",
                        "marginTop": "-4px",
                        "position": "relative",
                        "zIndex": "2"
                      }}>
                          <button style={{
                          "alignItems": "center",
                          "appearance": "auto",
                          "backgroundColor": "rgba(0, 0, 0, 0)",
                          "boxSizing": "border-box",
                          "color": "rgba(0, 0, 0, 0.3)",
                          "display": "flex",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "13px",
                          "fontWeight": "400",
                          "justifyItems": "center",
                          "lineHeight": "17px",
                          "textAlign": "start",
                          "border": "1px solid rgba(0, 0, 0, 0.1)",
                          "borderRadius": "5px",
                          "padding": "0px 36px 0px 4px"
                        }} aria-label="Start with an AI draft" type="button">
                            <svg style={{
                            "display": "block",
                            "height": "24px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "24px"
                          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path style={{
                              "fill": "rgba(0, 0, 0, 0.3)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.5 7.001a.5.5 0 0 1 0 1H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4.5a.5.5 0 1 1 1 0v4.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm-1 6a.5.5 0 1 1 0 1h-5a.5.5 0 0 1 0-1zm2-3a.5.5 0 1 1 0 1h-7a.5.5 0 0 1 0-1zm2.515-4.56c.126-.505.844-.505.97 0l.315 1.26 1.26.315c.505.126.505.844 0 .97l-1.26.315-.315 1.26c-.126.505-.844.505-.97 0L17.7 8.3l-1.26-.315c-.505-.126-.505-.844 0-.97L17.7 6.7z"></path>
                            </svg>
                            Start with a draft
                          </button>
                          <div style={{
                          "alignItems": "center",
                          "display": "flex",
                          "position": "absolute",
                          "right": "8px",
                          "top": "13px",
                          "transform": "matrix(1, 0, 0, 1, 0, -9)",
                          "transformOrigin": "10.1719px 9px",
                          "minWidth": "0px",
                          "minHeight": "0px"
                        }}>
                            <a style={{
                            "alignItems": "center",
                            "color": "rgb(0, 0, 238)",
                            "display": "flex",
                            "flexShrink": "0",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontSize": "13px",
                            "fontWeight": "400",
                            "lineHeight": "17px",
                            "borderRadius": "5px"
                          }} aria-label="AI, Learn more" href="https://help.figma.com/hc/articles/24245848829847#h_01JBF670XY6WGXKE8F76112N9W" rel="noopener" target="_blank">
                              <div style={{
                              "alignItems": "center",
                              "boxSizing": "content-box",
                              "color": "rgba(0, 0, 0, 0.3)",
                              "columnGap": "4px",
                              "display": "flex",
                              "fontSize": "11px",
                              "height": "16px",
                              "justifyContent": "center",
                              "paddingLeft": "4px",
                              "paddingRight": "4px",
                              "rowGap": "4px",
                              "border": "1px solid rgba(0, 0, 0, 0.1)",
                              "borderRadius": "5px"
                            }}>
                                AI
                              </div>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>);
}

export function SlidePropertiesPanel({ style, className }: AirDesignComponentProps) {
  return (<div style={{
  "height": "842px",
  position: "relative",
  fontFamily: "Inter, sans-serif",
  fontSize: 11,
  lineHeight: "16px",
  boxSizing: "border-box",
  flexShrink: 0,
  width: 240,
  ...style
}} className={className}>
  <div style={{
    "bottom": "0px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "position": "absolute",
    "right": "0px",
    "top": "0px",
    "width": "240px"
  }}>
    <div style={{
      "alignItems": "flex-start",
      "display": "flex",
      "height": "842px",
      "overflowX": "hidden",
      "overflowY": "scroll",
      "scrollbarWidth": "none",
      "width": "240px"
    }}>
      <div style={{
        "height": "842px",
        "minHeight": "799px",
        "width": "240px"
      }}>
        <div>
          <div style={{
            "backgroundColor": "rgb(255, 255, 255)",
            "boxSizing": "border-box",
            "display": "flex",
            "flexDirection": "column",
            "minHeight": "799px",
            "paddingBottom": "50px",
            "position": "relative",
            "width": "240px"
          }}>
            <div style={{
              "borderBottomColor": "rgb(230, 230, 230)",
              "borderBottomStyle": "solid",
              "borderBottomWidth": "1px",
              "boxSizing": "content-box"
            }}>
              <div style={{
                "alignItems": "center",
                "boxSizing": "border-box",
                "columnGap": "8px",
                "display": "flex",
                "height": "48px",
                "justifyContent": "space-between",
                "rowGap": "8px",
                "padding": "4px 8px"
              }}>
                <div style={{
                  "flexGrow": "1",
                  "minWidth": "0px"
                }}>
                  <h1 style={{
                    "boxSizing": "content-box",
                    "color": "rgba(0, 0, 0, 0.898)",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontSize": "13px",
                    "fontWeight": "550",
                    "letterSpacing": "-0.032px",
                    "lineHeight": "22px",
                    "marginBottom": "0px",
                    "marginTop": "0px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "paddingLeft": "8px",
                    "paddingRight": "8px",
                    "textOverflow": "ellipsis",
                    "whiteSpace": "nowrap"
                  }}>
                    <span style={{
                      "whiteSpace": "nowrap"
                    }}>Slide 1</span>
                  </h1>
                </div>
                <div style={{
                  "alignItems": "center",
                  "columnGap": "4px",
                  "display": "flex",
                  "rowGap": "4px"
                }}>
                  <div style={{
                    "display": "contents",
                    "minWidth": "0px",
                    "minHeight": "0px"
                  }}>
                    <span style={{
                      "display": "block"
                    }}>
                      <button style={{
                        "alignItems": "center",
                        "appearance": "auto",
                        "backgroundColor": "rgba(0, 0, 0, 0)",
                        "color": "rgb(0, 0, 0)",
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
                      }} aria-label="Adjust tone" aria-haspopup="dialog" aria-expanded="false" type="button">
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
                              "fill": "rgba(0, 0, 0, 0.898)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18.5 14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V15h-1v3h.5a.5.5 0 0 1 0 1h-2a.5.5 0 1 1 0-1h.5v-3h-1v.5a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zM9.62 5.906c.513-1.205 2.248-1.205 2.762 0l.047.125.884 2.656 2.658.886c1.372.458 1.372 2.399 0 2.857l-2.658.884-.884 2.658c-.458 1.372-2.4 1.372-2.857 0l-.885-2.658-2.657-.884c-1.372-.458-1.372-2.4 0-2.857l2.657-.886.885-2.656zm1.825.352.011.028c-.173-.379-.74-.379-.912 0l.012-.028-.937-.352.92.392.005-.012-.035.097.012-.035-.949-.317.937.352-.874 2.62-.158.475-.474.159-2.656.885a.505.505 0 0 0 0 .96l2.656.884.474.158.158.474.886 2.657a.505.505 0 0 0 .959.001L12.364 13l.159-.475.474-.158 2.657-.885a.505.505 0 0 0 0-.959l-3.131-1.044-1.04-3.12.01.025.936-.352-.95.317.004.01-.027-.072.006.012.92-.392z" clipRule="evenodd"></path>
  </svg>
</span>
                      </button>
                    </span>
                  </div>
                </div>
              </div>
              <div style={{
                "columnGap": "4px",
                "display": "flex",
                "flexDirection": "column",
                "rowGap": "4px"
              }}></div>
            </div>
            <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
              <div style={{
                "borderBottomColor": "rgb(230, 230, 230)",
                "borderBottomStyle": "solid",
                "borderBottomWidth": "1px",
                "boxSizing": "content-box",
                "paddingBottom": "12px"
              }}>
                <div style={{
                  "alignContent": "center",
                  "alignSelf": "center",
                  "boxSizing": "content-box",
                  "columnGap": "8px",
                  "display": "grid",
                  "fontWeight": "550",
                  "gridTemplateAreas": "\"left right\"",
                  "gridTemplateColumns": "108px 108px",
                  "gridTemplateRows": "40px",
                  "height": "40px",
                  "letterSpacing": "1%",
                  "paddingRight": "16px"
                }}>
                  <div style={{
                    "alignSelf": "center",
                    "display": "flex",
                    "gridColumnEnd": "left",
                    "gridColumnStart": "left",
                    "gridRowEnd": "left",
                    "gridRowStart": "left",
                    "minWidth": "0px"
                  }}>
                    <div style={{
                      "alignSelf": "center",
                      "height": "16px",
                      "opacity": "0",
                      "width": "16px"
                    }} aria-hidden="true">
                      <svg style={{
                        "display": "block",
                        "height": "16px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "width": "16px"
                      }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                        <path style={{
                          "fill": "rgba(0, 0, 0, 0.5)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
                      </svg>
                    </div>
                    <h2 style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "550",
                      "lineHeight": "16px",
                      "marginBottom": "0px",
                      "marginTop": "0px"
                    }}>
                      <span style={{
                        "display": "contents"
                      }}>
                        Template style
                      </span>
                    </h2>
                  </div>
                  <div style={{
                    "alignSelf": "center",
                    "gridColumnEnd": "right",
                    "gridColumnStart": "right",
                    "gridRowEnd": "right",
                    "gridRowStart": "right",
                    "minWidth": "0px"
                  }}>
                    <div style={{
                      "display": "flex",
                      "height": "24px",
                      "justifyContent": "flex-end",
                      "width": "108px"
                    }}>
                      <button style={{
                        "alignItems": "center",
                        "appearance": "auto",
                        "backgroundColor": "rgba(0, 0, 0, 0)",
                        "color": "rgb(0, 0, 0)",
                        "display": "grid",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "550",
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
                      }} aria-label="Edit template style" type="button">
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
                              "fill": "rgba(0, 0, 0, 0.898)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M8.5 18a.5.5 0 0 0 .5-.5v-1.55a2.5 2.5 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v4.55a2.501 2.501 0 0 0 0 4.9v1.55a.5.5 0 0 0 .5.5m7 0a.5.5 0 0 0 .5-.5v-4.55a2.501 2.501 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v1.55a2.5 2.5 0 0 0 0 4.9v4.55a.5.5 0 0 0 .5.5m0-6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-7 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"></path>
  </svg>
</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{
                  "boxSizing": "content-box",
                  "display": "grid",
                  "gridTemplateColumns": "208px",
                  "gridTemplateRows": "48px",
                  "paddingLeft": "16px",
                  "paddingRight": "16px"
                }}>
                  <div style={{
                    "position": "relative"
                  }}>
                    <div style={{
                      "display": "contents"
                    }} role="presentation">
                      <button style={{
                        "appearance": "auto",
                        "backgroundColor": "rgb(255, 255, 255)",
                        "boxSizing": "border-box",
                        "color": "rgb(0, 0, 0)",
                        "display": "flex",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "height": "48px",
                        "lineHeight": "16px",
                        "textAlign": "left",
                        "width": "208px",
                        "border": "1px solid rgb(230, 230, 230)",
                        "borderRadius": "5px",
                        "padding": "0px"
                      }} type="button" aria-disabled="true" aria-haspopup="listbox" aria-expanded="false" role="combobox" aria-label="Style: Light slides, Fonts: Inter">
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
                                  "border": "1px solid rgba(0, 0, 0, 0.1)",
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
                                    "backgroundColor": "rgb(61, 56, 245)",
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
                              "color": "rgba(0, 0, 0, 0.898)",
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
                                      "color": "rgba(0, 0, 0, 0.898)",
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
</button>
                    </div>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "32px",
                      "justifyContent": "center",
                      "justifyItems": "center",
                      "left": "7px",
                      "lineHeight": "16px",
                      "opacity": "0",
                      "position": "absolute",
                      "textAlign": "start",
                      "top": "7px",
                      "width": "32px",
                      "padding": "0px"
                    }} aria-label="Remix template colors" type="button">
                      <svg style={{
                        "display": "block",
                        "height": "24px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "width": "24px"
                      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                          "fill": "rgba(255, 255, 255, 0.898)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.453 10.155a.5.5 0 0 0 .753.659l1.573-1.797a1.5 1.5 0 0 1 1.129-.512h1.36c.008 0 .013.01.007.016l-1.129 1.13a.501.501 0 0 0 .708.706l2-2a.5.5 0 0 0 0-.707l-1.999-2a.501.501 0 0 0-.709.707l1.13 1.13c.006.007.001.018-.008.018h-1.361a2.5 2.5 0 0 0-1.881.853zM5 8.003a.5.5 0 0 0 .5.5h1.59c.433 0 .844.187 1.13.513l5.804 6.633a2.5 2.5 0 0 0 1.88.854h1.386l-1.146 1.147a.5.5 0 0 0 0 .707.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0 0-.707l-2-2a.5.5 0 0 0-.708 0 .5.5 0 0 0 0 .707l1.146 1.146h-1.384c-.432 0-.845-.187-1.13-.512L8.974 8.356a2.5 2.5 0 0 0-1.882-.853H5.5a.5.5 0 0 0-.5.5m0 8.002a.5.5 0 0 0 .5.5h1.592a2.5 2.5 0 0 0 1.882-.854l1.574-1.8a.5.5 0 0 0-.753-.659l-1.574 1.8a1.5 1.5 0 0 1-1.129.513H5.5a.5.5 0 0 0-.5.5"></path>
</svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
              <div style={{
                "borderBottomColor": "rgb(230, 230, 230)",
                "borderBottomStyle": "solid",
                "borderBottomWidth": "1px",
                "boxSizing": "content-box",
                "paddingBottom": "8px",
                "paddingRight": "8px"
              }}>
                <div style={{
                  "alignContent": "center",
                  "alignSelf": "center",
                  "boxSizing": "content-box",
                  "columnGap": "8px",
                  "display": "grid",
                  "fontWeight": "550",
                  "gridTemplateAreas": "\"label1 label1\" \"input1 icon\"",
                  "gridTemplateColumns": "176px 24px",
                  "gridTemplateRows": "0px 40px",
                  "height": "40px",
                  "letterSpacing": "1%",
                  "paddingLeft": "16px",
                  "paddingRight": "8px"
                }}>
                  <div style={{
                    "alignSelf": "center",
                    "gridColumnEnd": "input1",
                    "gridColumnStart": "input1",
                    "gridRowEnd": "input1",
                    "gridRowStart": "input1",
                    "minWidth": "0px"
                  }}>
                    <h2 style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "550",
                      "lineHeight": "16px",
                      "marginBottom": "0px",
                      "marginTop": "0px"
                    }}>
                      <span style={{
                        "display": "contents"
                      }}>
  Background
</span>
                    </h2>
                  </div>
                  <div style={{
                    "alignItems": "center",
                    "alignSelf": "start",
                    "display": "flex",
                    "gridColumnEnd": "icon",
                    "gridColumnStart": "icon",
                    "gridRowEnd": "icon",
                    "gridRowStart": "icon",
                    "height": "32px",
                    "minWidth": "0px"
                  }}>
                    <div style={{
                      "alignItems": "center",
                      "alignSelf": "start",
                      "display": "flex",
                      "height": "40px"
                    }}></div>
                  </div>
                </div>
                <div style={{
                  "boxSizing": "content-box",
                  "padding": "4px 8px 4px 16px"
                }}>
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
                        "display": "contents"
                      }}>
  <span style={{
                          "whiteSpace": "nowrap"
                        }}>Background</span>
</span>
                    </legend>
                    <div style={{
                      "backgroundColor": "rgb(245, 245, 245)",
                      "display": "flex",
                      "width": "208px",
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
                          "width": "69.3281px",
                          "borderRadius": "50%",
                          "padding": "0px"
                        }} type="radio" value="SOLID" checked={true}></input>
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
                              "fill": "rgba(0, 0, 0, 0.3)"
                            }} fill="var(--fpl-icon-color-3, var(--color-icon-tertiary))" d="M9 9h6v6H9z"></path>
      <path style={{
                              "fill": "rgba(0, 0, 0, 0.898)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3 7V9h6v6zM8 8.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5z" clipRule="evenodd"></path>
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
                          }}>Single color</span>
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
                          "width": "69.3359px",
                          "borderRadius": "50%",
                          "padding": "0px"
                        }} type="radio" value="GRADIENT"></input>
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
                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3.75.875a.875.875 0 1 1-1.75 0 .875.875 0 0 1 1.75 0m3.791.625a.625.625 0 1 0 0-1.25.625.625 0 0 0 0 1.25m-1.458.875a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m0 3.12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m1.458 2.245a.625.625 0 1 0 0-1.25.625.625 0 0 0 0 1.25m.625-3.865a.625.625 0 1 1-1.25 0 .625.625 0 0 1 1.25 0M8.875 15.99a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75m.875-4.115a.875.875 0 1 1-1.75 0 .875.875 0 0 1 1.75 0m5.75-1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m.5 2.623a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" clipRule="evenodd"></path>
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
                          }}>Gradient</span>
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
                          "width": "69.3359px",
                          "borderRadius": "50%",
                          "padding": "0px"
                        }} type="radio" value="MEDIA"></input>
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
                            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm2.225 4.082a.5.5 0 0 1 .629.064l4 4a.5.5 0 1 1-.707.707L10.5 12.208l-1.646 1.646a.5.5 0 1 1-.708-.707l2-2zM14.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"></path>
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
                          }}>Image / Video</span>
  </label>
</div>
                    </div>
                  </fieldset>
                </div>
                <div style={{
                  "boxSizing": "content-box",
                  "padding": "4px 8px 4px 16px"
                }}>
                  <span style={{
                    "position": "relative"
                  }}>
                    <div style={{
                      "display": "contents"
                    }}>
                      <div role="presentation">
  <button style={{
                          "alignItems": "center",
                          "appearance": "auto",
                          "backgroundColor": "rgb(255, 255, 255)",
                          "boxSizing": "border-box",
                          "color": "rgba(0, 0, 0, 0.898)",
                          "display": "flex",
                          "fontFamily": "Inter, sans-serif",
                          "fontSize": "11px",
                          "fontWeight": "400",
                          "height": "24px",
                          "justifyContent": "space-between",
                          "justifyItems": "center",
                          "lineHeight": "16px",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "textAlign": "start",
                          "textOverflow": "ellipsis",
                          "width": "208px",
                          "whiteSpace": "nowrap",
                          "border": "1px solid rgb(230, 230, 230)",
                          "borderRadius": "5px",
                          "padding": "0px 4px 0px 0px"
                        }} aria-label="Color picker" aria-expanded="false" type="button">
    <span style={{
                            "display": "flex"
                          }}>
      <span style={{
                              "alignItems": "center",
                              "boxSizing": "content-box",
                              "columnGap": "6px",
                              "display": "flex",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "paddingLeft": "4px",
                              "rowGap": "6px"
                            }}>
        <div style={{
                                "backgroundColor": "rgb(255, 255, 255)",
                                "flexShrink": "0",
                                "height": "14px",
                                "overflowX": "hidden",
                                "overflowY": "hidden",
                                "position": "relative",
                                "width": "14px",
                                "borderRadius": "2px"
                              }} aria-hidden="true">
          <div style={{
                                  "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
                                  "borderBottomRightRadius": "1px",
                                  "borderTopRightRadius": "1px",
                                  "height": "14px",
                                  "opacity": "0",
                                  "position": "absolute",
                                  "right": "0px",
                                  "top": "0px",
                                  "width": "7px"
                                }}></div>
          <div style={{
                                  "bottom": "-7px",
                                  "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 2px inset",
                                  "left": "-7px",
                                  "position": "absolute",
                                  "right": "-7px",
                                  "top": "-7px",
                                  "transform": "matrix(0.5, 0, 0, 0.5, 0, 0)",
                                  "transformOrigin": "14px 14px",
                                  "borderRadius": "20%"
                                }}></div>
        </div>
        <div style={{
                                "display": "flex",
                                "minWidth": "0px"
                              }} aria-label="White">
          <div style={{
                                  "flexShrink": "1000",
                                  "overflowX": "hidden",
                                  "overflowY": "hidden",
                                  "textOverflow": "ellipsis",
                                  "whiteSpace": "pre-wrap"
                                }}>
            <span style={{
                                    "whiteSpace": "pre"
                                  }}>Whit</span>
          </div>
          <div style={{
                                  "flexShrink": "0.5",
                                  "maxWidth": "80%",
                                  "overflowX": "hidden",
                                  "overflowY": "hidden",
                                  "textOverflow": "ellipsis",
                                  "whiteSpace": "pre-wrap"
                                }}>
            <span style={{
                                    "whiteSpace": "pre"
                                  }}>e</span>
          </div>
        </div>
      </span>
    </span>
    <div style={{
                            "flexShrink": "0"
                          }} aria-hidden="true">
      <svg style={{
                              "display": "block",
                              "height": "16px",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "width": "16px"
                            }} width="16" height="16" fill="none" viewBox="0 0 16 16">
        <path style={{
                                "fill": "rgba(0, 0, 0, 0.898)"
                              }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
      </svg>
    </div>
  </button>
</div>
                    </div>
                  </span>
                </div>
              </div>
            </div>
            <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
              <div style={{
                "borderBottomColor": "rgb(230, 230, 230)",
                "borderBottomStyle": "solid",
                "borderBottomWidth": "1px",
                "boxSizing": "content-box",
                "paddingBottom": "12px"
              }}>
                <div style={{
                  "alignContent": "center",
                  "alignSelf": "center",
                  "boxSizing": "content-box",
                  "columnGap": "8px",
                  "display": "grid",
                  "fontWeight": "550",
                  "gridTemplateAreas": "\"left right\"",
                  "gridTemplateColumns": "108px 108px",
                  "gridTemplateRows": "40px",
                  "height": "40px",
                  "letterSpacing": "1%",
                  "paddingRight": "16px"
                }}>
                  <div style={{
                    "alignSelf": "center",
                    "display": "flex",
                    "gridColumnEnd": "left",
                    "gridColumnStart": "left",
                    "gridRowEnd": "left",
                    "gridRowStart": "left",
                    "minWidth": "0px"
                  }}>
                    <div style={{
                      "alignSelf": "center",
                      "height": "16px",
                      "opacity": "0",
                      "width": "16px"
                    }} aria-hidden="true">
                      <svg style={{
                        "display": "block",
                        "height": "16px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "width": "16px"
                      }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
                          "fill": "rgba(0, 0, 0, 0.5)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
</svg>
                    </div>
                    <h2 style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "550",
                      "lineHeight": "16px",
                      "marginBottom": "0px",
                      "marginTop": "0px"
                    }}>
                      <span style={{
                        "display": "contents"
                      }}>
  Selection colors
</span>
                    </h2>
                  </div>
                  <div style={{
                    "alignSelf": "center",
                    "gridColumnEnd": "right",
                    "gridColumnStart": "right",
                    "gridRowEnd": "right",
                    "gridRowStart": "right",
                    "minWidth": "0px"
                  }}></div>
                </div>
                <div>
                  <div style={{
                    "boxSizing": "content-box",
                    "columnGap": "0px",
                    "display": "grid",
                    "gridTemplateAreas": "\"label label label label label\" \"input . icon1 . icon2\"",
                    "gridTemplateColumns": "156px 8px 24px 4px 24px",
                    "gridTemplateRows": "0px 32px",
                    "paddingLeft": "16px",
                    "paddingRight": "8px"
                  }}>
                    <div style={{
                      "alignSelf": "center",
                      "gridColumnEnd": "input",
                      "gridColumnStart": "input",
                      "gridRowEnd": "input",
                      "gridRowStart": "input",
                      "minWidth": "0px"
                    }}>
                      <div style={{
                        "alignItems": "center",
                        "backgroundClip": "padding-box",
                        "columnGap": "4px",
                        "display": "flex",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontWeight": "450",
                        "height": "32px",
                        "letterSpacing": "0.05504px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "rowGap": "4px",
                        "borderRadius": "2px"
                      }}>
  <button style={{
                          "alignItems": "center",
                          "appearance": "auto",
                          "backgroundColor": "rgba(0, 0, 0, 0)",
                          "color": "rgb(0, 0, 0)",
                          "display": "flex",
                          "flexBasis": "0%",
                          "flexGrow": "1",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "11px",
                          "fontWeight": "450",
                          "height": "24px",
                          "justifyItems": "center",
                          "lineHeight": "16px",
                          "outlineColor": "rgb(230, 230, 230)",
                          "outlineOffset": "-1px",
                          "outlineStyle": "solid",
                          "outlineWidth": "1px",
                          "textAlign": "start",
                          "minWidth": "0px",
                          "borderRadius": "5px",
                          "padding": "0px"
                        }} aria-label="Color Variable Black with value #000 at 100%" type="button">
    <div style={{
                            "alignItems": "center",
                            "display": "flex",
                            "height": "14px",
                            "justifyContent": "center",
                            "lineHeight": "14px",
                            "width": "14px",
                            "margin": "4px 4px 4px 5px"
                          }}>
      <div style={{
                              "backgroundColor": "rgb(0, 0, 0)",
                              "flexBasis": "14px",
                              "flexShrink": "0",
                              "height": "14px",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "position": "relative",
                              "width": "14px",
                              "borderRadius": "2px",
                              "margin": "4px"
                            }} aria-hidden="true">
        <div style={{
                                "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
                                "borderBottomRightRadius": "1px",
                                "borderTopRightRadius": "1px",
                                "height": "14px",
                                "opacity": "0",
                                "position": "absolute",
                                "right": "0px",
                                "top": "0px",
                                "width": "7px"
                              }}></div>
      </div>
    </div>
    <div style={{
                            "alignContent": "center",
                            "boxSizing": "content-box",
                            "color": "rgba(0, 0, 0, 0.898)",
                            "height": "24px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "paddingLeft": "1px",
                            "paddingRight": "4px",
                            "textOverflow": "ellipsis",
                            "width": "128px",
                            "whiteSpace": "nowrap"
                          }}>
      <div style={{
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis"
                            }} aria-label="Black">
        <span style={{
                                "whiteSpace": "nowrap"
                              }}>Black</span>
      </div>
    </div>
  </button>
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
                          "whiteSpace": "nowrap",
                          "margin": "-1px"
                        }} aria-hidden="true">
    <span style={{
                            "whiteSpace": "nowrap"
                          }}>Click to edit color variable</span>
  </span>
</div>
                    </div>
                    <div style={{
                      "alignSelf": "center",
                      "gridColumnEnd": "icon1",
                      "gridColumnStart": "icon1",
                      "gridRowEnd": "icon1",
                      "gridRowStart": "icon1",
                      "minWidth": "0px"
                    }}></div>
                    <div style={{
                      "alignSelf": "center",
                      "gridColumnEnd": "icon2",
                      "gridColumnStart": "icon2",
                      "gridRowEnd": "icon2",
                      "gridRowStart": "icon2",
                      "minWidth": "0px"
                    }}></div>
                  </div>
                </div>
                <div>
                  <div style={{
                    "boxSizing": "content-box",
                    "columnGap": "0px",
                    "display": "grid",
                    "gridTemplateAreas": "\"label label label label label\" \"input . icon1 . icon2\"",
                    "gridTemplateColumns": "156px 8px 24px 4px 24px",
                    "gridTemplateRows": "0px 32px",
                    "paddingLeft": "16px",
                    "paddingRight": "8px"
                  }}>
                    <div style={{
                      "alignSelf": "center",
                      "gridColumnEnd": "input",
                      "gridColumnStart": "input",
                      "gridRowEnd": "input",
                      "gridRowStart": "input",
                      "minWidth": "0px"
                    }}>
                      <div style={{
                        "alignItems": "center",
                        "backgroundClip": "padding-box",
                        "columnGap": "4px",
                        "display": "flex",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontWeight": "450",
                        "height": "32px",
                        "letterSpacing": "0.05504px",
                        "overflowX": "hidden",
                        "overflowY": "hidden",
                        "rowGap": "4px",
                        "borderRadius": "2px"
                      }}>
  <button style={{
                          "alignItems": "center",
                          "appearance": "auto",
                          "backgroundColor": "rgba(0, 0, 0, 0)",
                          "color": "rgb(0, 0, 0)",
                          "display": "flex",
                          "flexBasis": "0%",
                          "flexGrow": "1",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "11px",
                          "fontWeight": "450",
                          "height": "24px",
                          "justifyItems": "center",
                          "lineHeight": "16px",
                          "outlineColor": "rgb(230, 230, 230)",
                          "outlineOffset": "-1px",
                          "outlineStyle": "solid",
                          "outlineWidth": "1px",
                          "textAlign": "start",
                          "minWidth": "0px",
                          "borderRadius": "5px",
                          "padding": "0px"
                        }} aria-label="Color Variable White with value #FFF at 100%" type="button">
    <div style={{
                            "alignItems": "center",
                            "display": "flex",
                            "height": "14px",
                            "justifyContent": "center",
                            "lineHeight": "14px",
                            "width": "14px",
                            "margin": "4px 4px 4px 5px"
                          }}>
      <div style={{
                              "backgroundColor": "rgb(255, 255, 255)",
                              "flexBasis": "14px",
                              "flexShrink": "0",
                              "height": "14px",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "position": "relative",
                              "width": "14px",
                              "borderRadius": "2px",
                              "margin": "4px"
                            }} aria-hidden="true">
        <div style={{
                                "backgroundImage": "url(\"data:image/svg+xml;utf8,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200H3V3H0V0Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M3%200H6V3H3V0Z%22%20fill%3D%22white%22/%3E%3Cpath%20d%3D%22M3%203H6V6H3V3Z%22%20fill%3D%22%23E1E1E1%22/%3E%3Cpath%20d%3D%22M0%203H3V6H0V3Z%22%20fill%3D%22white%22/%3E%3C/svg%3E%0A\")",
                                "borderBottomRightRadius": "1px",
                                "borderTopRightRadius": "1px",
                                "height": "14px",
                                "opacity": "0",
                                "position": "absolute",
                                "right": "0px",
                                "top": "0px",
                                "width": "7px"
                              }}></div>
        <div style={{
                                "bottom": "-7px",
                                "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 2px inset",
                                "left": "-7px",
                                "position": "absolute",
                                "right": "-7px",
                                "top": "-7px",
                                "transform": "matrix(0.5, 0, 0, 0.5, 0, 0)",
                                "transformOrigin": "14px 14px",
                                "borderRadius": "20%"
                              }}></div>
      </div>
    </div>
    <div style={{
                            "alignContent": "center",
                            "boxSizing": "content-box",
                            "color": "rgba(0, 0, 0, 0.898)",
                            "height": "24px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "paddingLeft": "1px",
                            "paddingRight": "4px",
                            "textOverflow": "ellipsis",
                            "width": "128px",
                            "whiteSpace": "nowrap"
                          }}>
      <div style={{
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis"
                            }} aria-label="White">
        <span style={{
                                "whiteSpace": "nowrap"
                              }}>White</span>
      </div>
    </div>
  </button>
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
                          "whiteSpace": "nowrap",
                          "margin": "-1px"
                        }} aria-hidden="true">
    <span style={{
                            "whiteSpace": "nowrap"
                          }}>Click to edit color variable</span>
  </span>
</div>
                    </div>
                    <div style={{
                      "alignSelf": "center",
                      "gridColumnEnd": "icon1",
                      "gridColumnStart": "icon1",
                      "gridRowEnd": "icon1",
                      "gridRowStart": "icon1",
                      "minWidth": "0px"
                    }}></div>
                    <div style={{
                      "alignSelf": "center",
                      "gridColumnEnd": "icon2",
                      "gridColumnStart": "icon2",
                      "gridRowEnd": "icon2",
                      "gridRowStart": "icon2",
                      "minWidth": "0px"
                    }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>);
}

export function TextPanel({ style, className }: AirDesignComponentProps) {
  return (<div style={{
  "backgroundColor": "rgb(255, 255, 255)",
  "borderRightColor": "rgba(0, 0, 0, 0.1)",
  "borderRightStyle": "solid",
  "borderRightWidth": "1px",
  "boxSizing": "content-box",
  "color": "rgba(0, 0, 0, 0.898)",
  "direction": "ltr",
  "display": "flex",
  "flexDirection": "column",
  "fontFamily": "Inter, sans-serif",
  "fontFeatureSettings": "\"calt\", \"liga\"",
  "fontSize": "11px",
  "fontStyle": "normal",
  "fontWeight": "400",
  "letterSpacing": "normal",
  "lineHeight": "16px",
  "overflowWrap": "normal",
  "overflowX": "hidden",
  "overflowY": "auto",
  "scrollbarWidth": "none",
  "textAlign": "start",
  "textTransform": "none",
  "wordBreak": "normal",
  "WebkitFontSmoothing": "antialiased",
  "whiteSpace": "normal",
  position: "relative",
  flexShrink: 0,
  width: 307,
  ...style
}} className={className}>
  <div style={{
    "borderBottomColor": "rgb(230, 230, 230)",
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
                "color": "rgba(0, 0, 0, 0.898)",
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
                "color": "rgba(0, 0, 0, 0.898)",
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
                    "color": "rgb(0, 0, 0)",
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
                          "fill": "rgba(0, 0, 0, 0.898)"
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
        "color": "rgb(0, 0, 0)",
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
      }} aria-label="Slide view" type="button">
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
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
          "color": "rgba(0, 0, 0, 0.5)",
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
        }} aria-label="Drafts" href="https://www.figma.com/files/team/1505619433971646255/project/386051928" rel="noopener" target="_blank">
          <span style={{
            "whiteSpace": "nowrap"
          }}>Drafts</span>
        </a>
      </span>
    </div>
  </div>
  <div style={{
    "alignItems": "center",
    "backgroundColor": "rgb(255, 255, 255)",
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
    "padding": "12px 12px 12px 8px"
  }}>
    <div style={{
      "alignItems": "center",
      "columnGap": "4px",
      "display": "flex",
      "minHeight": "24px",
      "rowGap": "4px",
      "minWidth": "0px"
    }}>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgb(0, 0, 0)",
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
      }} aria-label="Back" type="button">
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
              "fill": "rgba(0, 0, 0, 0.898)"
            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M13.854 7.146a.5.5 0 0 1 0 .708L9.707 12l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
          </svg>
        </span>
      </button>
      <div style={{
        "display": "flex",
        "flexDirection": "column",
        "minWidth": "0px"
      }}>
        <h2 style={{
          "color": "rgba(0, 0, 0, 0.898)",
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
          }}>Text</span>
        </h2>
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
    }}></div>
  </div>
  <div style={{
    "alignItems": "center",
    "borderBottomColor": "rgb(230, 230, 230)",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "boxSizing": "content-box",
    "columnGap": "4px",
    "display": "flex",
    "rowGap": "4px",
    "minWidth": "0px"
  }}>
    <div style={{
      "boxSizing": "content-box",
      "display": "flex",
      "width": "274px",
      "padding": "4px 16px 16px 16px"
    }}>
      <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "rgba(0, 0, 0, 0.898)",
        "display": "flex",
        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
        "fontSize": "11px",
        "fontWeight": "450",
        "height": "24px",
        "justifyItems": "center",
        "letterSpacing": "0.05504px",
        "lineHeight": "16px",
        "maxWidth": "100%",
        "outlineColor": "rgba(0, 0, 0, 0.1)",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "position": "relative",
        "textAlign": "center",
        "width": "274px",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
        <span style={{
          "display": "flex",
          "height": "24px",
          "maxWidth": "100%",
          "width": "274px"
        }}>
          <span style={{
            "alignItems": "center",
            "boxSizing": "border-box",
            "display": "flex",
            "justifyContent": "center",
            "maxWidth": "100%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "paddingLeft": "8px",
            "paddingRight": "8px",
            "width": "274px"
          }}>
            <span style={{
              "display": "block",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "textOverflow": "ellipsis",
              "whiteSpace": "nowrap"
            }}>
              <span style={{
                "alignItems": "center",
                "display": "flex",
                "justifyContent": "center"
              }}>
                <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V7h-4.5v10h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V7H7v2a.5.5 0 0 1-1 0z" clipRule="evenodd"></path>
                </svg>
                <span style={{
                  "whiteSpace": "nowrap"
                }}>Add text box</span>
              </span>
            </span>
          </span>
        </span>
      </button>
    </div>
  </div>
  <div style={{
    "display": "flex",
    "flexDirection": "column",
    "minHeight": "0px"
  }}>
    <div style={{
      "position": "relative",
      "minWidth": "0px",
      "minHeight": "0px"
    }} role="none">
      <div style={{
        "height": "473px",
        "overflowX": "hidden",
        "overflowY": "auto",
        "position": "relative",
        "scrollbarWidth": "none",
        "width": "306px"
      }} role="none">
        <div role="none">
          <div style={{
            "boxSizing": "content-box",
            "paddingLeft": "16px",
            "paddingRight": "16px"
          }}>
            <div>
              <div style={{
                "alignItems": "center",
                "display": "inline-flex",
                "flexShrink": "0",
                "height": "40px",
                "justifyItems": "center",
                "width": "274px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "height": "40px",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "width": "274px",
                  "padding": "0px"
                }} aria-expanded="true" type="button">
                  <span style={{
                    "alignItems": "center",
                    "display": "flex",
                    "flexShrink": "0",
                    "justifyItems": "center"
                  }}>
  <svg style={{
                      "display": "block",
                      "height": "16px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "16px"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
  </svg>
</span>
                  <span style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "display": "block",
                    "flexBasis": "0%",
                    "flexGrow": "1",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "550",
                    "letterSpacing": "0.05504px",
                    "minWidth": "0px"
                  }}>
  Text
</span>
                </button>
              </div>
              <div>
                <div style={{
                  "boxSizing": "border-box",
                  "columnGap": "8px",
                  "display": "flex",
                  "flexDirection": "column",
                  "paddingTop": "8px",
                  "rowGap": "8px",
                  "width": "274px"
                }}>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "46px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 32,
                        fontWeight: 550,
                        color: "#222222"
                      }}>Title</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "41px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 24,
                        fontWeight: 550,
                        color: "#222222"
                      }}>Header 1</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "40px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 20,
                        fontWeight: 550,
                        color: "#222222"
                      }}>Header 2</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "38px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 16,
                        fontWeight: 550,
                        color: "#222222"
                      }}>Header 3</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "38px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 14,
                        fontWeight: 400,
                        color: "#222222"
                      }}>Body 1</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "37px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "#222222"
                      }}>Body 2</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "37px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        fontWeight: 400,
                        color: "#222222"
                      }}>Body 3</span>
  </button>
</div>
                  <div style={{
                    "alignItems": "center",
                    "backgroundColor": "rgb(245, 245, 245)",
                    "boxSizing": "content-box",
                    "display": "flex",
                    "border": "1px solid rgba(0, 0, 0, 0)",
                    "borderRadius": "5px"
                  }}>
  <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "boxSizing": "border-box",
                      "color": "rgb(0, 0, 0)",
                      "display": "flex",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "height": "36px",
                      "justifyItems": "center",
                      "lineHeight": "16px",
                      "textAlign": "start",
                      "width": "272px",
                      "borderRadius": "5px",
                      "padding": "12px"
                    }} aria-label="" type="button">
    <span style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        fontWeight: 400,
                        color: "#222222"
                      }}>Note</span>
  </button>
</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{
                "alignItems": "center",
                "display": "inline-flex",
                "flexShrink": "0",
                "height": "40px",
                "justifyItems": "center",
                "width": "274px"
              }}>
                <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "color": "rgb(0, 0, 0)",
                  "display": "flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "height": "40px",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "width": "274px",
                  "padding": "0px"
                }} aria-expanded="false" type="button">
                  <span style={{
                    "alignItems": "center",
                    "display": "flex",
                    "flexShrink": "0",
                    "justifyItems": "center"
                  }}>
  <svg style={{
                      "display": "block",
                      "height": "16px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "16px"
                    }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
  </svg>
</span>
                  <span style={{
                    "color": "rgba(0, 0, 0, 0.5)",
                    "display": "block",
                    "flexBasis": "0%",
                    "flexGrow": "1",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "550",
                    "letterSpacing": "0.05504px",
                    "minWidth": "0px"
                  }}>
  Font combinations
</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>);
}

