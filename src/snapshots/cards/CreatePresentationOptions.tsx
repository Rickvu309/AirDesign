import type { AirDesignProps } from "../types.js";

export function CreatePresentationOptions({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "boxSizing": "border-box",
    "columnGap": "24px",
    "display": "flex",
    "justifyContent": "center",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "rowGap": "24px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    flexShrink: 0,
    width: 644,
    ...style
  }} className={className} {...rest}>
                      <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "aspectRatio": "1.25 / 1",
      "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
      "boxSizing": "border-box",
      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
      "display": "flex",
      "flexBasis": "0px",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "11px",
      "fontWeight": "450",
      "height": "180px",
      "justifyItems": "center",
      "lineHeight": "16px",
      "maxHeight": "180px",
      "maxWidth": "312px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "start",
      "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
      "borderRadius": "13px",
      "padding": "0px"
    }} aria-label="Start from scratch" type="button">
                        <div style={{
        "alignItems": "center",
        "boxSizing": "content-box",
        "display": "flex",
        "flexDirection": "column",
        "left": "0px",
        "paddingLeft": "24px",
        "paddingRight": "24px",
        "position": "absolute",
        "right": "0px",
        "top": "24px",
        "minWidth": "0px",
        "minHeight": "0px"
      }} aria-hidden="true">
                          <span style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "block",
          "fontSize": "13px",
          "fontWeight": "550",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px"
        }}>
  Start from scratch
</span>
                          <span style={{
          "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
          "display": "block",
          "textAlign": "center"
        }}>
  Build using empty slides
</span>
                        </div>
                        <div style={{
        "display": "flex",
        "justifyContent": "center",
        "left": "0px",
        "position": "absolute",
        "right": "0px",
        "top": "99px",
        "minWidth": "0px",
        "minHeight": "0px"
      }}>
                          <img style={{
          "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.12) 0px 10px 16px 0px, rgba(0, 0, 0, 0.12) 0px 0px 0.5px 0px",
          "display": "block",
          "height": "110px",
          "objectFit": "cover",
          "objectPosition": "0% 0%",
          "overflowX": "clip",
          "overflowY": "clip",
          "transform": "matrix(1, 0, 0, 1, 0, 0)",
          "transformOrigin": "98px 55px",
          "width": "196px",
          "borderRadius": "5px"
        }} alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTYiIGhlaWdodD0iMTEwIiB2aWV3Qm94PSIwIDAgMTk2IDExMCI+PHJlY3Qgd2lkdGg9IjE5NiIgaGVpZ2h0PSIxMTAiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNNjIgMHYxMTAiIHN0cm9rZT0iI2U2ZTZlNiIvPjxyZWN0IHg9IjAiIHk9IjMyIiB3aWR0aD0iNjIiIGhlaWdodD0iNzgiIGZpbGw9IiNmYWZhZmEiLz48cmVjdCB4PSI4IiB5PSIzOCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI4IiByeD0iMiIgZmlsbD0iI2VlZSIvPjxyZWN0IHg9IjgiIHk9Ijc0IiB3aWR0aD0iNDQiIGhlaWdodD0iMjgiIHJ4PSIyIiBmaWxsPSIjZWVlIi8+PHJlY3QgeD0iNzUiIHk9IjM0IiB3aWR0aD0iMTA2IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZTZlNmU2Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOCA1KSBzY2FsZSguMjMpIj48cGF0aCBkPSJNMTMgNTdsMTktNTAgMTkgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFhMWExYSIgc3Ryb2tlLXdpZHRoPSIzLjA2MyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTYgNDRsNTItMTQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmNThhZSIgc3Ryb2tlLXdpZHRoPSIyLjE4OCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9nPjwvc3ZnPg==" aria-hidden="true"></img>
                        </div>
                      </button>
                      <button style={{
      "alignItems": "center",
      "appearance": "auto",
      "aspectRatio": "1.25 / 1",
      "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
      "boxSizing": "border-box",
      "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
      "display": "flex",
      "flexBasis": "0px",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontSize": "11px",
      "fontWeight": "450",
      "height": "180px",
      "justifyItems": "center",
      "lineHeight": "16px",
      "maxHeight": "180px",
      "maxWidth": "312px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "position": "relative",
      "textAlign": "start",
      "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
      "borderRadius": "13px",
      "padding": "0px"
    }} aria-label="Use a template" type="button">
                        <div style={{
        "alignItems": "center",
        "boxSizing": "content-box",
        "display": "flex",
        "flexDirection": "column",
        "left": "0px",
        "paddingLeft": "24px",
        "paddingRight": "24px",
        "position": "absolute",
        "right": "0px",
        "top": "24px",
        "minWidth": "0px",
        "minHeight": "0px"
      }} aria-hidden="true">
                          <span style={{
          "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
          "display": "block",
          "fontSize": "13px",
          "fontWeight": "550",
          "letterSpacing": "-0.032px",
          "lineHeight": "22px"
        }}>
  Use a template
</span>
                          <span style={{
          "color": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))",
          "display": "block",
          "textAlign": "center"
        }}>
  Browse AirDesign and team-made decks
</span>
                        </div>
                        <div style={{
        "display": "flex",
        "justifyContent": "center",
        "left": "0px",
        "position": "absolute",
        "right": "0px",
        "top": "99px",
        "minWidth": "0px",
        "minHeight": "0px"
      }}>
                          <div style={{
          "height": "129px",
          "position": "relative",
          "width": "205px"
        }}>
  <img style={{
            "boxSizing": "border-box",
            "display": "block",
            "height": "104px",
            "left": "14px",
            "objectFit": "cover",
            "objectPosition": "0% 0%",
            "overflowX": "clip",
            "overflowY": "clip",
            "position": "absolute",
            "top": "0px",
            "transform": "matrix(0.997224, 0.0744566, -0.0744566, 0.997224, 0, 0)",
            "transformOrigin": "92px 52px",
            "width": "184px",
            "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
            "borderRadius": "5px"
          }} alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" aria-hidden="true"></img>
  <img style={{
            "boxShadow": "var(--ad-border-strong, rgba(0, 0, 0, 0.15)) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
            "boxSizing": "border-box",
            "display": "block",
            "height": "104px",
            "left": "0px",
            "objectFit": "cover",
            "objectPosition": "0% 0%",
            "overflowX": "clip",
            "overflowY": "clip",
            "position": "absolute",
            "top": "12px",
            "transform": "matrix(0.997564, 0.0697565, -0.0697565, 0.997564, 0, 0)",
            "transformOrigin": "92px 52px",
            "width": "184px",
            "border": "1px solid var(--ad-border, rgba(0, 0, 0, 0.1))",
            "borderRadius": "5px"
          }} alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E" aria-hidden="true"></img>
</div>
                        </div>
                      </button>
                    </div>;
}
