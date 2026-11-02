import type { AirDesignComponentProps } from "../types.ts";

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
