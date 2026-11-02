import type { AirDesignProps } from "../types.js";

export function PresentButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "32px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "32px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Present" aria-haspopup="dialog" aria-expanded="false" type="button" className={className} {...rest}>
                      <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path style={{
        "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
      }} fillRule="evenodd" d="M6 5.903C6 4.43 7.604 3.517 8.87 4.269l10.15 6.028c1.307.776 1.305 2.669-.003 3.442l-10.15 5.995c-1.228.724-2.768-.11-2.863-1.5L6 18.098zm1 12.195a.9.9 0 0 0 1.357.774l10.152-5.995a1 1 0 0 0 .002-1.72L8.359 5.129A.9.9 0 0 0 7 5.903z" clipRule="evenodd"></path>
                      </svg>
                    </button>;
}
