import type { AirDesignComponentProps } from "../types.ts";

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
