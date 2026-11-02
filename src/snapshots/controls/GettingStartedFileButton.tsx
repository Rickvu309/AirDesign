import type { AirDesignProps } from "../types.js";

export function GettingStartedFileButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
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
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-expanded="true" aria-label="File" type="button" className={className} {...rest}>
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
  </button>;
}
