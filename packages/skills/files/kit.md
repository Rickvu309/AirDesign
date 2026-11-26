# Kit

Pieces of slide design drawn from plain layers. Copy one into a slide with `airdesign_execute`, then change its words and layers as your own. The copy has no link back to the kit.

```js
const [block] = copy({ from: "kit/title-block", parent: slide, box: { x: 160, y: 96 } })
const [title, subtitle] = get({ target: block }).children
update({ target: title, text: "Revenue grew 18% on two new markets" })
```

- `parent` is the slide or frame the piece lands in.
- `box` places the piece: `x` and `y` from the parent's top left. Add `w` and `h` to give it another size. Left out, it lands at the top left at its own size.
- A piece names only the deck's theme colours and text styles, so it takes the deck's look and follows a later theme change.
- Read the piece's layers with `get({ target })` before you change them.

## Pieces

Sizes are pixels on a 1920 by 1080 slide.

- `kit/title-block` (1600 by 120): a headline over one line of context. The frame grows with its words.
