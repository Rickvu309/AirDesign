// Post-processing applied to every generated component by build-ui-pack.mjs.
// Each step keeps the rendered output identical unless noted.

// Design tokens: literal colour -> var(--ad-token, literal). Defaults live in ui-pack/src/tokens.css.
export const TOKENS = [
  ["ink", "rgba(0, 0, 0, 0.898)", "Primary text and icons"],
  ["ink-strong", "rgb(0, 0, 0)", "Highest-contrast text"],
  ["ink-muted", "rgba(0, 0, 0, 0.5)", "Secondary text and icons"],
  ["ink-subtle", "rgba(0, 0, 0, 0.3)", "Disabled and placeholder"],
  ["border", "rgba(0, 0, 0, 0.1)", "Default border"],
  ["border-strong", "rgba(0, 0, 0, 0.15)", "Emphasised border"],
  ["divider", "rgb(230, 230, 230)", "Dividers and raised neutral fills"],
  ["divider-strong", "rgb(217, 217, 217)", "Strong neutral stroke"],
  ["surface", "rgb(255, 255, 255)", "Panels and cards"],
  ["surface-subtle", "rgb(245, 245, 245)", "Hover and secondary surfaces"],
  ["brand", "rgb(255, 92, 22)", "Brand orange"],
  ["brand-strong", "rgb(226, 76, 12)", "Brand orange, pressed and icons"],
  ["brand-subtle", "rgb(255, 223, 204)", "Brand tint"],
  ["accent", "rgb(61, 56, 245)", "Accent blue-violet (shapes, focus)"],
  ["accent-strong", "rgb(43, 39, 172)", "Accent outline"],
  ["selection", "rgb(13, 153, 255)", "Selection blue"],
  ["selection-strong", "rgb(0, 123, 229)", "Selection blue, pressed"],
  ["selection-subtle", "rgb(242, 249, 255)", "Selection tint"],
  ["pink", "#FF58AE", "Brand mark stroke"],
  ["folder", "rgb(175, 188, 207)", "Folder icons"],
];
const alias = { "#000": "rgb(0, 0, 0)", "#1A1A1A": "rgba(0, 0, 0, 0.898)", "#222222": "rgba(0, 0, 0, 0.898)", "#FFF": "rgb(255, 255, 255)", "rgb(255, 88, 174)": "#FF58AE" };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokenRe = new RegExp(`(${[...TOKENS.map((t) => t[1]), ...Object.keys(alias)].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![0-9a-zA-Z])`, "g");
const tokenFor = (lit) => TOKENS.find((t) => t[1] === (alias[lit] ?? lit))?.[0];

export const tokenise = (s) =>
  s.replace(tokenRe, (lit, _g, off, all) => {
    const before = all[off - 1];
    if (before === "(" && /var\($/.test(all.slice(Math.max(0, off - 20), off))) return lit; // already a var fallback
    const t = tokenFor(lit);
    return t ? `var(--ad-${t}, ${lit})` : lit;
  });

// Figma leftovers: icon colour hook becomes an AirDesign one; the attribute was dead (style wins).
export const dropFigmaHooks = (s) =>
  s
    .replace(/ fill="var\(--fpl-icon-color[^"]*"/g, "")
    .replace(/ fill="var\(--color-[^"]*"/g, "")
    .replace(/"fill": "var\(--ad-ink, rgba\(0, 0, 0, 0\.898\)\)"/g, '"fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"');

// Third-party and personal content: external figma hosts become neutral, personal name becomes a placeholder.
const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e6e6e6'/%3E%3C/svg%3E";
export const neutralise = (s) =>
  s
    .replace(/src="https:\/\/(?:static|s3-alpha)\.figma\.com\/[^"]*"/g, `src="${PLACEHOLDER}"`)
    .replace(/href="https:\/\/(?:www|help)\.figma\.com\/[^"]*"/g, 'href="#"')
    .replace(/\bQuan (\d\d\. )/g, "$1")
    .replace(/Quan Vu \(Richard\)/g, "Your Name")
    .replace(/Quan Vu/g, "Your Name")
    .replace(/\bQuan\b/g, "Your");

// Every <img> gets an alt (decorative by default, override via props).
export const altText = (s) => s.replace(/<img (?![^>]*\balt=)/g, '<img alt="" ');

// Components accept every native prop of their root element (onClick, ref, aria-*, data-*, ...).
export const passProps = (s) => {
  const tag = s.match(/\)\s*{\s*return\s*\(?\s*<(\w+)/)?.[1];
  if (!tag) throw new Error("no root tag");
  let out = s
    .replace(/\(\{\s*style,\s*className\s*\}: AirDesignComponentProps\)/, `({\n  style,\n  className,\n  ...rest\n}: AirDesignProps<"${tag}">)`)
    .replace('import type { AirDesignComponentProps } from "../types.ts";', 'import type { AirDesignProps } from "../types.ts";');
  if (!out.includes("...rest")) throw new Error("signature not rewritten");
  out = out.replace("className={className}", "className={className} {...rest}");
  return out;
};

export const transform = (src, name = "") => {
  let out = passProps(altText(neutralise(dropFigmaHooks(tokenise(src)))));
  if (/^MediaThumbnail/.test(name)) out = out.replace('alt=""', 'alt="Media thumbnail"');
  return out;
};
