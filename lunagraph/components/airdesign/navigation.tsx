import type { CSSProperties } from "react";
export interface AirDesignComponentProps {
  style?: CSSProperties;
  className?: string;
}
export function HomeSidebar({
  style,
  className
}: AirDesignComponentProps) {
  return <nav style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "borderRightColor": "rgb(230, 230, 230)",
    "borderRightStyle": "solid",
    "borderRightWidth": "1px",
    "boxSizing": "border-box",
    "display": "flex",
    "flexShrink": "0",
    "height": "923px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    width: 241,
    ...style
  }} aria-label="Sidebar" className={className}>
                  <div style={{
      "display": "flex",
      "flexDirection": "column",
      "width": "240px"
    }}>
                    <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "display": "flex",
        "flexDirection": "column"
      }}>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "justifyContent": "space-between",
          "lineHeight": "0px",
          "marginBottom": "8px",
          "marginLeft": "8px",
          "marginRight": "8px",
          "paddingTop": "8px"
        }}>
                        <div style={{
            "display": "contents",
            "minWidth": "0px",
            "minHeight": "0px"
          }} role="presentation">
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
              "height": "32px",
              "justifyItems": "center",
              "lineHeight": "0px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "textAlign": "start",
              "borderRadius": "4px",
              "padding": "0px 4px"
            }} aria-haspopup="menu" aria-expanded="false" aria-label="Account dropdown for Quan Vu (Richard)" type="button">
    <div style={{
                "alignItems": "center",
                "columnGap": "8px",
                "display": "flex",
                "rowGap": "8px",
                "minWidth": "0px"
              }}>
      <div style={{
                  "display": "flex",
                  "position": "relative"
                }}>
        <span style={{
                    "display": "block"
                  }} aria-hidden="true">
          <div style={{
                      "alignItems": "center",
                      "color": "rgb(255, 255, 255)",
                      "display": "flex",
                      "flexShrink": "0",
                      "height": "24px",
                      "justifyContent": "center",
                      "minWidth": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "position": "relative",
                      "width": "24px",
                      "borderRadius": "9999px"
                    }} aria-label="Quan Vu (Richard)" role="img">
            <span style={{
                        "display": "block",
                        "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                        "fontSize": "13px",
                        "fontWeight": "450",
                        "lineHeight": "24px",
                        "textAlign": "center"
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
                        "width": "24px",
                        "minWidth": "0px",
                        "minHeight": "0px"
                      }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
            <span style={{
                        "bottom": "0px",
                        "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
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
        </span>
      </div>
      <span style={{
                  "color": "rgba(0, 0, 0, 0.898)",
                  "display": "block",
                  "fontSize": "13px",
                  "fontWeight": "500",
                  "letterSpacing": "-0.003px",
                  "lineHeight": "24px",
                  "maxWidth": "100%",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "textOverflow": "ellipsis",
                  "whiteSpace": "nowrap"
                }}>
        <span style={{
                    "whiteSpace": "nowrap"
                  }}>Quan Vu (Richard)</span>
      </span>
    </div>
    <svg style={{
                "display": "block",
                "flexShrink": "0",
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
</div>
                        <div style={{
            "alignItems": "center",
            "display": "flex"
          }}>
  <div>
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
      <div aria-relevant="all" role="status">
        <span style={{
                    "whiteSpace": "nowrap"
                  }}>New notification received</span>
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
                "gridTemplateColumns": "32px",
                "gridTemplateRows": "32px",
                "height": "32px",
                "justifyItems": "center",
                "lineHeight": "0px",
                "outlineColor": "rgba(0, 0, 0, 0)",
                "outlineOffset": "-1px",
                "outlineStyle": "solid",
                "outlineWidth": "1px",
                "textAlign": "start",
                "width": "32px",
                "borderRadius": "5px",
                "padding": "0px"
              }} aria-haspopup="menu" aria-label="Notifications, new notification received" aria-expanded="false" type="button">
      <div style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "32px",
                  "justifyContent": "center",
                  "position": "relative",
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
          <circle style={{
                      "fill": "rgb(220, 52, 18)"
                    }} cx="16.5" cy="7.5" r="2.5" fill="var(--color-icon-danger)"></circle>
          <path style={{
                      "fill": "rgba(0, 0, 0, 0.898)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 5a1 1 0 0 1 .991 1.124q.131.035.258.077a3.5 3.5 0 0 0-.233.979A3 3 0 0 0 9 10v1.172l-.009.338A6.83 6.83 0 0 1 7 16h10a6.83 6.83 0 0 1-1.991-4.49L15 11.172v-.509c.31.148.647.25 1 .3v.209c0 1.546.614 3.028 1.707 4.121A1 1 0 0 1 17 17h-3a2 2 0 1 1-4 0H7a1 1 0 0 1-.707-1.707A5.83 5.83 0 0 0 8 11.172V10a4 4 0 0 1 3.008-3.876A1 1 0 0 1 12 5m-1 12a1 1 0 1 0 2 0z"></path>
        </svg>
      </div>
    </button>
  </div>
</div>
                      </div>
                      <div style={{
          "height": "40px",
          "position": "relative"
        }}>
                        <div style={{
            "maxWidth": "1454px",
            "position": "relative",
            "width": "240px"
          }}>
  <div style={{
              "marginBottom": "8px",
              "marginLeft": "8px",
              "marginRight": "8px"
            }}>
    <div style={{
                "alignItems": "center",
                "backgroundColor": "rgb(245, 245, 245)",
                "display": "flex",
                "height": "32px",
                "width": "224px",
                "borderRadius": "8px"
              }}>
      <div style={{
                  "alignItems": "center",
                  "display": "flex",
                  "height": "32px",
                  "position": "relative",
                  "width": "224px"
                }}>
        <div style={{
                    "alignItems": "center",
                    "backgroundImage": "linear-gradient(90deg, rgb(245, 245, 245) 70%, rgba(0, 0, 0, 0) 100%)",
                    "bottom": "0px",
                    "display": "flex",
                    "left": "0px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "position": "absolute",
                    "top": "0px",
                    "width": "34px",
                    "zIndex": "1",
                    "minWidth": "0px",
                    "minHeight": "0px",
                    "borderRadius": "8px"
                  }}>
          <svg style={{
                      "display": "block",
                      "height": "24px",
                      "marginLeft": "4px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path style={{
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.5 6a5.5 5.5 0 0 1 4.226 9.019l2.127 2.127a.5.5 0 1 1-.707.707l-2.127-2.127A5.5 5.5 0 1 1 11.5 6m0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"></path>
          </svg>
        </div>
        <div style={{
                    "boxSizing": "content-box",
                    "marginLeft": "28px",
                    "marginRight": "28px",
                    "overflowX": "scroll",
                    "overflowY": "auto",
                    "paddingLeft": "6px",
                    "position": "relative",
                    "scrollbarWidth": "none",
                    "width": "162px",
                    "whiteSpace": "nowrap"
                  }}>
          <input style={{
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "marginRight": "10px",
                      "overflowX": "clip",
                      "overflowY": "clip",
                      "textOverflow": "ellipsis",
                      "width": "152px",
                      "padding": "0px"
                    }} aria-description="Search results; results will update as you type" aria-label="Search" placeholder="Search" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox" type="text" value=""></input>
        </div>
      </div>
    </div>
  </div>
</div>
                      </div>
                    </div>
                    <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "flexGrow": "1",
        "height": "835px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "position": "relative"
      }}>
                      <div style={{
          "alignItems": "flex-start",
          "display": "flex",
          "height": "835px",
          "overflowX": "hidden",
          "overflowY": "scroll",
          "scrollbarWidth": "none",
          "width": "240px"
        }}>
                        <div style={{
            "height": "835px",
            "width": "240px"
          }}>
  <div style={{
              "height": "835px"
            }}>
    <div></div>
    <div style={{
                "backgroundColor": "rgb(255, 255, 255)",
                "display": "flex",
                "flexDirection": "column",
                "minHeight": "100%",
                "position": "relative",
                "width": "240px"
              }}>
      <div style={{
                  "display": "flex",
                  "flexDirection": "column",
                  "flexGrow": "1"
                }}>
        <ul style={{
                    "listStyleImage": "none",
                    "listStylePosition": "outside",
                    "listStyleType": "none",
                    "marginBottom": "0px",
                    "marginTop": "0px",
                    "paddingLeft": "0px"
                  }}>
          <li style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none"
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
                        "justifyContent": "space-between",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "textAlign": "start",
                        "width": "240px",
                        "padding": "0px"
                      }} type="button">
              <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "height": "28px",
                          "justifyContent": "space-between",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "4px",
                          "paddingRight": "4px",
                          "width": "224px",
                          "borderRadius": "5px",
                          "margin": "2px 8px"
                        }}>
                <div></div>
                <div style={{
                            "alignItems": "center",
                            "columnGap": "8px",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "rowGap": "8px",
                            "width": "216px"
                          }}>
                  <div style={{
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
                                  "fill": "rgba(0, 0, 0, 0.898)"
                                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14m6-7a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-5.5-3.5a.5.5 0 0 0-1 0V12a.5.5 0 0 0 .146.354l2 2a.5.5 0 0 0 .708-.708L12.5 11.793z" clipRule="evenodd"></path>
  </svg>
</div>
                  <span style={{
                              "display": "block",
                              "maxWidth": "100%",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis",
                              "whiteSpace": "nowrap"
                            }}>
  <span style={{
                                "whiteSpace": "nowrap"
                              }}>Recents</span>
</span>
                </div>
              </div>
            </button>
          </li>
          <li style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none"
                    }}>
            <div style={{
                        "alignItems": "center",
                        "display": "flex",
                        "isolation": "isolate",
                        "justifyContent": "space-between",
                        "position": "relative",
                        "width": "240px"
                      }}>
              <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "height": "28px",
                          "justifyContent": "space-between",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "4px",
                          "paddingRight": "4px",
                          "width": "224px",
                          "borderRadius": "5px",
                          "margin": "2px 8px"
                        }}>
                <button style={{
                            "alignItems": "center",
                            "appearance": "auto",
                            "backgroundColor": "rgba(0, 0, 0, 0)",
                            "bottom": "0px",
                            "color": "rgb(0, 0, 0)",
                            "display": "flex",
                            "fontFamily": "Inter, sans-serif",
                            "fontSize": "11px",
                            "fontWeight": "400",
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
                <div></div>
                <div style={{
                            "alignItems": "center",
                            "columnGap": "8px",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "rowGap": "8px",
                            "width": "192px"
                          }}>
                  <div style={{
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
                                  "fill": "rgba(0, 0, 0, 0.898)"
                                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M5.5 10.309a1 1 0 0 1 1.448-.894l5.053 2.525 5.053-2.525a1 1 0 0 1 1.447.894v4.573c0 .568-.321 1.087-.83 1.342l-5.447 2.723a.5.5 0 0 1-.448 0L6.33 16.224a1.5 1.5 0 0 1-.83-1.342zm1.001 4.573a.5.5 0 0 0 .276.447L11.5 17.69v-4.88l-4.999-2.5zm5.999-2.073v4.881l4.725-2.36a.5.5 0 0 0 .276-.448v-4.573zM12.001 5a2.5 2.5 0 1 1-.002 5.002A2.5 2.5 0 0 1 12.001 5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
  </svg>
</div>
                  <span style={{
                              "display": "block"
                            }} aria-hidden="true">
  Community
</span>
                </div>
                <div style={{
                            "position": "relative"
                          }}>
                  <div style={{
                              "opacity": "0"
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
                              }} aria-label="Open Community in new tab" type="button">
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
                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.5 6a.5.5 0 0 1 0 1h-2a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 1 1 0v2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zm8 0a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0V7.707l-4.146 4.147a.5.5 0 1 1-.707-.707L16.293 7H12.5a.5.5 0 0 1 0-1z"></path>
      </svg>
    </span>
  </button>
</div>
                </div>
              </div>
            </div>
          </li>
        </ul>
        <div style={{
                    "backgroundColor": "rgb(230, 230, 230)",
                    "height": "1px",
                    "marginBottom": "8px",
                    "marginTop": "8px"
                  }}></div>
        <div style={{
                    "marginBottom": "2px",
                    "marginRight": "8px",
                    "marginTop": "2px"
                  }}>
          <div style={{
                      "display": "contents"
                    }} role="presentation">
            <div style={{
                        "alignItems": "center",
                        "boxSizing": "content-box",
                        "columnGap": "4px",
                        "display": "flex",
                        "justifyContent": "flex-start",
                        "paddingLeft": "8px",
                        "rowGap": "4px"
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
                          "height": "32px",
                          "justifyItems": "center",
                          "lineHeight": "16px",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "textAlign": "start",
                          "borderRadius": "4px",
                          "padding": "0px 0px 0px 4px"
                        }} aria-haspopup="menu" aria-expanded="false" aria-label="Plan: Quan Vu" type="button">
                <div style={{
                            "alignItems": "center",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden"
                          }}>
                  <div style={{
                              "alignItems": "center",
                              "display": "flex",
                              "flexShrink": "0",
                              "height": "24px",
                              "justifyContent": "center",
                              "width": "24px"
                            }}>
  <div style={{
                                "position": "relative"
                              }}>
    <span aria-hidden="true">
      <div style={{
                                    "alignItems": "center",
                                    "backgroundColor": "rgb(242, 72, 34)",
                                    "color": "rgb(255, 255, 255)",
                                    "display": "flex",
                                    "flexShrink": "0",
                                    "height": "16px",
                                    "justifyContent": "center",
                                    "minWidth": "16px",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "position": "relative",
                                    "width": "16px",
                                    "borderRadius": "9999px"
                                  }} aria-label="Quan Vu" role="img">
        <span style={{
                                      "display": "block",
                                      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                      "fontSize": "10px",
                                      "fontWeight": "500",
                                      "textAlign": "center"
                                    }}>
          Q
        </span>
      </div>
    </span>
    <div style={{
                                  "boxShadow": "rgba(255, 255, 255, 0.4) 0px 0px 0px 1px inset",
                                  "height": "16px",
                                  "position": "absolute",
                                  "top": "0px",
                                  "width": "16px",
                                  "borderRadius": "100%"
                                }}></div>
  </div>
</div>
                  <div style={{
                              "display": "flex",
                              "marginLeft": "8px",
                              "overflowX": "hidden",
                              "overflowY": "hidden"
                            }}>
  <span style={{
                                "color": "rgba(0, 0, 0, 0.898)",
                                "display": "block",
                                "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                "fontSize": "13px",
                                "fontWeight": "550",
                                "letterSpacing": "-0.032px",
                                "lineHeight": "22px",
                                "maxWidth": "100%",
                                "overflowWrap": "break-word",
                                "overflowX": "hidden",
                                "overflowY": "hidden",
                                "textOverflow": "ellipsis",
                                "whiteSpace": "nowrap"
                              }}>
    <span style={{
                                  "whiteSpace": "nowrap"
                                }}>Quan Vu</span>
  </span>
</div>
                </div>
                <svg style={{
                            "display": "block",
                            "flexShrink": "0",
                            "height": "24px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "24px"
                          }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path style={{
                              "fill": "rgba(0, 0, 0, 0.898)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
                </svg>
              </button>
              <div style={{
                          "display": "flex"
                        }}>
                <button style={{
                            "appearance": "auto",
                            "backgroundColor": "rgb(255, 255, 255)",
                            "color": "rgb(0, 0, 0)",
                            "display": "block",
                            "fontFamily": "Inter, sans-serif",
                            "fontSize": "11px",
                            "fontWeight": "400",
                            "lineHeight": "16px",
                            "textAlign": "center",
                            "padding": "0px"
                          }} aria-label="Change plan. Quan Vu is currently on the Professional plan" aria-expanded="false">
                  <span style={{
                              "backgroundColor": "rgb(242, 249, 255)",
                              "boxSizing": "border-box",
                              "color": "rgb(0, 123, 229)",
                              "display": "flex",
                              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                              "fontWeight": "500",
                              "letterSpacing": "0.005px",
                              "paddingLeft": "6px",
                              "paddingRight": "6px",
                              "whiteSpace": "nowrap",
                              "borderRadius": "4px"
                            }}>
  <span style={{
                                "whiteSpace": "nowrap"
                              }}>Professional</span>
</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <ul style={{
                    "listStyleImage": "none",
                    "listStylePosition": "outside",
                    "listStyleType": "none",
                    "marginBottom": "0px",
                    "marginTop": "0px",
                    "paddingLeft": "0px"
                  }}>
          <div>
            <li style={{
                        "color": "rgba(0, 0, 0, 0.898)",
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "11px",
                        "fontWeight": "400",
                        "lineHeight": "16px",
                        "listStyleImage": "none",
                        "listStylePosition": "outside",
                        "listStyleType": "none"
                      }}>
              <div style={{
                          "alignItems": "center",
                          "display": "flex",
                          "isolation": "isolate",
                          "justifyContent": "space-between",
                          "position": "relative",
                          "width": "240px"
                        }}>
                <div style={{
                            "alignItems": "center",
                            "backgroundColor": "rgb(229, 244, 255)",
                            "boxSizing": "border-box",
                            "display": "flex",
                            "height": "28px",
                            "justifyContent": "space-between",
                            "outlineColor": "rgba(255, 255, 255, 0)",
                            "outlineOffset": "-1px",
                            "outlineStyle": "solid",
                            "outlineWidth": "1px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "paddingLeft": "4px",
                            "paddingRight": "4px",
                            "width": "224px",
                            "borderRadius": "5px",
                            "margin": "2px 8px"
                          }}>
                  <button style={{
                              "alignItems": "center",
                              "appearance": "auto",
                              "backgroundColor": "rgba(0, 0, 0, 0)",
                              "bottom": "0px",
                              "color": "rgb(0, 0, 0)",
                              "display": "flex",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
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
                            }} aria-current="page" type="button"></button>
                  <div></div>
                  <div style={{
                              "alignItems": "center",
                              "columnGap": "8px",
                              "display": "flex",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "rowGap": "8px",
                              "width": "192px"
                            }}>
  <div style={{
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
                                    "fill": "rgba(0, 0, 0, 0.898)"
                                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.598 5.01a.5.5 0 0 1 .255.136l4 4A.5.5 0 0 1 16.5 10h-4a.5.5 0 0 1-.5-.5V6H8.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 1 1 0v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h4zM13 9h2.293L13 6.707z"></path>
    </svg>
  </div>
  <span style={{
                                "display": "block"
                              }} aria-hidden="true">
    <span style={{
                                  "display": "contents"
                                }}>
      Drafts
    </span>
  </span>
</div>
                  <div style={{
                              "position": "relative"
                            }}>
  <div style={{
                                "opacity": "0"
                              }}>
    <div style={{
                                  "display": "contents"
                                }} role="presentation">
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
                                  }} aria-label="New file" aria-haspopup="menu" aria-expanded="false" type="button">
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
                                        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
          </svg>
        </span>
      </button>
    </div>
  </div>
</div>
                </div>
              </div>
            </li>
          </div>
          <li style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none"
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
                        "justifyContent": "space-between",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "textAlign": "start",
                        "width": "240px",
                        "padding": "0px"
                      }} type="button">
              <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "height": "28px",
                          "justifyContent": "space-between",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "4px",
                          "paddingRight": "4px",
                          "width": "224px",
                          "borderRadius": "5px",
                          "margin": "2px 8px"
                        }}>
                <div></div>
                <div style={{
                            "alignItems": "center",
                            "columnGap": "8px",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "rowGap": "8px",
                            "width": "216px"
                          }}>
                  <div style={{
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
                                  "fill": "rgba(0, 0, 0, 0.898)"
                                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.653 13.008A1.5 1.5 0 0 1 11 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L6 16.5v-2A1.5 1.5 0 0 1 7.5 13h2zm7 0A1.5 1.5 0 0 1 18 14.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 18h-2a1.5 1.5 0 0 1-1.492-1.347L13 16.5v-2a1.5 1.5 0 0 1 1.5-1.5h2zM7.5 14a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM9.653 6.008A1.5 1.5 0 0 1 11 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L9.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L6 9.5v-2A1.5 1.5 0 0 1 7.5 6h2zm7 0A1.5 1.5 0 0 1 18 7.5v2l-.008.153a1.5 1.5 0 0 1-1.339 1.34L16.5 11h-2a1.5 1.5 0 0 1-1.492-1.347L13 9.5v-2A1.5 1.5 0 0 1 14.5 6h2zM7.5 7a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zm7 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z"></path>
  </svg>
</div>
                  <span style={{
                              "display": "block",
                              "maxWidth": "100%",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis",
                              "whiteSpace": "nowrap"
                            }}>
  <span style={{
                                "whiteSpace": "nowrap"
                              }}>All folders</span>
</span>
                </div>
              </div>
            </button>
          </li>
          <li style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none"
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
                        "justifyContent": "space-between",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "textAlign": "start",
                        "width": "240px",
                        "padding": "0px"
                      }} type="button">
              <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "height": "28px",
                          "justifyContent": "space-between",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "4px",
                          "paddingRight": "4px",
                          "width": "224px",
                          "borderRadius": "5px",
                          "margin": "2px 8px"
                        }}>
                <div></div>
                <div style={{
                            "alignItems": "center",
                            "columnGap": "8px",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "rowGap": "8px",
                            "width": "216px"
                          }}>
                  <div style={{
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
                                  "fill": "rgba(0, 0, 0, 0.898)"
                                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v2H6V8a1 1 0 0 1 1-1m-1 4v5a1 1 0 0 0 1 1h2v-6zm4 6h7a1 1 0 0 0 1-1v-5h-8zM5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</div>
                  <span style={{
                              "display": "block",
                              "maxWidth": "100%",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis",
                              "whiteSpace": "nowrap"
                            }}>
  <span style={{
                                "whiteSpace": "nowrap"
                              }}>Resources</span>
</span>
                </div>
              </div>
            </button>
          </li>
          <li style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none"
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
                        "justifyContent": "space-between",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "textAlign": "start",
                        "width": "240px",
                        "padding": "0px"
                      }} type="button">
              <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "height": "28px",
                          "justifyContent": "space-between",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "4px",
                          "paddingRight": "4px",
                          "width": "224px",
                          "borderRadius": "5px",
                          "margin": "2px 8px"
                        }}>
                <div></div>
                <div style={{
                            "alignItems": "center",
                            "columnGap": "8px",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "rowGap": "8px",
                            "width": "216px"
                          }}>
                  <div style={{
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
                                  "fill": "rgba(0, 0, 0, 0.898)"
                                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.355 9a.5.5 0 0 1 .498.52l-.273 6.563-.018.198a2 2 0 0 1-1.782 1.71l-.198.009H9.418a2 2 0 0 1-1.998-1.917l-.273-6.562a.5.5 0 1 1 1-.042l.272 6.563a1 1 0 0 0 .999.958h5.164a1 1 0 0 0 1-.958l.272-6.563a.5.5 0 0 1 .5-.479M11 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5m2 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5m0-5a1 1 0 0 1 1 1v1h3.5a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1H10V6a1 1 0 0 1 1-1zm-2 2h2V6h-2z"></path>
  </svg>
</div>
                  <span style={{
                              "display": "block",
                              "maxWidth": "100%",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis",
                              "whiteSpace": "nowrap"
                            }}>
  <span style={{
                                "whiteSpace": "nowrap"
                              }}>Trash</span>
</span>
                </div>
              </div>
            </button>
          </li>
          <li style={{
                      "color": "rgba(0, 0, 0, 0.898)",
                      "fontFamily": "Inter, sans-serif",
                      "fontSize": "11px",
                      "fontWeight": "400",
                      "lineHeight": "16px",
                      "listStyleImage": "none",
                      "listStylePosition": "outside",
                      "listStyleType": "none"
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
                        "justifyContent": "space-between",
                        "justifyItems": "center",
                        "lineHeight": "16px",
                        "textAlign": "start",
                        "width": "240px",
                        "padding": "0px"
                      }} type="button">
              <div style={{
                          "alignItems": "center",
                          "boxSizing": "border-box",
                          "display": "flex",
                          "height": "28px",
                          "justifyContent": "space-between",
                          "overflowX": "hidden",
                          "overflowY": "hidden",
                          "paddingLeft": "4px",
                          "paddingRight": "4px",
                          "width": "224px",
                          "borderRadius": "5px",
                          "margin": "2px 8px"
                        }}>
                <div></div>
                <div style={{
                            "alignItems": "center",
                            "display": "flex",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "216px"
                          }}>
                  <span style={{
                              "alignItems": "center",
                              "columnGap": "8px",
                              "display": "flex",
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "rowGap": "8px",
                              "width": "201.242px"
                            }}>
  <div style={{
                                "alignItems": "center",
                                "display": "flex",
                                "flexShrink": "0",
                                "height": "24px",
                                "justifyContent": "center",
                                "width": "24px"
                              }} aria-hidden="true">
    <div style={{
                                  "height": "24px",
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
                                      "fill": "rgba(0, 0, 0, 0.898)"
                                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M15.755 7.234a1 1 0 0 1-1.505-.87c.002-.52-.342-1.138-1.038-1.26a7 7 0 0 0-2.424 0c-.696.122-1.04.74-1.038 1.26a1 1 0 0 1-1.505.87c-.45-.262-1.155-.273-1.608.267A7 7 0 0 0 5.42 9.603c-.241.664.122 1.27.574 1.527a1 1 0 0 1 0 1.74c-.452.258-.815.863-.574 1.527a7 7 0 0 0 1.216 2.102c.453.54 1.158.529 1.608.267a1 1 0 0 1 1.505.87c-.002.52.342 1.138 1.038 1.26a7 7 0 0 0 2.424 0c.696-.122 1.04-.74 1.038-1.26a1 1 0 0 1 1.505-.87c.45.262 1.155.273 1.608-.267a7 7 0 0 0 1.216-2.102c.241-.664-.122-1.27-.574-1.528a1 1 0 0 1 0-1.739c.452-.258.815-.864.573-1.527a7 7 0 0 0-1.215-2.102c-.453-.54-1.158-.529-1.608-.267m-1.505.869a2 2 0 0 0 2.008-.005c.112-.064.256-.052.34.046.444.53.8 1.139 1.041 1.802.044.12-.018.252-.13.316a2 2 0 0 0 0 3.476c.112.064.174.195.13.316a6 6 0 0 1-1.042 1.802c-.082.098-.227.11-.339.046a2 2 0 0 0-3.008 1.737c0 .13-.083.249-.21.271a6 6 0 0 1-2.08 0c-.127-.022-.21-.142-.21-.27a2 2 0 0 0-3.007-1.74c-.112.065-.257.053-.34-.045a6 6 0 0 1-1.041-1.802c-.044-.12.018-.252.13-.316a2 2 0 0 0 0-3.476c-.112-.064-.174-.195-.13-.316a6 6 0 0 1 1.042-1.802c.082-.098.227-.11.339-.046A2 2 0 0 0 10.75 6.36c0-.13.083-.249.21-.271a6 6 0 0 1 2.08 0c.127.022.21.141.21.27a2 2 0 0 0 1 1.743M10.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5" clipRule="evenodd"></path>
      </svg>
    </div>
  </div>
  <span style={{
                                "display": "block",
                                "maxWidth": "100%",
                                "overflowX": "hidden",
                                "overflowY": "hidden",
                                "textOverflow": "ellipsis",
                                "whiteSpace": "nowrap"
                              }}>
    <span style={{
                                  "whiteSpace": "nowrap"
                                }}>Admin</span>
  </span>
</span>
                  <div style={{
                              "alignItems": "center",
                              "display": "flex",
                              "flexShrink": "0"
                            }}>
  <div>
    <strong style={{
                                  "alignItems": "center",
                                  "backgroundColor": "rgb(230, 230, 230)",
                                  "boxSizing": "content-box",
                                  "color": "rgba(0, 0, 0, 0.898)",
                                  "display": "inline-flex",
                                  "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                                  "fontSize": "11px",
                                  "fontWeight": "450",
                                  "height": "16px",
                                  "letterSpacing": "0.05504px",
                                  "lineHeight": "16px",
                                  "overflowX": "hidden",
                                  "overflowY": "hidden",
                                  "paddingLeft": "4px",
                                  "paddingRight": "4px",
                                  "position": "relative",
                                  "borderRadius": "5px"
                                }} aria-label="2 admin notifications">
      <span style={{
                                    "display": "block",
                                    "flexGrow": "1",
                                    "overflowX": "hidden",
                                    "overflowY": "hidden",
                                    "textOverflow": "ellipsis",
                                    "whiteSpace": "nowrap"
                                  }}>
        <span style={{
                                      "whiteSpace": "nowrap"
                                    }}>2</span>
      </span>
    </strong>
  </div>
</div>
                </div>
              </div>
            </button>
          </li>
        </ul>
        <div style={{
                    "position": "relative"
                  }}></div>
        <div style={{
                    "backgroundColor": "rgb(230, 230, 230)",
                    "height": "1px",
                    "marginBottom": "8px",
                    "marginTop": "8px"
                  }}></div>
        <section>
          <div style={{
                      "position": "relative"
                    }}>
            <div>
              <div style={{
                          "alignItems": "center",
                          "display": "inline-flex",
                          "flexShrink": "0",
                          "height": "32px",
                          "justifyItems": "center",
                          "width": "240px"
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
                            "height": "32px",
                            "justifyItems": "center",
                            "lineHeight": "16px",
                            "textAlign": "start",
                            "width": "240px",
                            "minWidth": "0px",
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
                              "overflowX": "hidden",
                              "overflowY": "hidden",
                              "textOverflow": "ellipsis",
                              "minWidth": "0px",
                              "whiteSpace": "nowrap"
                            }}>
    <span style={{
                                "display": "contents"
                              }}>
      <span style={{
                                  "whiteSpace": "nowrap"
                                }}>Starred</span>
    </span>
  </span>
</button>
              </div>
              <div>
                <ol style={{
                            "listStyleImage": "none",
                            "listStylePosition": "outside",
                            "listStyleType": "none",
                            "marginBottom": "0px",
                            "marginTop": "0px",
                            "paddingLeft": "0px"
                          }}>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
              <div style={{
                                          "display": "contents"
                                        }} role="presentation">
  <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
    <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
      <div></div>
      <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
        <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
          <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>[Quan] 01. Personal Project</span>
        </span>
      </div>
      <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
    </div>
  </button>
</div>
            </div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
  </svg>
</span>
            </button>
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
                                      }} aria-label="Move row up" type="button" aria-disabled="true">
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
                                              "fill": "rgba(0, 0, 0, 0.3)"
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
  </svg>
</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
              <div style={{
                                          "display": "contents"
                                        }} role="presentation">
  <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
    <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
      <div></div>
      <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
        <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
          <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>[Quan] 02. Work Project</span>
        </span>
      </div>
      <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
    </div>
  </button>
</div>
            </div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
  </svg>
</span>
            </button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
  </svg>
</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
              <div style={{
                                          "display": "contents"
                                        }} role="presentation">
  <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
    <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
      <div></div>
      <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
        <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
          <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>[Quan] 03. Collab</span>
        </span>
      </div>
      <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
    </div>
  </button>
</div>
            </div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
  </svg>
</span>
            </button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
  </svg>
</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
              <div style={{
                                          "display": "contents"
                                        }} role="presentation">
  <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
    <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
      <div></div>
      <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
        <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
          </svg>
        </div>
        <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
          <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>[Quan] 99. Archive</span>
        </span>
      </div>
      <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
    </div>
  </button>
</div>
            </div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
  <div style={{
                                          "display": "contents"
                                        }} role="presentation">
    <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
      <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
        <div></div>
        <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
          <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
            <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>Nova Membership</span>
          </span>
        </div>
        <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
      </div>
    </button>
  </div>
</div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
  <div style={{
                                          "display": "contents"
                                        }} role="presentation">
    <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
      <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
        <div></div>
        <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
          <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
            <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>Project Consulting</span>
          </span>
        </div>
        <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
      </div>
    </button>
  </div>
</div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
  <div style={{
                                          "display": "contents"
                                        }} role="presentation">
    <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
      <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
        <div></div>
        <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
          <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
            <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>Professional Template</span>
          </span>
        </div>
        <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
      </div>
    </button>
  </div>
</div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
  <div style={{
                                          "display": "contents"
                                        }} role="presentation">
    <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
      <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
        <div></div>
        <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
          <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
            <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>Vietjet Project</span>
          </span>
        </div>
        <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
      </div>
    </button>
  </div>
</div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
          </div>
        </div>
      </div>
    </div>
  </li>
  <li style={{
                              "color": "rgba(0, 0, 0, 0.898)",
                              "fontFamily": "Inter, sans-serif",
                              "fontSize": "11px",
                              "fontWeight": "400",
                              "lineHeight": "16px",
                              "listStyleImage": "none",
                              "listStylePosition": "outside",
                              "listStyleType": "none"
                            }}>
    <div>
      <div>
        <div style={{
                                    "display": "flex",
                                    "justifyContent": "space-between"
                                  }}>
          <div style={{
                                      "flexGrow": "1",
                                      "maxWidth": "100%",
                                      "overflowX": "clip",
                                      "textOverflow": "ellipsis"
                                    }}>
            <div>
  <div style={{
                                          "display": "contents"
                                        }} role="presentation">
    <button style={{
                                            "alignItems": "center",
                                            "appearance": "auto",
                                            "backgroundColor": "rgba(0, 0, 0, 0)",
                                            "color": "rgb(0, 0, 0)",
                                            "display": "flex",
                                            "fontFamily": "Inter, sans-serif",
                                            "fontSize": "11px",
                                            "fontWeight": "400",
                                            "justifyContent": "space-between",
                                            "justifyItems": "center",
                                            "lineHeight": "16px",
                                            "textAlign": "start",
                                            "width": "240px",
                                            "padding": "0px"
                                          }} aria-description="Folder" type="button">
      <div style={{
                                              "alignItems": "center",
                                              "boxSizing": "border-box",
                                              "display": "flex",
                                              "height": "28px",
                                              "justifyContent": "space-between",
                                              "overflowX": "hidden",
                                              "overflowY": "hidden",
                                              "paddingLeft": "4px",
                                              "paddingRight": "4px",
                                              "width": "224px",
                                              "borderRadius": "5px",
                                              "margin": "2px 8px"
                                            }}>
        <div></div>
        <div style={{
                                                "alignItems": "center",
                                                "columnGap": "8px",
                                                "display": "flex",
                                                "overflowX": "hidden",
                                                "overflowY": "hidden",
                                                "rowGap": "8px",
                                                "width": "216px"
                                              }}>
          <div style={{
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
                                                      "fill": "rgb(175, 188, 207)"
                                                    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>
          </div>
          <span style={{
                                                  "display": "block",
                                                  "maxWidth": "100%",
                                                  "overflowX": "hidden",
                                                  "overflowY": "hidden",
                                                  "textOverflow": "ellipsis",
                                                  "whiteSpace": "nowrap"
                                                }}>
            <span style={{
                                                    "whiteSpace": "nowrap"
                                                  }}>Grok Bot Slide</span>
          </span>
        </div>
        <div style={{
                                                "alignItems": "center",
                                                "display": "flex",
                                                "flexShrink": "0"
                                              }}></div>
      </div>
    </button>
  </div>
</div>
          </div>
          <div style={{
                                      "alignItems": "center",
                                      "boxSizing": "content-box",
                                      "clip": "rect(0px, 0px, 0px, 0px)",
                                      "clipPath": "inset(50%)",
                                      "display": "flex",
                                      "height": "32px",
                                      "overflowX": "hidden",
                                      "overflowY": "hidden",
                                      "paddingLeft": "4px",
                                      "paddingRight": "4px",
                                      "position": "absolute",
                                      "width": "1px",
                                      "minWidth": "0px",
                                      "minHeight": "0px",
                                      "whiteSpace": "nowrap"
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
                                      }} aria-label="Move row down" type="button" aria-disabled="true">
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
                                              "fill": "rgba(0, 0, 0, 0.3)"
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 7a.5.5 0 0 1 .5.5v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708l3.146 3.147V7.5A.5.5 0 0 1 12 7" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
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
                                      }} aria-label="Move row up" type="button">
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
                                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 16a.5.5 0 0 1-.5-.5V8.707l-3.146 3.147a.5.5 0 0 1-.708-.708l4-4a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1-.708.708L12.5 8.707V15.5a.5.5 0 0 1-.5.5" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
          </div>
        </div>
      </div>
    </div>
  </li>
</ol>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div></div>
    </div>
  </div>
</div>
                      </div>
                    </div>
                    <div style={{
        "backgroundColor": "rgb(255, 255, 255)",
        "position": "relative",
        "zIndex": "1"
      }}>
                      <div></div>
                    </div>
                  </div>
                  <div style={{
      "backgroundColor": "rgb(255, 255, 255)",
      "bottom": "0px",
      "left": "0px",
      "opacity": "0",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "absolute",
      "right": "0px",
      "top": "0px",
      "minWidth": "0px",
      "minHeight": "0px"
    }} aria-hidden="true">
                    <div style={{
        "boxSizing": "content-box",
        "display": "flex",
        "flexDirection": "column",
        "paddingTop": "4px",
        "width": "240px"
      }}>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "columnGap": "8px",
          "display": "flex",
          "rowGap": "8px",
          "padding": "8px 12px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "24px",
            "width": "24px",
            "borderRadius": "9999px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "width": "120px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "boxSizing": "content-box",
          "marginBottom": "8px",
          "marginTop": "4px",
          "paddingLeft": "8px",
          "paddingRight": "8px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "32px",
            "width": "224px",
            "borderRadius": "8px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "70px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "backgroundColor": "rgb(230, 230, 230)",
          "height": "1px",
          "marginBottom": "10px",
          "marginTop": "8px",
          "width": "240px"
        }}></div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "9999px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "115px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "70px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "100px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "width": "60px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "100px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "80px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "opacity": "0.6",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "120px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                      <div style={{
          "alignItems": "center",
          "boxSizing": "content-box",
          "display": "flex",
          "opacity": "0.3",
          "padding": "8px 16px"
        }}>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "flexShrink": "0",
            "height": "16px",
            "width": "16px",
            "borderRadius": "3px"
          }}></div>
                        <div style={{
            "backgroundColor": "rgb(245, 245, 245)",
            "height": "16px",
            "marginLeft": "12px",
            "width": "105px",
            "borderRadius": "3px"
          }}></div>
                      </div>
                    </div>
                  </div>
                </nav>;
}
export function HomeHeader({
  style,
  className
}: AirDesignComponentProps) {
  return <span style={{
    "display": "block",
    "minWidth": "0px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 1165,
    ...style
  }} className={className}>
  <div style={{
      "alignItems": "center",
      "columnGap": "16px",
      "display": "flex",
      "justifyContent": "space-between",
      "width": "1165px"
    }}>
    <div style={{
        "flexShrink": "0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }}>
      <h1 style={{
          "color": "rgba(0, 0, 0, 0.898)",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "lineHeight": "16px",
          "marginBottom": "0px",
          "marginTop": "0px",
          "flexShrink": 0
        }}>
        <span style={{
            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
            "fontSize": "13px",
            "letterSpacing": "-0.032px",
            "lineHeight": "22px",
            "maxWidth": "100%",
            "overflowX": "hidden",
            "overflowY": "hidden",
            "textOverflow": "ellipsis",
            "whiteSpace": "nowrap"
          }}>
          <span style={{
              "whiteSpace": "nowrap"
            }}>Drafts</span>
        </span>
      </h1>
    </div>
    <div style={{
        "alignItems": "center",
        "columnGap": "8px",
        "display": "flex",
        "rowGap": "8px",
        "minWidth": "0px"
      }}>
      <div style={{
          "boxSizing": "border-box",
          "display": "flex",
          "justifyContent": "end",
          "paddingBottom": "8px",
          "paddingTop": "8px",
          "width": "465.93px"
        }}>
        <div style={{
            "columnGap": "8px",
            "display": "flex",
            "flexShrink": "0",
            "rowGap": "8px"
          }}>
          <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
            <div style={{
                "display": "contents"
              }}>
              <button style={{
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
                  "padding": "0px"
                }} aria-label="New Design file" type="button">
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
                          "backgroundColor": "rgb(13, 153, 255)",
                          "borderRadius": "2px"
                        }}>
                        <svg style={{
                            "display": "block",
                            "height": "16px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "16px"
                          }} width="16" height="16" fill="none" viewBox="0 0 64 64"><path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
                      </div>
                      <span style={{
                          "alignItems": "center",
                          "columnGap": "4px",
                          "display": "flex",
                          "rowGap": "4px"
                        }}>
                        <span style={{
                            "color": "rgba(0, 0, 0, 0.898)",
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
              </button>
            </div>
            <div style={{
                "display": "contents"
              }}>
              <button style={{
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
                  "padding": "0px"
                }} aria-label="New Slides file" type="button">
                <div style={{
                    "display": "grid",
                    "gridTemplateColumns": "87.8359px",
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
                          "backgroundColor": "rgb(255, 92, 22)",
                          "borderRadius": "2px"
                        }}>
                        <svg style={{
                            "display": "block",
                            "height": "16px",
                            "overflowX": "hidden",
                            "overflowY": "hidden",
                            "width": "16px"
                          }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
                              "fill": "rgb(255, 255, 255)"
                            }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m.434 8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 1 1-.956.292L10.52 12H5.479l-.5 1.646a.5.5 0 1 1-.957-.292zM5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>
                      </div>
                      <span style={{
                          "alignItems": "center",
                          "columnGap": "4px",
                          "display": "flex",
                          "rowGap": "4px"
                        }}>
                        <span style={{
                            "color": "rgba(0, 0, 0, 0.898)",
                            "display": "block",
                            "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                            "fontWeight": "450",
                            "letterSpacing": "0.05504px"
                          }}>
  Slides
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
              </button>
            </div>
            <div style={{
                "display": "contents"
              }} role="presentation">
              <button style={{
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
                  "padding": "0px"
                }} aria-haspopup="menu" aria-expanded="false" aria-label="More" type="button">
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
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</span>;
}
export function CreateFileButtons({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "8px",
    "display": "flex",
    "flexShrink": "0",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    width: 466,
    ...style
  }} className={className}>
          <div style={{
      "display": "contents",
      "minWidth": "0px",
      "minHeight": "0px"
    }}>
            <div style={{
        "display": "contents"
      }}>
              <button style={{
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
          "padding": "0px"
        }} aria-label="New Design file" type="button">
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
                  "backgroundColor": "rgb(13, 153, 255)",
                  "borderRadius": "2px"
                }}>
                        <svg style={{
                    "display": "block",
                    "height": "16px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "width": "16px"
                  }} width="16" height="16" fill="none" viewBox="0 0 64 64"><path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
                      </div>
                      <span style={{
                  "alignItems": "center",
                  "columnGap": "4px",
                  "display": "flex",
                  "rowGap": "4px"
                }}>
                        <span style={{
                    "color": "rgba(0, 0, 0, 0.898)",
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
              </button>
            </div>
            <div style={{
        "display": "contents"
      }}>
              <button style={{
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
          "padding": "0px"
        }} aria-label="New Slides file" type="button">
                <div style={{
            "display": "grid",
            "gridTemplateColumns": "87.8359px",
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
                  "backgroundColor": "rgb(255, 92, 22)",
                  "borderRadius": "2px"
                }}>
                        <svg style={{
                    "display": "block",
                    "height": "16px",
                    "overflowX": "hidden",
                    "overflowY": "hidden",
                    "width": "16px"
                  }} width="16" height="16" fill="none" viewBox="0 0 16 16">
  <path style={{
                      "fill": "rgb(255, 255, 255)"
                    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m.434 8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 1 1-.956.292L10.52 12H5.479l-.5 1.646a.5.5 0 1 1-.957-.292zM5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>
                      </div>
                      <span style={{
                  "alignItems": "center",
                  "columnGap": "4px",
                  "display": "flex",
                  "rowGap": "4px"
                }}>
                        <span style={{
                    "color": "rgba(0, 0, 0, 0.898)",
                    "display": "block",
                    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                    "fontWeight": "450",
                    "letterSpacing": "0.05504px"
                  }}>
  Slides
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
              </button>
            </div>
            <div style={{
        "display": "contents"
      }} role="presentation">
              <button style={{
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
          "padding": "0px"
        }} aria-haspopup="menu" aria-expanded="false" aria-label="More" type="button">
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
              </button>
            </div>
          </div>
        </div>;
}
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
export function EditorToolbar({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
    "display": "flex",
    "height": "48px",
    "borderRadius": "13px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 360,
    ...style
  }} aria-label="Editor" role="toolbar" aria-orientation="horizontal" className={className}>
      <div style={{
      "height": "48px",
      "overflowX": "clip",
      "width": "265px"
    }}>
        <div style={{
        "alignItems": "flex-start",
        "display": "flex",
        "flexDirection": "column",
        "transform": "matrix(1, 0, 0, 1, 0, 0)",
        "transformOrigin": "132.5px 48px"
      }}>
          <div>
            <div style={{
            "boxSizing": "border-box",
            "columnGap": "8px",
            "display": "flex",
            "height": "48px",
            "rowGap": "8px",
            "padding": "8px"
          }}>
              <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
                <div style={{
                "display": "contents"
              }} role="presentation">
                  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Move" role="group">
                    <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(255, 92, 22)",
                    "boxSizing": "border-box",
                    "color": "rgb(255, 255, 255)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="false" aria-label="Move" aria-pressed="true" type="button">
  <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                        "fill": "rgb(255, 255, 255)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
  </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button">
  <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </span>
</button>
                  </div>
                </div>
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
                "padding": "4px"
              }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
                  </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Image/video…" aria-pressed="false" type="button">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
                  </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Shapes" aria-pressed="false" type="button">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                  </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Comment" aria-pressed="false" type="button">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Actions" aria-pressed="false" type="button">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                </button>
              </div>
            </div>
          </div>
          <div style={{
          "visibility": "hidden"
        }}>
            <div style={{
            "boxSizing": "border-box",
            "columnGap": "8px",
            "display": "flex",
            "height": "48px",
            "rowGap": "8px",
            "padding": "8px"
          }}>
              <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
                <div style={{
                "display": "contents"
              }} role="presentation">
                  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Move" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(13, 153, 255)",
                    "boxSizing": "border-box",
                    "color": "rgb(255, 255, 255)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgb(255, 255, 255)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                </div>
                <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
</svg>
                </button>
                <div style={{
                "display": "contents"
              }} role="presentation">
                  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Rectangle" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                </div>
                <div style={{
                "display": "contents"
              }} role="presentation">
                  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Pen" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                </div>
                <div style={{
                "display": "contents"
              }} role="presentation">
                  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Text" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                </div>
                <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
                </button>
                <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Actions" aria-pressed="false" type="button" aria-disabled="true">
                  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                </button>
                <div>
                  <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "display": "inline-flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "borderRadius": "9999px",
                  "padding": "4px"
                }} aria-hidden="true" aria-label="Assets" type="button" aria-disabled="true">
  <div style={{
                    "color": "rgba(0, 0, 0, 0.3)",
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
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
    </svg>
  </div>
</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{
      "alignSelf": "stretch",
      "backgroundColor": "rgb(230, 230, 230)",
      "width": "1px"
    }}></div>
      <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "justifyContent": "center",
      "padding": "8px"
    }}>
        <fieldset style={{
        "backgroundColor": "rgb(245, 245, 245)",
        "boxSizing": "border-box",
        "display": "flex",
        "height": "32px",
        "marginLeft": "0px",
        "marginRight": "0px",
        "minWidth": "min-content",
        "position": "relative",
        "borderRadius": "5px",
        "padding": "2px"
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
          "margin": "-1px"
        }}>
            <span style={{
            "whiteSpace": "nowrap"
          }}>Toolbelt Mode</span>
          </legend>
          <div style={{
          "alignItems": "center",
          "columnGap": "2px",
          "display": "flex",
          "height": "28px",
          "justifyContent": "flex-start",
          "rowGap": "2px"
        }}>
            <div style={{
            "backgroundColor": "rgb(255, 255, 255)",
            "boxShadow": "rgba(0, 0, 0, 0.3) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.15) 0px 1px 3px 0px",
            "display": "flex",
            "height": "28px",
            "position": "absolute",
            "transform": "matrix(1, 0, 0, 1, 0, 0)",
            "transformOrigin": "14px 14px",
            "width": "28px",
            "minWidth": "0px",
            "minHeight": "0px",
            "borderRadius": "3px"
          }} aria-hidden="true"></div>
            <div style={{
            "alignItems": "center",
            "boxSizing": "border-box",
            "display": "flex",
            "height": "28px",
            "justifyContent": "center",
            "position": "relative",
            "width": "28px",
            "border": "1px solid rgba(255, 255, 255, 0)",
            "borderRadius": "3px"
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
              "height": "26px",
              "left": "0px",
              "lineHeight": "16px",
              "opacity": "0",
              "overflowX": "visible",
              "overflowY": "visible",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "26px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "50%",
              "padding": "0px"
            }} type="radio" value="slides" checked={true}></input>
              <span style={{
              "display": "block"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1m1.68 9H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.662 2.365a.5.5 0 0 1-.963.27L14.28 16H9.719l-.738 2.635a.5.5 0 0 1-.962-.27zM8.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
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
              "lineHeight": "16px",
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
              }}>Slides mode</span>
              </label>
            </div>
            <div style={{
            "alignItems": "center",
            "display": "flex",
            "height": "28px",
            "justifyContent": "center",
            "position": "relative",
            "width": "28px",
            "borderRadius": "3px"
          }}>
              <input style={{
              "appearance": "auto",
              "backgroundColor": "rgba(0, 0, 0, 0)",
              "bottom": "0px",
              "color": "rgb(84, 84, 84)",
              "display": "block",
              "fontFamily": "Inter, sans-serif",
              "fontSize": "11px",
              "fontWeight": "400",
              "height": "28px",
              "left": "0px",
              "lineHeight": "16px",
              "opacity": "0",
              "overflowX": "visible",
              "overflowY": "visible",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "28px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "50%",
              "padding": "0px"
            }} disabled={true} type="radio" value="design"></input>
              <span style={{
              "display": "block"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.11 13.956c-.44-1.121.618-2.23 1.738-1.885l.108.038 4.15 1.63.115.051c1.136.556 1.027 2.254-.218 2.637l-1.205.372-.37 1.205c-.397 1.29-2.196 1.356-2.689.102zm1.48-.916a.425.425 0 0 0-.55.55l1.63 4.15c.138.35.618.356.775.038l.027-.068.526-1.711 1.711-.527a.425.425 0 0 0 .031-.802zM16.5 6A1.5 1.5 0 0 1 18 7.5v1a1.5 1.5 0 0 1-1.5 1.5H10v6.5A1.5 1.5 0 0 1 8.5 18h-1A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zM7 16.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V15h-.5a.5.5 0 0 1 0-1H9v-1h-.5a.5.5 0 0 1 0-1H9v-2H7zM7.5 7a.5.5 0 0 0-.5.5V9h2V7zM10 9h2v-.5a.5.5 0 0 1 1 0V9h1v-.5a.5.5 0 0 1 1 0V9h1.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H10z"></path>
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
              "lineHeight": "16px",
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
              }}>Open design tools</span>
              </label>
            </div>
          </div>
        </fieldset>
      </div>
    </div>;
}
export function MoveToolGroup({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Move" role="group" className={className}>
                    <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgb(255, 92, 22)",
      "boxSizing": "border-box",
      "color": "rgb(255, 255, 255)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="false" aria-label="Move" aria-pressed="true" type="button">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "rgb(255, 255, 255)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
  </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button">
  <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </span>
</button>
                  </div>;
}
export function MoveToolGroup2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Move" role="group" className={className}>
  <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgb(13, 153, 255)",
      "boxSizing": "border-box",
      "color": "rgb(255, 255, 255)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true">
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgb(255, 255, 255)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
    </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>;
}
export function RectangleToolGroup({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Rectangle" role="group" className={className}>
  <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "rgba(0, 0, 0, 0.3)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
    </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>;
}
export function PenToolGroup({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Pen" role="group" className={className}>
  <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "rgba(0, 0, 0, 0.3)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
    </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>;
}
export function TextToolGroup({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Text" role="group" className={className}>
  <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "rgba(0, 0, 0, 0.3)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
    </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>;
}
export function EditorNavigationRail({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
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
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 57,
    ...style
  }} aria-label="Navigation Bar" role="toolbar" aria-orientation="vertical" className={className}>
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
                        </div>;
}
export function EditorHeaderActions({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "center",
    "display": "flex",
    "height": "48px",
    "justifyContent": "space-between",
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
      "alignItems": "center",
      "display": "flex",
      "flexGrow": "1",
      "marginLeft": "12px",
      "minWidth": "0px"
    }}>
                <span style={{
        "alignItems": "center",
        "columnGap": "4px",
        "display": "flex",
        "flexGrow": "1",
        "height": "40px",
        "isolation": "isolate",
        "justifyContent": "flex-start",
        "marginRight": "4px",
        "rowGap": "4px",
        "minWidth": "0px"
      }}>
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
                        <div style={{
                "display": "contents",
                "minWidth": "0px",
                "minHeight": "0px"
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
                  "height": "24px",
                  "justifyContent": "center",
                  "lineHeight": "16px",
                  "outlineColor": "rgba(0, 0, 0, 0)",
                  "outlineStyle": "solid",
                  "outlineWidth": "2px",
                  "position": "relative",
                  "textAlign": "center",
                  "borderRadius": "50px",
                  "padding": "0px 2px 0px 0px"
                }} aria-expanded="false" aria-label="Multiplayer tools" aria-haspopup="dialog">
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
                                    "stroke": "rgb(255, 92, 22)",
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
                                      "color": "rgb(255, 255, 255)",
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
                                    }} aria-label="Quan Vu (Richard)" role="img">
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
                                      }} src="https://s3-alpha.figma.com/profile/2352a4b9-1db3-49d6-bb4d-651586207271" alt=""></img>
              <span style={{
                                        "bottom": "0px",
                                        "boxShadow": "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset",
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
                        "maskImage": "radial-gradient(14px at -3px 50%, rgba(0, 0, 0, 0) 99%, rgb(255, 255, 255) 100%)",
                        "padding": "6px",
                        "margin": "-6px"
                      }}>
                                  <span style={{
                          "alignItems": "center",
                          "display": "flex"
                        }}>
  <div style={{
                            "alignItems": "center",
                            "backgroundColor": "rgb(245, 245, 245)",
                            "boxSizing": "content-box",
                            "color": "rgba(0, 0, 0, 0.5)",
                            "display": "flex",
                            "height": "24px",
                            "justifyContent": "center",
                            "width": "24px",
                            "border": "2px solid rgb(255, 255, 255)",
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
                                "fill": "rgba(0, 0, 0, 0.898)"
                              }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </div>
</span>
                                </span>
                              </span>
                            </div>
                          </button>
                        </div>
                      </span>
                    </span>
                  </div>
                </span>
              </div>
              <div style={{
      "columnGap": "8px",
      "rowGap": "8px"
    }}>
                <div style={{
        "alignItems": "center",
        "display": "flex"
      }}>
                  <div style={{
          "alignItems": "center",
          "display": "flex",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "position": "relative",
          "borderRadius": "5px"
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
            "height": "32px",
            "justifyContent": "center",
            "justifyItems": "center",
            "lineHeight": "16px",
            "position": "relative",
            "textAlign": "start",
            "width": "32px",
            "padding": "0px"
          }} aria-label="Present" aria-haspopup="dialog" aria-expanded="false" type="button">
                      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path style={{
                "fill": "rgba(0, 0, 0, 0.898)"
              }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z" clipRule="evenodd"></path>
                      </svg>
                    </button>
                  </div>
                  <div style={{
          "marginBottom": "8px",
          "marginRight": "4px",
          "marginTop": "8px",
          "position": "relative"
        }}>
                    <div style={{
            "alignItems": "center",
            "display": "flex",
            "marginLeft": "4px",
            "marginRight": "4px"
          }}>
                      <button style={{
              "alignItems": "center",
              "appearance": "auto",
              "backgroundColor": "rgb(255, 92, 22)",
              "color": "rgb(255, 255, 255)",
              "display": "flex",
              "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
              "fontSize": "11px",
              "fontWeight": "450",
              "height": "32px",
              "justifyItems": "center",
              "letterSpacing": "0.05504px",
              "lineHeight": "16px",
              "maxWidth": "100%",
              "position": "relative",
              "textAlign": "center",
              "borderRadius": "5px",
              "padding": "0px 12px",
              "width": "64px",
              "minWidth": "64px",
              "flexShrink": "0",
              "boxSizing": "border-box",
              "justifyContent": "center"
            }} type="button">
                        <span style={{
                "display": "flex",
                "height": "32px",
                "width": "auto",
                "flexShrink": "0",
                "alignItems": "center",
                "justifyContent": "center"
              }}>
                          <span style={{
                  "alignItems": "center",
                  "display": "flex",
                  "justifyContent": "center",
                  "marginLeft": "0px",
                  "marginRight": "0px",
                  "overflowX": "visible",
                  "overflowY": "visible"
                }}>
                            <span style={{
                    "display": "block",
                    "overflowX": "visible",
                    "overflowY": "visible",
                    "textOverflow": "clip",
                    "whiteSpace": "nowrap"
                  }}>
                              <span style={{
                      "display": "contents"
                    }}>
                                <span style={{
                        "whiteSpace": "nowrap"
                      }}>Share</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>;
}
export function InspectorTabsAndZoom({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "alignItems": "flex-end",
    "borderBottomColor": "rgb(230, 230, 230)",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "boxSizing": "content-box",
    "display": "flex",
    "height": "32px",
    "justifyContent": "space-between",
    "wordBreak": "keep-all",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 240,
    ...style
  }} className={className}>
            <div style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "columnGap": "8px",
      "display": "flex",
      "flexShrink": "0",
      "height": "40px",
      "justifyContent": "flex-start",
      "paddingLeft": "8px",
      "rowGap": "8px"
    }}>
              <div style={{
        "columnGap": "4px",
        "display": "flex",
        "rowGap": "4px"
      }} role="tablist" aria-orientation="horizontal">
                <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgb(245, 245, 245)",
          "boxSizing": "border-box",
          "color": "rgba(0, 0, 0, 0.898)",
          "display": "grid",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "11px",
          "fontWeight": "550",
          "gridTemplateColumns": "37.0156px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyContent": "center",
          "letterSpacing": "0.05504px",
          "lineHeight": "16px",
          "textAlign": "center",
          "whiteSpace": "nowrap",
          "borderRadius": "5px",
          "padding": "0px 8px"
        }} type="button" role="tab" aria-selected="true">
                  <span style={{
            "display": "block",
            "gridColumnStart": "1",
            "gridRowStart": "1",
            "opacity": "0"
          }} aria-hidden="true">
                    <span style={{
              "whiteSpace": "nowrap"
            }}>Design</span>
                  </span>
                  <span style={{
            "display": "block",
            "gridColumnStart": "1",
            "gridRowStart": "1"
          }}>
                    <span style={{
              "whiteSpace": "nowrap"
            }}>Design</span>
                  </span>
                </button>
                <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgb(255, 255, 255)",
          "boxSizing": "border-box",
          "color": "rgba(0, 0, 0, 0.5)",
          "display": "grid",
          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
          "fontSize": "11px",
          "fontWeight": "450",
          "gridTemplateColumns": "44.3125px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyContent": "center",
          "letterSpacing": "0.05504px",
          "lineHeight": "16px",
          "textAlign": "center",
          "whiteSpace": "nowrap",
          "borderRadius": "5px",
          "padding": "0px 8px"
        }} type="button" role="tab" aria-selected="false">
                  <span style={{
            "display": "block",
            "fontWeight": "550",
            "gridColumnStart": "1",
            "gridRowStart": "1",
            "opacity": "0"
          }} aria-hidden="true">
                    <span style={{
              "whiteSpace": "nowrap"
            }}>Animate</span>
                  </span>
                  <span style={{
            "display": "block",
            "gridColumnStart": "1",
            "gridRowStart": "1"
          }}>
                    <span style={{
              "whiteSpace": "nowrap"
            }}>Animate</span>
                  </span>
                </button>
              </div>
            </div>
            <div style={{
      "alignItems": "center",
      "boxSizing": "content-box",
      "display": "flex",
      "height": "40px",
      "justifyContent": "space-between",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "paddingRight": "8px"
    }}>
              <div style={{
        "display": "contents",
        "minWidth": "0px",
        "minHeight": "0px"
      }} role="presentation">
                <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgb(255, 255, 255)",
          "boxSizing": "border-box",
          "color": "rgb(0, 0, 0)",
          "display": "flex",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontVariant": "tabular-nums",
          "fontVariantNumeric": "tabular-nums",
          "fontWeight": "400",
          "justifyItems": "center",
          "lineHeight": "16px",
          "marginLeft": "1px",
          "textAlign": "start",
          "borderRadius": "5px",
          "padding": "4px 4px 4px 12px"
        }} aria-label="100%, zoom and view options" aria-haspopup="menu" aria-expanded="false" type="button">
                  100%
                  <svg style={{
            "display": "block",
            "fontVariant": "tabular-nums",
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
              </div>
            </div>
          </div>;
}
export function EditorToolbar2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
    "display": "flex",
    "height": "48px",
    "borderRadius": "13px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 360,
    ...style
  }} aria-label="Editor" role="toolbar" aria-orientation="horizontal" className={className}>
        <div style={{
      "height": "48px",
      "overflowX": "clip",
      "width": "265px"
    }}>
          <div style={{
        "alignItems": "flex-start",
        "display": "flex",
        "flexDirection": "column",
        "transform": "matrix(1, 0, 0, 1, 0, 0)",
        "transformOrigin": "132.5px 48px"
      }}>
            <div>
              <div style={{
            "boxSizing": "border-box",
            "columnGap": "8px",
            "display": "flex",
            "height": "48px",
            "rowGap": "8px",
            "padding": "8px"
          }}>
                <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
                  <div style={{
                "display": "contents"
              }} role="presentation">
                    <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Move" role="group">
                      <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(255, 92, 22)",
                    "boxSizing": "border-box",
                    "color": "rgb(255, 255, 255)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="false" aria-label="Move" aria-pressed="true" type="button">
  <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                        "fill": "rgb(255, 255, 255)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
  </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button">
  <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </span>
</button>
                    </div>
                  </div>
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
                "padding": "4px"
              }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
                    </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Image/video…" aria-pressed="false" type="button">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
                    </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Shapes" aria-pressed="false" type="button">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
                    </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Comment" aria-pressed="false" type="button">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Actions" aria-pressed="false" type="button">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                  </button>
                </div>
              </div>
            </div>
            <div style={{
          "visibility": "hidden"
        }}>
              <div style={{
            "boxSizing": "border-box",
            "columnGap": "8px",
            "display": "flex",
            "height": "48px",
            "rowGap": "8px",
            "padding": "8px"
          }}>
                <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
                  <div style={{
                "display": "contents"
              }} role="presentation">
                    <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Move" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(13, 153, 255)",
                    "boxSizing": "border-box",
                    "color": "rgb(255, 255, 255)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgb(255, 255, 255)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                  </div>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
</svg>
                  </button>
                  <div style={{
                "display": "contents"
              }} role="presentation">
                    <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Rectangle" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                  </div>
                  <div style={{
                "display": "contents"
              }} role="presentation">
                    <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Pen" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                  </div>
                  <div style={{
                "display": "contents"
              }} role="presentation">
                    <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Text" role="group">
  <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true">
    <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
    </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
    <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>
</div>
                  </div>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
</svg>
                  </button>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Actions" aria-pressed="false" type="button" aria-disabled="true">
                    <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
</svg>
                  </button>
                  <div>
                    <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "display": "inline-flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "borderRadius": "9999px",
                  "padding": "4px"
                }} aria-hidden="true" aria-label="Assets" type="button" aria-disabled="true">
  <div style={{
                    "color": "rgba(0, 0, 0, 0.3)",
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
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
    </svg>
  </div>
</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{
      "alignSelf": "stretch",
      "backgroundColor": "rgb(230, 230, 230)",
      "width": "1px"
    }}></div>
        <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "justifyContent": "center",
      "padding": "8px"
    }}>
          <fieldset style={{
        "backgroundColor": "rgb(245, 245, 245)",
        "boxSizing": "border-box",
        "display": "flex",
        "height": "32px",
        "marginLeft": "0px",
        "marginRight": "0px",
        "minWidth": "min-content",
        "position": "relative",
        "borderRadius": "5px",
        "padding": "2px"
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
          "margin": "-1px"
        }}>
              <span style={{
            "whiteSpace": "nowrap"
          }}>Toolbelt Mode</span>
            </legend>
            <div style={{
          "alignItems": "center",
          "columnGap": "2px",
          "display": "flex",
          "height": "28px",
          "justifyContent": "flex-start",
          "rowGap": "2px"
        }}>
              <div style={{
            "backgroundColor": "rgb(255, 255, 255)",
            "boxShadow": "rgba(0, 0, 0, 0.3) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.15) 0px 1px 3px 0px",
            "display": "flex",
            "height": "28px",
            "position": "absolute",
            "transform": "matrix(1, 0, 0, 1, 0, 0)",
            "transformOrigin": "14px 14px",
            "width": "28px",
            "minWidth": "0px",
            "minHeight": "0px",
            "borderRadius": "3px"
          }} aria-hidden="true"></div>
              <div style={{
            "alignItems": "center",
            "boxSizing": "border-box",
            "display": "flex",
            "height": "28px",
            "justifyContent": "center",
            "position": "relative",
            "width": "28px",
            "border": "1px solid rgba(255, 255, 255, 0)",
            "borderRadius": "3px"
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
              "height": "26px",
              "left": "0px",
              "lineHeight": "16px",
              "opacity": "0",
              "overflowX": "visible",
              "overflowY": "visible",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "26px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "50%",
              "padding": "0px"
            }} type="radio" value="slides" checked={true}></input>
                <span style={{
              "display": "block"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1m1.68 9H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.662 2.365a.5.5 0 0 1-.963.27L14.28 16H9.719l-.738 2.635a.5.5 0 0 1-.962-.27zM8.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
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
              "lineHeight": "16px",
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
              }}>Slides mode</span>
                </label>
              </div>
              <div style={{
            "alignItems": "center",
            "display": "flex",
            "height": "28px",
            "justifyContent": "center",
            "position": "relative",
            "width": "28px",
            "borderRadius": "3px"
          }}>
                <input style={{
              "appearance": "auto",
              "backgroundColor": "rgba(0, 0, 0, 0)",
              "bottom": "0px",
              "color": "rgb(84, 84, 84)",
              "display": "block",
              "fontFamily": "Inter, sans-serif",
              "fontSize": "11px",
              "fontWeight": "400",
              "height": "28px",
              "left": "0px",
              "lineHeight": "16px",
              "opacity": "0",
              "overflowX": "visible",
              "overflowY": "visible",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "28px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "50%",
              "padding": "0px"
            }} disabled={true} type="radio" value="design"></input>
                <span style={{
              "display": "block"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.11 13.956c-.44-1.121.618-2.23 1.738-1.885l.108.038 4.15 1.63.115.051c1.136.556 1.027 2.254-.218 2.637l-1.205.372-.37 1.205c-.397 1.29-2.196 1.356-2.689.102zm1.48-.916a.425.425 0 0 0-.55.55l1.63 4.15c.138.35.618.356.775.038l.027-.068.526-1.711 1.711-.527a.425.425 0 0 0 .031-.802zM16.5 6A1.5 1.5 0 0 1 18 7.5v1a1.5 1.5 0 0 1-1.5 1.5H10v6.5A1.5 1.5 0 0 1 8.5 18h-1A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zM7 16.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V15h-.5a.5.5 0 0 1 0-1H9v-1h-.5a.5.5 0 0 1 0-1H9v-2H7zM7.5 7a.5.5 0 0 0-.5.5V9h2V7zM10 9h2v-.5a.5.5 0 0 1 1 0V9h1v-.5a.5.5 0 0 1 1 0V9h1.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H10z"></path>
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
              "lineHeight": "16px",
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
              }}>Open design tools</span>
                </label>
              </div>
            </div>
          </fieldset>
        </div>
      </div>;
}
export function MoveToolGroup3({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Move" role="group" className={className}>
                      <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgb(255, 92, 22)",
      "boxSizing": "border-box",
      "color": "rgb(255, 255, 255)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="false" aria-label="Move" aria-pressed="true" type="button">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "rgb(255, 255, 255)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
  </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button">
  <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
    </svg>
  </span>
</button>
                    </div>;
}
export function MoveToolMenu({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "backgroundColor": "rgb(30, 30, 30)",
    "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.12) 0px 10px 16px 0px, rgba(0, 0, 0, 0.12) 0px 0px 0.5px 0px",
    "boxSizing": "border-box",
    "color": "rgba(0, 0, 0, 0.898)",
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
  }} className={className}>
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
            "color": "rgba(0, 0, 0, 0.898)",
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
            "color": "rgb(255, 255, 255)",
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
                  "fill": "rgb(255, 255, 255)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
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
                    "fill": "rgb(255, 255, 255)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M6.586 6.586a2 2 0 0 1 2.005-.497l.14.05 9 3.535a2.002 2.002 0 0 1-.143 3.773l-3.167.974-.974 3.167a2 2 0 0 1-3.773.142l-3.535-9a2 2 0 0 1 .447-2.144m1.78.483a1 1 0 0 0-1.073.224l-.097.111a1 1 0 0 0-.127.961l3.536 9a1 1 0 0 0 .811.627l.157.007a1 1 0 0 0 .86-.559l.058-.146 1.13-3.673 3.673-1.13a1 1 0 0 0 .686-.762l.02-.156a1 1 0 0 0-.493-.9l-.142-.069z"></path>
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
            "color": "rgb(255, 255, 255)",
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
                  "fill": "rgb(255, 255, 255)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
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
                    "fill": "rgb(255, 255, 255)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6.5v4a.5.5 0 0 0 1 0v-3a.5.5 0 0 1 1 0v3a.5.5 0 0 0 1 0v-2a.5.5 0 0 1 1 0v4.272l.002.097.002.03-.002.016c-.095 1.35-.514 2.358-1.147 3.021-.619.648-1.536 1.064-2.847 1.064q-.258 0-.493-.012c-2-.097-3.577-1.723-4.963-3.836a6 6 0 0 1-.153-.242c-.217-.374-.345-.632-.388-.823l-.01-.07a.2.2 0 0 1 .08-.053.2.2 0 0 1 .094-.004c.106.014.28.085.469.262l.08.068.673.508A1 1 0 0 0 9 12V7.5a.5.5 0 0 1 1 0v3a.5.5 0 0 0 1 0v-4a.5.5 0 0 1 1 0m5 2v4.272l.002.072c.002.048.005.095-.002.141C16.786 16.01 15.087 18 12.008 18q-.282 0-.541-.013c-2.536-.123-4.36-2.164-5.752-4.287a7 7 0 0 1-.18-.286c-.423-.727-.831-1.533-.236-2.11.493-.478 1.147-.424 1.701-.068q.172.11.327.256L8 12V7.5a1.5 1.5 0 0 1 2.053-1.395 1.5 1.5 0 0 1 2.894 0q.26-.103.553-.105a1.5 1.5 0 0 1 1.447 1.105q.26-.103.553-.105A1.5 1.5 0 0 1 17 8.5" clipRule="evenodd"></path>
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
            "color": "rgb(255, 255, 255)",
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
                  "fill": "rgb(255, 255, 255)"
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
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
                    "fill": "rgb(255, 255, 255)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.5 9a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-1.793l-2.148 2.147c.093.196.148.415.148.646v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 6 16.5v-3A1.5 1.5 0 0 1 7.5 12h3c.231 0 .449.054.645.148L13.293 10H11.5a.5.5 0 0 1 0-1zM16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2a.5.5 0 0 1 0-1h2a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a.5.5 0 0 1-1 0V8a2 2 0 0 1 2-2zm-8.5 7a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z"></path>
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
export function ShapesEditorToolbar({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
    "display": "flex",
    "height": "48px",
    "borderRadius": "13px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 720,
    ...style
  }} aria-label="Editor" role="toolbar" aria-orientation="horizontal" className={className}>
        <div style={{
      "height": "48px",
      "overflowX": "clip",
      "width": "265px"
    }}>
          <div style={{
        "alignItems": "flex-start",
        "display": "flex",
        "flexDirection": "column",
        "transform": "matrix(1, 0, 0, 1, 0, 0)",
        "transformOrigin": "132.5px 48px"
      }}>
            <div>
              <div style={{
            "boxSizing": "border-box",
            "columnGap": "8px",
            "display": "flex",
            "height": "48px",
            "rowGap": "8px",
            "padding": "8px"
          }}>
                <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
                  <div style={{
                "display": "contents"
              }} role="presentation">
  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Move" role="group">
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
                    "padding": "4px"
                  }} aria-hidden="false" aria-label="Move" aria-pressed="false" type="button">
      <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                        "fill": "rgba(0, 0, 0, 0.898)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button">
      <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>
</div>
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
                "padding": "4px"
              }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
  </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Image/video…" aria-pressed="false" type="button">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
  </svg>
</button>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgb(255, 92, 22)",
                "boxSizing": "border-box",
                "color": "rgb(255, 255, 255)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Shapes" aria-pressed="true" type="button">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgb(255, 255, 255)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Comment" aria-pressed="false" type="button">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
  </svg>
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
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="false" aria-label="Actions" aria-pressed="false" type="button">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.898)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
  </svg>
</button>
                </div>
              </div>
            </div>
            <div style={{
          "visibility": "hidden"
        }}>
              <div style={{
            "boxSizing": "border-box",
            "columnGap": "8px",
            "display": "flex",
            "height": "48px",
            "rowGap": "8px",
            "padding": "8px"
          }}>
                <div style={{
              "display": "contents",
              "minWidth": "0px",
              "minHeight": "0px"
            }}>
                  <div style={{
                "display": "contents"
              }} role="presentation">
  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Move" role="group">
    <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgb(13, 153, 255)",
                    "boxSizing": "border-box",
                    "color": "rgb(255, 255, 255)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true">
      <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                        "fill": "rgb(255, 255, 255)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>
</div>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Frame" aria-pressed="false" type="button" aria-disabled="true">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
  </svg>
</button>
                  <div style={{
                "display": "contents"
              }} role="presentation">
  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Rectangle" role="group">
    <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
      </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>
</div>
                  <div style={{
                "display": "contents"
              }} role="presentation">
  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Pen" role="group">
    <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
      </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>
</div>
                  <div style={{
                "display": "contents"
              }} role="presentation">
  <div style={{
                  "columnGap": "1px",
                  "display": "flex",
                  "rowGap": "1px"
                }} aria-label="Text" role="group">
    <button style={{
                    "alignItems": "center",
                    "appearance": "auto",
                    "backgroundColor": "rgba(0, 0, 0, 0)",
                    "boxSizing": "border-box",
                    "color": "rgba(0, 0, 0, 0.3)",
                    "display": "flex",
                    "fontFamily": "Inter, sans-serif",
                    "fontSize": "11px",
                    "fontWeight": "400",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "borderRadius": "5px",
                    "padding": "4px"
                  }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
                      "display": "block",
                      "height": "24px",
                      "overflowX": "hidden",
                      "overflowY": "hidden",
                      "width": "24px"
                    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
      </svg>
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
                    "justifyContent": "center",
                    "justifyItems": "center",
                    "lineHeight": "16px",
                    "textAlign": "start",
                    "width": "16px",
                    "borderRadius": "5px",
                    "padding": "4px 0px"
                  }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
                      "display": "block"
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
                        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>
</div>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
  </svg>
</button>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "rgba(0, 0, 0, 0.3)",
                "display": "flex",
                "fontFamily": "Inter, sans-serif",
                "fontSize": "11px",
                "fontWeight": "400",
                "justifyItems": "center",
                "lineHeight": "16px",
                "textAlign": "start",
                "borderRadius": "5px",
                "padding": "4px"
              }} aria-hidden="true" aria-label="Actions" aria-pressed="false" type="button" aria-disabled="true">
  <svg style={{
                  "display": "block",
                  "height": "24px",
                  "overflowX": "hidden",
                  "overflowY": "hidden",
                  "width": "24px"
                }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
                    "fill": "rgba(0, 0, 0, 0.3)"
                  }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
  </svg>
</button>
                  <div>
  <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "rgb(0, 0, 0)",
                  "display": "inline-flex",
                  "fontFamily": "Inter, sans-serif",
                  "fontSize": "11px",
                  "fontWeight": "400",
                  "justifyItems": "center",
                  "lineHeight": "16px",
                  "textAlign": "start",
                  "borderRadius": "9999px",
                  "padding": "4px"
                }} aria-hidden="true" aria-label="Assets" type="button" aria-disabled="true">
    <div style={{
                    "color": "rgba(0, 0, 0, 0.3)",
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
                        "fill": "rgba(0, 0, 0, 0.3)"
                      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
      </svg>
    </div>
  </button>
</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{
      "alignSelf": "stretch",
      "backgroundColor": "rgb(230, 230, 230)",
      "width": "1px"
    }}></div>
        <div style={{
      "alignItems": "center",
      "boxSizing": "border-box",
      "display": "flex",
      "justifyContent": "center",
      "padding": "8px"
    }}>
          <fieldset style={{
        "backgroundColor": "rgb(245, 245, 245)",
        "boxSizing": "border-box",
        "display": "flex",
        "height": "32px",
        "marginLeft": "0px",
        "marginRight": "0px",
        "minWidth": "min-content",
        "position": "relative",
        "borderRadius": "5px",
        "padding": "2px"
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
          "margin": "-1px"
        }}>
              <span style={{
            "whiteSpace": "nowrap"
          }}>Toolbelt Mode</span>
            </legend>
            <div style={{
          "alignItems": "center",
          "columnGap": "2px",
          "display": "flex",
          "height": "28px",
          "justifyContent": "flex-start",
          "rowGap": "2px"
        }}>
              <div style={{
            "backgroundColor": "rgb(255, 255, 255)",
            "boxShadow": "rgba(0, 0, 0, 0.3) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.15) 0px 1px 3px 0px",
            "display": "flex",
            "height": "28px",
            "position": "absolute",
            "transform": "matrix(1, 0, 0, 1, 0, 0)",
            "transformOrigin": "14px 14px",
            "width": "28px",
            "minWidth": "0px",
            "minHeight": "0px",
            "borderRadius": "3px"
          }} aria-hidden="true"></div>
              <div style={{
            "alignItems": "center",
            "boxSizing": "border-box",
            "display": "flex",
            "height": "28px",
            "justifyContent": "center",
            "position": "relative",
            "width": "28px",
            "border": "1px solid rgba(255, 255, 255, 0)",
            "borderRadius": "3px"
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
              "height": "26px",
              "left": "0px",
              "lineHeight": "16px",
              "opacity": "0",
              "overflowX": "visible",
              "overflowY": "visible",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "26px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "50%",
              "padding": "0px"
            }} type="radio" value="slides" checked={true}></input>
                <span style={{
              "display": "block"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1m1.68 9H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.662 2.365a.5.5 0 0 1-.963.27L14.28 16H9.719l-.738 2.635a.5.5 0 0 1-.962-.27zM8.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
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
              "lineHeight": "16px",
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
              }}>Slides mode</span>
                </label>
              </div>
              <div style={{
            "alignItems": "center",
            "display": "flex",
            "height": "28px",
            "justifyContent": "center",
            "position": "relative",
            "width": "28px",
            "borderRadius": "3px"
          }}>
                <input style={{
              "appearance": "auto",
              "backgroundColor": "rgba(0, 0, 0, 0)",
              "bottom": "0px",
              "color": "rgb(84, 84, 84)",
              "display": "block",
              "fontFamily": "Inter, sans-serif",
              "fontSize": "11px",
              "fontWeight": "400",
              "height": "28px",
              "left": "0px",
              "lineHeight": "16px",
              "opacity": "0",
              "overflowX": "visible",
              "overflowY": "visible",
              "position": "absolute",
              "right": "0px",
              "top": "0px",
              "width": "28px",
              "minWidth": "0px",
              "minHeight": "0px",
              "borderRadius": "50%",
              "padding": "0px"
            }} disabled={true} type="radio" value="design"></input>
                <span style={{
              "display": "block"
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
                }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12.11 13.956c-.44-1.121.618-2.23 1.738-1.885l.108.038 4.15 1.63.115.051c1.136.556 1.027 2.254-.218 2.637l-1.205.372-.37 1.205c-.397 1.29-2.196 1.356-2.689.102zm1.48-.916a.425.425 0 0 0-.55.55l1.63 4.15c.138.35.618.356.775.038l.027-.068.526-1.711 1.711-.527a.425.425 0 0 0 .031-.802zM16.5 6A1.5 1.5 0 0 1 18 7.5v1a1.5 1.5 0 0 1-1.5 1.5H10v6.5A1.5 1.5 0 0 1 8.5 18h-1A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zM7 16.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V15h-.5a.5.5 0 0 1 0-1H9v-1h-.5a.5.5 0 0 1 0-1H9v-2H7zM7.5 7a.5.5 0 0 0-.5.5V9h2V7zM10 9h2v-.5a.5.5 0 0 1 1 0V9h1v-.5a.5.5 0 0 1 1 0V9h1.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H10z"></path>
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
              "lineHeight": "16px",
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
              }}>Open design tools</span>
                </label>
              </div>
            </div>
          </fieldset>
        </div>
      </div>;
}
export function MoveToolGroup4({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Move" role="group" className={className}>
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
      "padding": "4px"
    }} aria-hidden="false" aria-label="Move" aria-pressed="false" type="button">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.898)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="false" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button">
      <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>;
}
export function MoveToolGroup5({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Move" role="group" className={className}>
    <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgb(13, 153, 255)",
      "boxSizing": "border-box",
      "color": "rgb(255, 255, 255)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Move" aria-pressed="true" type="button" aria-disabled="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgb(255, 255, 255)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>;
}
export function RectangleToolGroup2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Rectangle" role="group" className={className}>
    <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "rgba(0, 0, 0, 0.3)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Rectangle" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
      </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Shape tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>;
}
export function PenToolGroup2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Pen" role="group" className={className}>
    <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "rgba(0, 0, 0, 0.3)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Pen" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
      </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Creation tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>;
}
export function TextToolGroup2({
  style,
  className
}: AirDesignComponentProps) {
  return <div style={{
    "columnGap": "1px",
    "display": "flex",
    "rowGap": "1px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Text" role="group" className={className}>
    <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "backgroundColor": "rgba(0, 0, 0, 0)",
      "boxSizing": "border-box",
      "color": "rgba(0, 0, 0, 0.3)",
      "display": "flex",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "borderRadius": "5px",
      "padding": "4px"
    }} aria-hidden="true" aria-label="Text" aria-pressed="false" type="button" aria-disabled="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
      </svg>
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
      "justifyContent": "center",
      "justifyItems": "center",
      "lineHeight": "16px",
      "textAlign": "start",
      "width": "16px",
      "borderRadius": "5px",
      "padding": "4px 0px"
    }} aria-hidden="true" aria-label="Type tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true">
      <span style={{
        "display": "block"
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
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
        </svg>
      </span>
    </button>
  </div>;
}
