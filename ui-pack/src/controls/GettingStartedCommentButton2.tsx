import type { AirDesignProps } from "../types.ts";

export function GettingStartedCommentButton2({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
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
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Comment" aria-pressed="false" type="button" aria-disabled="true" className={className} {...rest}>
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
                </button>;
}
