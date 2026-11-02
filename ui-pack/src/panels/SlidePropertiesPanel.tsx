import type { AirDesignProps } from "../types.ts";

export function SlidePropertiesPanel({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
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
}} className={className} {...rest}>
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
            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
            "boxSizing": "border-box",
            "display": "flex",
            "flexDirection": "column",
            "minHeight": "799px",
            "paddingBottom": "50px",
            "position": "relative",
            "width": "240px"
          }}>
            <div style={{
              "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
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
                    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                            }} fillRule="evenodd" d="M18.5 14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V15h-1v3h.5a.5.5 0 0 1 0 1h-2a.5.5 0 1 1 0-1h.5v-3h-1v.5a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zM9.62 5.906c.513-1.205 2.248-1.205 2.762 0l.047.125.884 2.656 2.658.886c1.372.458 1.372 2.399 0 2.857l-2.658.884-.884 2.658c-.458 1.372-2.4 1.372-2.857 0l-.885-2.658-2.657-.884c-1.372-.458-1.372-2.4 0-2.857l2.657-.886.885-2.656zm1.825.352.011.028c-.173-.379-.74-.379-.912 0l.012-.028-.937-.352.92.392.005-.012-.035.097.012-.035-.949-.317.937.352-.874 2.62-.158.475-.474.159-2.656.885a.505.505 0 0 0 0 .96l2.656.884.474.158.158.474.886 2.657a.505.505 0 0 0 .959.001L12.364 13l.159-.475.474-.158 2.657-.885a.505.505 0 0 0 0-.959l-3.131-1.044-1.04-3.12.01.025.936-.352-.95.317.004.01-.027-.072.006.012.92-.392z" clipRule="evenodd"></path>
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
                "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
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
                          "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                        }} d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
                      </svg>
                    </div>
                    <h2 style={{
                      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                            }} d="M8.5 18a.5.5 0 0 0 .5-.5v-1.55a2.5 2.5 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v4.55a2.501 2.501 0 0 0 0 4.9v1.55a.5.5 0 0 0 .5.5m7 0a.5.5 0 0 0 .5-.5v-4.55a2.501 2.501 0 0 0 0-4.9V6.5a.5.5 0 0 0-1 0v1.55a2.5 2.5 0 0 0 0 4.9v4.55a.5.5 0 0 0 .5.5m0-6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-7 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"></path>
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
</button>
                    </div>
                    <button style={{
                      "alignItems": "center",
                      "appearance": "auto",
                      "backgroundColor": "rgba(0, 0, 0, 0)",
                      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                        }} d="M12.453 10.155a.5.5 0 0 0 .753.659l1.573-1.797a1.5 1.5 0 0 1 1.129-.512h1.36c.008 0 .013.01.007.016l-1.129 1.13a.501.501 0 0 0 .708.706l2-2a.5.5 0 0 0 0-.707l-1.999-2a.501.501 0 0 0-.709.707l1.13 1.13c.006.007.001.018-.008.018h-1.361a2.5 2.5 0 0 0-1.881.853zM5 8.003a.5.5 0 0 0 .5.5h1.59c.433 0 .844.187 1.13.513l5.804 6.633a2.5 2.5 0 0 0 1.88.854h1.386l-1.146 1.147a.5.5 0 0 0 0 .707.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0 0-.707l-2-2a.5.5 0 0 0-.708 0 .5.5 0 0 0 0 .707l1.146 1.146h-1.384c-.432 0-.845-.187-1.13-.512L8.974 8.356a2.5 2.5 0 0 0-1.882-.853H5.5a.5.5 0 0 0-.5.5m0 8.002a.5.5 0 0 0 .5.5h1.592a2.5 2.5 0 0 0 1.882-.854l1.574-1.8a.5.5 0 0 0-.753-.659l-1.574 1.8a1.5 1.5 0 0 1-1.129.513H5.5a.5.5 0 0 0-.5.5"></path>
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
                "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
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
                      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                      "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
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
                          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                          "boxShadow": "var(--ad-divider, rgb(230, 230, 230)) 0px 0px 0px 1px inset",
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
                              "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                            }} d="M9 9h6v6H9z"></path>
      <path style={{
                              "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                            }} fillRule="evenodd" d="M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3 7V9h6v6zM8 8.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5z" clipRule="evenodd"></path>
    </svg>
  </span>
  <label style={{
                          "clipPath": "inset(50%)",
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                              "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                            }} fillRule="evenodd" d="M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3.75.875a.875.875 0 1 1-1.75 0 .875.875 0 0 1 1.75 0m3.791.625a.625.625 0 1 0 0-1.25.625.625 0 0 0 0 1.25m-1.458.875a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m0 3.12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m1.458 2.245a.625.625 0 1 0 0-1.25.625.625 0 0 0 0 1.25m.625-3.865a.625.625 0 1 1-1.25 0 .625.625 0 0 1 1.25 0M8.875 15.99a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75m.875-4.115a.875.875 0 1 1-1.75 0 .875.875 0 0 1 1.75 0m5.75-1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m.5 2.623a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" clipRule="evenodd"></path>
    </svg>
  </span>
  <label style={{
                          "clipPath": "inset(50%)",
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                              "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                            }} d="M16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm2.225 4.082a.5.5 0 0 1 .629.064l4 4a.5.5 0 1 1-.707.707L10.5 12.208l-1.646 1.646a.5.5 0 1 1-.708-.707l2-2zM14.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"></path>
    </svg>
  </span>
  <label style={{
                          "clipPath": "inset(50%)",
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
                          "boxSizing": "border-box",
                          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
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
                                "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
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
                                  "boxShadow": "var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 0px 0px 2px inset",
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
                                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                              }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
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
                "borderBottomColor": "var(--ad-divider, rgb(230, 230, 230))",
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
                          "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                        }} d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
</svg>
                    </div>
                    <h2 style={{
                      "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                          "display": "flex",
                          "flexBasis": "0%",
                          "flexGrow": "1",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "11px",
                          "fontWeight": "450",
                          "height": "24px",
                          "justifyItems": "center",
                          "lineHeight": "16px",
                          "outlineColor": "var(--ad-divider, rgb(230, 230, 230))",
                          "outlineOffset": "-1px",
                          "outlineStyle": "solid",
                          "outlineWidth": "1px",
                          "textAlign": "start",
                          "minWidth": "0px",
                          "borderRadius": "5px",
                          "padding": "0px"
                        }} aria-label="Color Variable Black with value var(--ad-ink-strong, #000) at 100%" type="button">
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
                              "backgroundColor": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                            "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
                          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
                          "display": "flex",
                          "flexBasis": "0%",
                          "flexGrow": "1",
                          "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
                          "fontSize": "11px",
                          "fontWeight": "450",
                          "height": "24px",
                          "justifyItems": "center",
                          "lineHeight": "16px",
                          "outlineColor": "var(--ad-divider, rgb(230, 230, 230))",
                          "outlineOffset": "-1px",
                          "outlineStyle": "solid",
                          "outlineWidth": "1px",
                          "textAlign": "start",
                          "minWidth": "0px",
                          "borderRadius": "5px",
                          "padding": "0px"
                        }} aria-label="Color Variable White with value var(--ad-surface, #FFF) at 100%" type="button">
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
                              "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
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
                                "boxShadow": "var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 0px 0px 2px inset",
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
                            "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
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
