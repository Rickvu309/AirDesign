# Landing shader prototype

Live hero and closing section using `@paper-design/shaders` 0.0.82 (vanilla `ShaderMount`).

- Hero: PulsingBorder around the slide while Aira rewrites the title, about 2.4s, then fades out over 600ms. Colors #4D94FB, #93B8EF, #CFE0FA. Not mounted under reduced motion.
- Close: Dithering, shape sphere, 4x4, #0F2433 to #4D94FB, pxSize 3, rising behind the answer card and fading to flat navy before the title.
- Both shaders pause when off screen.

Run: `npm i @paper-design/shaders@0.0.82`, then serve this folder and open `index.html`.
