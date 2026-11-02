import type { AirDesignProps } from "../types.js";

export function AdminNotificationsBadge({
  style,
  className,
  ...rest
}: AirDesignProps<"strong">) {
  return <strong style={{
    "alignItems": "center",
    "backgroundColor": "var(--ad-divider, rgb(230, 230, 230))",
    "boxSizing": "content-box",
    "color": "var(--ad-ink, rgba(0, 0, 0, 0.898))",
    "display": "inline-flex",
    "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
    "fontSize": "11px",
    "fontWeight": "450",
    "height": "16px",
    "letterSpacing": "0.05504px",
    "lineHeight": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "borderRadius": "5px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="2 admin notifications" className={className} {...rest}>
      <span style={{
      "display": "block",
      "flexGrow": "1",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "textOverflow": "ellipsis",
      "whiteSpace": "nowrap"
    }}>
        <span style={{
        "whiteSpace": "nowrap"
      }}>2</span>
      </span>
    </strong>;
}
