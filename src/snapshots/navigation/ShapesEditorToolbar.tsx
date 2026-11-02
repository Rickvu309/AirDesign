import type { AirDesignProps } from "../types.js";

export function ShapesEditorToolbar({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 3px 8px 0px, var(--ad-border, rgba(0, 0, 0, 0.1)) 0px 1px 3px 0px",
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
  }} aria-label="Editor" role="toolbar" aria-orientation="horizontal" className={className} {...rest}>
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
                    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                      }} d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
    </button>
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
                          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                        }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
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
                "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                  }} d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
  </svg>
</button>
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
                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                  }} d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm2.725 5.582a.5.5 0 0 1 .629.064l6.5 6.5a.5.5 0 1 1-.707.707L9 11.708l-2.146 2.146a.5.5 0 1 1-.708-.707l2.5-2.5zM14.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"></path>
  </svg>
</button>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "var(--ad-brand, rgb(255, 92, 22))",
                "boxSizing": "border-box",
                "color": "var(--ad-surface, rgb(255, 255, 255))",
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
                    "fill": "var(--ad-surface, rgb(255, 255, 255))"
                  }} fillRule="evenodd" d="M3 9c0 1.521.566 2.91 1.5 3.968a6 6 0 0 0 4 2.011.47.47 0 0 0 .5-.479.536.536 0 0 0-.49-.524H8.5a5 5 0 0 1-3.218-1.632A5 5 0 1 1 13.975 8.5l.001.008.013.073A.536.536 0 0 0 14.5 9a.47.47 0 0 0 .48-.5 6 6 0 0 0-2.012-4A6 6 0 0 0 3 9m9 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</button>
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
                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                  }} d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
  </svg>
</button>
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
                    "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
                  }} d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
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
                    "backgroundColor": "var(--ad-selection, rgb(13, 153, 255))",
                    "boxSizing": "border-box",
                    "color": "var(--ad-surface, rgb(255, 255, 255))",
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
                        "fill": "var(--ad-surface, rgb(255, 255, 255))"
                      }} d="M4.586 4.586a2 2 0 0 1 2.005-.497l.14.05 13 5.107a2 2 0 0 1 1.267 1.779v.159a2 2 0 0 1-1.26 1.782l-.15.053-5.024 1.545-1.545 5.024a2 2 0 0 1-1.677 1.398l-.158.012a2 2 0 0 1-1.938-1.267l-5.107-13a2 2 0 0 1 .447-2.145m1.78.484a1 1 0 0 0-1.073.223l-.097.112a1 1 0 0 0-.127.96l5.108 13a1 1 0 0 0 .811.628l.158.006a1 1 0 0 0 .859-.558l.058-.147 1.7-5.53 5.531-1.701a1 1 0 0 0 .687-.76l.018-.157a1 1 0 0 0-.492-.9l-.142-.069z"></path>
      </svg>
    </button>
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
                          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                        }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
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
                "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                  }} fillRule="evenodd" d="M7.5 4a.5.5 0 0 0-.5.5V7H4.5a.5.5 0 0 0 0 1H7v8H4.5a.5.5 0 0 0 0 1H7v2.5a.5.5 0 0 0 1 0V17h8v2.5a.5.5 0 0 0 1 0V17h2.5a.5.5 0 0 0 0-1H17V8h2.5a.5.5 0 0 0 0-1H17V4.5a.5.5 0 0 0-1 0V7H8V4.5a.5.5 0 0 0-.5-.5M16 8H8v8h8z" clipRule="evenodd"></path>
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
                    "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                      }} fillRule="evenodd" d="M18 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" clipRule="evenodd"></path>
      </svg>
    </button>
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
                          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                        }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
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
                    "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                      }} d="M4.886 3.21a1 1 0 0 1 .812-.19l7.698 1.56.338.076a7.67 7.67 0 0 1 5.806 7.266v.346l-.008.329 1.197 1.197a1 1 0 0 1 0 1.414l-5.523 5.522a1 1 0 0 1-1.413 0l-1.198-1.197-.328.008a7.67 7.67 0 0 1-7.612-5.806l-.077-.338L3.02 5.7a1 1 0 0 1 .274-.906l1.5-1.5zm.674 9.99a6.666 6.666 0 0 0 6.383 5.342h.3l.756-.018 1.5 1.5 5.523-5.522-1.5-1.5.018-.756a6.67 6.67 0 0 0-5.048-6.619l-.295-.066L5.5 4l-.396.397 5.16 5.16A3 3 0 0 1 12 9.001 3.001 3.001 0 0 1 12 15a3 3 0 0 1-2.444-4.737l-5.16-5.16L4 5.5zM12 10.001a2 2 0 0 0-2 2l.01.204a2 2 0 0 0 1.786 1.785L12 14a2 2 0 0 0 1.989-1.795l.01-.204a2 2 0 0 0-1.795-1.99z"></path>
      </svg>
    </button>
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
                          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                        }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
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
                    "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                      }} d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
      </svg>
    </button>
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
                          "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                        }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
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
                "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                  }} d="M12.5 3a8.5 8.5 0 0 1 0 17H7.09c-.89 0-1.39 0-1.767-.121l-.154-.06a2 2 0 0 1-.906-.828l-.082-.16c-.136-.297-.17-.657-.178-1.248L4 16.909V11.5A8.5 8.5 0 0 1 12.5 3m0 1A7.5 7.5 0 0 0 5 11.5v5.41c0 .523 0 .861.02 1.12.018.247.05.34.07.385a1 1 0 0 0 .495.494c.045.02.138.053.386.072.258.019.596.019 1.12.019H12.5a7.5 7.5 0 0 0 0-15"></path>
  </svg>
</button>
                  <button style={{
                "alignItems": "center",
                "appearance": "auto",
                "backgroundColor": "rgba(0, 0, 0, 0)",
                "boxSizing": "border-box",
                "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                    "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                  }} d="M9 13a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm7.5 0a.5.5 0 0 1 .5.5V16h2.5a.5.5 0 0 1 0 1H17v2.5a.5.5 0 0 1-1 0V17h-2.5a.5.5 0 0 1 0-1H16v-2.5a.5.5 0 0 1 .5-.5M6 14a1 1 0 0 0-1 1v3a1 1 0 0 0 .897.995L6 19h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm.87-10.275a1 1 0 0 1 1.337.068l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414l3-3zM16.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-12 3.5 3 3 3-3-3-3zm12-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"></path>
  </svg>
</button>
                  <div>
  <button style={{
                  "alignItems": "center",
                  "appearance": "auto",
                  "backgroundColor": "rgba(0, 0, 0, 0)",
                  "boxSizing": "border-box",
                  "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                    "color": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))",
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
                        "fill": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3))"
                      }} fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
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
      "backgroundColor": "var(--ad-divider, rgb(230, 230, 230))",
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
        "backgroundColor": "var(--ad-surface-subtle, rgb(245, 245, 245))",
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
            "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
            "boxShadow": "var(--ad-ink-subtle, rgba(0, 0, 0, 0.3)) 0px 0px 0.5px 0px, var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 1px 3px 0px",
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
              "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
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
                  "fill": "var(--ad-brand-strong, rgb(226, 76, 12))"
                }} fillRule="evenodd" d="M7 7h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1m1.68 9H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.662 2.365a.5.5 0 0 1-.963.27L14.28 16H9.719l-.738 2.635a.5.5 0 0 1-.962-.27zM8.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
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
                  "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
                }} d="M12.11 13.956c-.44-1.121.618-2.23 1.738-1.885l.108.038 4.15 1.63.115.051c1.136.556 1.027 2.254-.218 2.637l-1.205.372-.37 1.205c-.397 1.29-2.196 1.356-2.689.102zm1.48-.916a.425.425 0 0 0-.55.55l1.63 4.15c.138.35.618.356.775.038l.027-.068.526-1.711 1.711-.527a.425.425 0 0 0 .031-.802zM16.5 6A1.5 1.5 0 0 1 18 7.5v1a1.5 1.5 0 0 1-1.5 1.5H10v6.5A1.5 1.5 0 0 1 8.5 18h-1A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6zM7 16.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V15h-.5a.5.5 0 0 1 0-1H9v-1h-.5a.5.5 0 0 1 0-1H9v-2H7zM7.5 7a.5.5 0 0 0-.5.5V9h2V7zM10 9h2v-.5a.5.5 0 0 1 1 0V9h1v-.5a.5.5 0 0 1 1 0V9h1.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H10z"></path>
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
