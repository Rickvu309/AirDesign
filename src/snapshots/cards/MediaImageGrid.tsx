import type { AirDesignProps } from "../types.js";

export function MediaImageGrid({
  style,
  className,
  ...rest
}: AirDesignProps<"div">) {
  return <div style={{
    "columnGap": "8px",
    "display": "flex",
    "flexDirection": "column",
    "rowGap": "8px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 274,
    height: 480,
    overflowY: "auto",
    ...style
  }} className={className} {...rest}>
              <div style={{
      "aspectRatio": "0.666667 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A woman in a white patterned dress standing against a stone wall covered in ivy" src="https://images.unsplash.com/photo-1793291275774-23ae799f2ac8?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyfHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
                  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A woman in a white patterned dress standing against a stone wall covered in ivy" type="button">
  <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
    <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "0.665344 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "200.164px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" src="https://images.unsplash.com/photo-1793463986813-7e1b6370ca4a?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw0fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
                  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for Neuschwanstein Castle nestled in a forested mountain landscape with snow-capped peaks in the distance" type="button">
  <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
    <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "1.77753 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "75.1406px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A short-eared owl in flight over a field of dry golden grass" src="https://images.unsplash.com/photo-1793449162784-fa77abd22ef2?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw3fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
                  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A short-eared owl in flight over a field of dry golden grass" type="button">
  <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
    <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "0.670279 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "198.164px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A sharp triangular patch of sunlight on a tiled floor and textured wall" src="https://images.unsplash.com/photo-1793531110179-6af052479cc5?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHw5fHx8fHx8fHwxNzkzNjE5MDI5fA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
                  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A sharp triangular patch of sunlight on a tiled floor and textured wall" type="button">
  <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
    <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
    </svg>
  </span>
</button>
                </div>
              </div>
              <div style={{
      "aspectRatio": "0.666667 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
                  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" src="https://images.unsplash.com/photo-1793559141324-6e65850719b0?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxMXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
                </button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for An ornate stone colonnade under a clear blue sky, framed by green leaves in golden light" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.49978 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" src="https://images.unsplash.com/photo-1792980205896-4bc34b91b040?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A bright kitchen with cream cabinets, a stainless steel range, and a marble countertop" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "0.666667 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A smooth white stone on a textured rock beside a dropper bottle and dried lavender" src="https://images.unsplash.com/photo-1793100123531-4924ea242f5f?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A smooth white stone on a textured rock beside a dropper bottle and dried lavender" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.49978 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A wooden dining table with chairs and a bowl of apples in a sunlit room" src="https://images.unsplash.com/photo-1793143765092-dd507da9bffe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwxOHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A wooden dining table with chairs and a bowl of apples in a sunlit room" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "0.6668 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "199.5px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A person petting a happy corgi with its mouth open in front of white flowers" src="https://images.unsplash.com/photo-1793243894460-cc1ad3446e33?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyMHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A person petting a happy corgi with its mouth open in front of white flowers" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.49978 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A sunlit living room with a grey sofa, a television on a tripod, and large windows" src="https://images.unsplash.com/photo-1793362584700-57e1bb2d8bbe?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyM3x8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A sunlit living room with a grey sofa, a television on a tripod, and large windows" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.5 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "88.4375px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" src="https://images.unsplash.com/photo-1793296268316-4279a8f9bbc9?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNHx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for Coniferous forest with yellowing autumn trees below a rocky mountain peak shrouded in thick fog" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "0.75 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "177.555px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A stack of dark ribbed steel rebar rods viewed from the end" src="https://images.unsplash.com/photo-1793280251985-79ebf452b285?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyNnx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A stack of dark ribbed steel rebar rods viewed from the end" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
              <div style={{
      "aspectRatio": "1.33221 / 1",
      "display": "flex",
      "flexDirection": "column",
      "position": "relative"
    }}>
                <button style={{
        "alignItems": "center",
        "appearance": "auto",
        "backgroundColor": "rgba(0, 0, 0, 0)",
        "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
        "display": "flex",
        "fontFamily": "Inter, sans-serif",
        "fontSize": "11px",
        "fontWeight": "400",
        "justifyItems": "center",
        "lineHeight": "16px",
        "outlineColor": "var(--ad-border, rgba(0, 0, 0, 0.1))",
        "outlineOffset": "-1px",
        "outlineStyle": "solid",
        "outlineWidth": "1px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "textAlign": "start",
        "borderRadius": "5px",
        "padding": "0px"
      }} type="button">
  <img style={{
          "display": "block",
          "height": "99.75px",
          "overflowX": "clip",
          "overflowY": "clip",
          "width": "133px"
        }} alt="A large ocean wave breaking with sea spray in the warm golden hour light" src="https://images.unsplash.com/photo-1793296640109-4f7e6e99fa58?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w3Nzg4Nzd8MHwxfGFsbHwyOXx8fHx8fHx8MTc5MzYxOTAyOXw&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=200&amp;utm_source=figma&amp;utm_medium=referral"></img>
</button>
                <div style={{
        "alignItems": "center",
        "backgroundColor": "var(--ad-surface, rgb(255, 255, 255))",
        "display": "flex",
        "height": "24px",
        "justifyContent": "center",
        "opacity": "0",
        "position": "absolute",
        "right": "4px",
        "top": "4px",
        "width": "24px",
        "zIndex": "1",
        "minWidth": "0px",
        "minHeight": "0px",
        "borderRadius": "5px"
      }}>
  <button style={{
          "alignItems": "center",
          "appearance": "auto",
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
          "display": "grid",
          "fontFamily": "Inter, sans-serif",
          "fontSize": "11px",
          "fontWeight": "400",
          "gridTemplateColumns": "24px",
          "gridTemplateRows": "24px",
          "height": "24px",
          "justifyItems": "center",
          "lineHeight": "16px",
          "minWidth": "24px",
          "outlineColor": "rgba(0, 0, 0, 0)",
          "outlineOffset": "-1px",
          "outlineStyle": "solid",
          "outlineWidth": "1px",
          "textAlign": "start",
          "width": "24px",
          "borderRadius": "5px",
          "padding": "0px"
        }} aria-label="More details for A large ocean wave breaking with sea spray in the warm golden hour light" type="button">
    <span style={{
            "alignItems": "center",
            "display": "flex",
            "height": "24px",
            "justifyContent": "center",
            "minWidth": "24px",
            "width": "24px",
            "borderRadius": "5px"
          }} aria-hidden="true">
      <svg style={{
              "display": "block",
              "height": "24px",
              "overflowX": "hidden",
              "overflowY": "hidden",
              "width": "24px"
            }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
                "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
              }} fillRule="evenodd" d="M7.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd"></path>
      </svg>
    </span>
  </button>
</div>
              </div>
            </div>;
}
