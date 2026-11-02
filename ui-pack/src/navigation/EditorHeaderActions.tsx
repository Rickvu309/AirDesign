import type { AirDesignComponentProps } from "../types.ts";

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
