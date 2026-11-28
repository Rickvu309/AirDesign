# Landing page on a phone

The site's home page, `${siteOrigin}/`, is a document a thumb can read: it scrolls down only, every link and button is at least 44 by 44 px, a press gives feedback at once, hover applies only to a mouse, and the header and footer keep clear of the notch and the home bar.

## Sub-features

- `landing-fit` no sideways scroll at 320, 390 and 844 px wide, on the home page, the sign-in pages and the legal pages.
- `landing-taps` every link and button on the home page and the sign-in pages is at least 44 by 44 px; a press moves the control a little, and not with reduced motion.
- `landing-hover` every `:hover` rule sits inside `@media (hover: hover) and (pointer: fine)`.
- `landing-keyboard` the sign-in fields take 16 px text on a touch screen and ask for the right keyboard: `type="email"`, `inputmode="numeric"`, `autocomplete="one-time-code"`.
- `landing-chrome` the browser's bar takes the page's top color for the light and the dark scheme; the viewport reaches under the notch and resizes with the keyboard.
- `landing-demo` the product demo plays an animated editor session as it comes into view. `Pause demo` stops playback and lets the person resume it. The demo scales to the page width.

## How to get to it (user POV)

- `airdesign.app` on a phone.

## Driving it with verify-airdesign

- `$V look <run> landing-hero-phone`, and the other `landing-*` states: `landing-hero`, `landing-hero-landscape`, `landing-hero-narrow`, `landing-product-phone`, `landing-agents-phone`, `landing-pricing-phone`, `landing-footer-phone`. Each is a capture of journey `landing-pages` at a named viewport and scroll.
- `pnpm test:browser tests/browser/site-mobile.spec.ts` builds the site and checks the rules above in Chromium with touch emulation.

## Gotchas

- Chromium's phone emulation has no sticky hover, tap flash, URL-bar height, input zoom, tap delay or safe-area insets. Those need a real iPhone and a real Android phone.
