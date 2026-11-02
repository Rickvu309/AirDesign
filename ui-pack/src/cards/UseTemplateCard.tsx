import type { AirDesignProps } from "../types.ts";

export function UseTemplateCard({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "aspectRatio": "1.25 / 1",
    "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
    "boxSizing": "border-box",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
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
    "textAlign": "start",
    "border": "1px solid var(--ad-divider, rgb(230, 230, 230))",
    "borderRadius": "13px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    width: 310,
    ...style
  }} aria-label="Use a template" type="button" className={className} {...rest}>
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
                      </button>;
}
