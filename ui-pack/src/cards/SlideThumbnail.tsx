import type { AirDesignProps } from "../types.ts";

export function SlideThumbnail({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "display": "flex",
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
      "alignItems": "center",
      "aspectRatio": "16 / 9",
      "backgroundColor": "var(--ad-selection-subtle, rgb(242, 249, 255))",
      "display": "flex",
      "justifyContent": "center",
      "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
      "outlineStyle": "solid",
      "outlineWidth": "1px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "188px",
      "borderRadius": "5px"
    }}>
            <div style={{
        "alignItems": "flex-end",
        "boxSizing": "border-box",
        "columnGap": "4px",
        "display": "flex",
        "flexDirection": "column",
        "height": "105.75px",
        "left": "0px",
        "position": "absolute",
        "rowGap": "4px",
        "top": "0px",
        "width": "188px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "padding": "4px"
      }}></div>
            <img style={{
        "aspectRatio": "16 / 9",
        "display": "block",
        "height": "105.75px",
        "objectFit": "cover",
        "overflowX": "clip",
        "overflowY": "clip",
        "width": "188px"
      }} alt="" src="data:image/png;base64,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"></img>
          </div>
        </div>;
}
