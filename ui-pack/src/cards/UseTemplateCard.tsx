import type { AirDesignComponentProps } from "../types.ts";

export function UseTemplateCard({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "aspectRatio": "1.25 / 1",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
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
    "border": "1px solid rgb(230, 230, 230)",
    "borderRadius": "13px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    width: 310,
    ...style
  }} aria-label="Use a template" type="button" className={className}>
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
        "color": "rgba(0, 0, 0, 0.898)",
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "550",
        "letterSpacing": "-0.032px",
        "lineHeight": "22px"
      }}>
  Use a template
</span>
                          <span style={{
        "color": "rgba(0, 0, 0, 0.5)",
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
          "border": "1px solid rgba(0, 0, 0, 0.1)",
          "borderRadius": "5px"
        }} alt="" src="https://static.figma.com/uploads/bc26f7aba942ed9012e84b07a510c6b17d291ecb" aria-hidden="true"></img>
  <img style={{
          "boxShadow": "rgba(0, 0, 0, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.18) 0px 10px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0.5px 0px",
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
          "border": "1px solid rgba(0, 0, 0, 0.1)",
          "borderRadius": "5px"
        }} alt="" src="https://static.figma.com/uploads/b47bf7fc72021ed470c7c2f65b194be3e49fcd0f" aria-hidden="true"></img>
</div>
                        </div>
                      </button>;
}
