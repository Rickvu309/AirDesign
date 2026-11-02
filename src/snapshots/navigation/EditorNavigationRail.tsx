import type { AirDesignProps } from "../types.js";

export function EditorNavigationRail({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
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
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 57,
    ...style
  }} aria-label="Navigation Bar" role="toolbar" aria-orientation="vertical" className={className} {...rest}>
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
      }} aria-expanded="true" aria-label="File" type="button">
    <div style={{
          "alignItems": "center",
          "backgroundColor": "var(--ad-brand-subtle, rgb(255, 223, 204))",
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
              "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
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
                  "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
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
                        </div>;
}
