import type { AirDesignProps } from "../types.js";

export function AgentSuggestions({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "columnGap": "8px",
    "display": "flex",
    "flexDirection": "column",
    "flexShrink": "0",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    width: 274,
    ...style
  }} className={className} {...rest}>
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
                      </div>;
}
