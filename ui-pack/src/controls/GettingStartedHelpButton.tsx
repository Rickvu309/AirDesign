import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedHelpButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxShadow": "rgba(0, 0, 0, 0.18) 0px 0px 0.5px 0px, rgba(0, 0, 0, 0.1) 0px 3px 8px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
    "boxSizing": "border-box",
    "color": "rgb(255, 255, 255)",
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
    "border": "1px solid rgba(0, 0, 0, 0)",
    "borderRadius": "100%",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-haspopup="menu" aria-expanded="false" aria-label="Help" type="button" className={className}>
    <svg style={{
      "display": "block",
      "height": "32px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "30px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M11.69 16.572q.357 0 .61.254a.83.83 0 0 1 .26.616q0 .236-.12.435a.9.9 0 0 1-.315.32.84.84 0 0 1-.435.114.85.85 0 0 1-.615-.253.85.85 0 0 1-.254-.616.84.84 0 0 1 .254-.616.85.85 0 0 1 .615-.254m.332-10.884q1.002 0 1.763.416.76.41 1.19 1.13.428.712.428 1.635 0 .61-.193 1.111a2.9 2.9 0 0 1-.58.924 4.8 4.8 0 0 1-.954.797 4.6 4.6 0 0 0-.863.718 2.1 2.1 0 0 0-.459.815q-.138.453-.15 1.117c0 .18-.146.326-.326.326h-.44a.326.326 0 0 1-.327-.326q.006-.954.21-1.551.207-.598.604-1.009a5.5 5.5 0 0 1 1.003-.797q.447-.29.748-.61.308-.325.465-.711a2.2 2.2 0 0 0 .163-.852q0-.651-.307-1.14a2.04 2.04 0 0 0-.822-.755 2.45 2.45 0 0 0-1.153-.272q-.603 0-1.129.266a2.15 2.15 0 0 0-1.138 1.483c-.067.3-.312.545-.619.545-.323 0-.588-.269-.53-.587a3.12 3.12 0 0 1 1.678-2.268 3.7 3.7 0 0 1 1.738-.405" clipRule="evenodd"></path>
    </svg>
  </button>;
}
