import type { AirDesignProps } from "../types.ts";

export function FileNameButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "display": "block",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "13px",
    "fontWeight": "550",
    "justifyItems": "center",
    "letterSpacing": "-0.032px",
    "lineHeight": "22px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textAlign": "start",
    "textOverflow": "ellipsis",
    "verticalAlign": "top",
    "whiteSpace": "nowrap",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Untitled, file name" type="button" className={className} {...rest}>
                        <span style={{
      "whiteSpace": "nowrap"
    }}>Untitled</span>
                      </button>;
}
