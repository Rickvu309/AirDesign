# Components

Every repeated part of the v0.1 screens is one component. Each is built once and filled from the [copy kit](copy-kit.md) by key. When a new screen needs one of these, reuse it and change only its slots and data. Do not fork a variant for one screen.

Values refer to [tokens](tokens.md). Screen codes refer to [the screen index](README.md).

## Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | Blue gradient `button.top` to `brand`, 1px `brand.strong` edge, white inner highlight on top, small drop shadow, white label | The one main action in a view |
| Secondary | White, 1px `gray.300` edge, ink label | Cancel, Close, Not now, and any second action |
| Danger | Red gradient fill, 1px `red.edge`, white label | Only for actions that delete for good (S33.03) |
| Text link | `link` color, medium weight, no box | Low-weight actions inside rows and cards (Open payment page, Remove, Setup guides) |

- Heights: 36 in dialogs, 34 in Settings modules, 32 inside chat and cards, 44 on full-width sign-in.
- Labels start with a verb, sentence case. A button that opens a new tab ends with the external arrow icon (Continue to payment).
- In a footer, the secondary button sits before the primary, both right-aligned.

## Status icon tile

A small rounded square styled like the primary button: top-to-bottom gradient, 1px darker edge, white inner highlight, soft shadow, with a white glyph.

| Kind | Gradient | Glyph | Used for |
|---|---|---|---|
| ok | `blue.light` to `brand` | check | Success (S91.03, S92.04) |
| money | `blue.light` to `brand` | $ | Confirm a reset (S92.02) |
| error | `red.light` to `red` | ! | Failures and deletes (S99.01, S33.03, S49.01) |
| limit | `red.light` to `red` | ring | Weekly limit reached (S92.01) |
| expired | `gray.light` to `gray.mid` | clock | Expired payment (S99.02) |
| mail | `blue.light` to `brand` | envelope | Check your email (S22.01) |

Sizes: 40 with radius 12 in alert dialogs, 48 with radius 14 as a page badge, 20 with radius 6 in notice cards.

## Alert dialog

Results and confirms that need a choice.

- 400 wide, radius 16, padding 24, gap 16, over a 25% black scrim.
- Anatomy: head row (status icon tile left, close button right), title, one line, footer (secondary, primary or danger).
- Slots: `icon`, `title`, `body`, `secondary`, `primary`, `danger` (bool).
- Copy patterns: `confirm`, `result.success`, `result.error`.
- Used in: S91.03 credits added, S92.02 confirm reset, S99.01 payment failed, S99.02 payment expired, S33.03 empty Trash.
- Rules: no tables or numbers beyond one amount in the body. Close and the secondary button both dismiss without acting.

## Add credits dialog

The only way to add credits, opened from Settings and from the limit card.

- 440 wide, radius 16, padding 24, gap 20.
- Anatomy: title "Add credits" and close; line `credits.facts`; Amount field (input with `$` prefix and focus ring, presets $10 $25 $50, the matching preset highlighted); note `credits.minimum`; summary box (Current balance, Adding, New balance in bold); footer Cancel and Continue to payment with the external arrow; note `pay.new_tab`.
- Slots: `balance`, `amount`. Nothing else changes between entry points.
- Used in: S91.01 (from Settings), S92.03 (from the limit card).
- Behavior: amount must be 10 or more, whole dollars. Continue to payment creates one payment, opens the partner page in a new tab and closes the dialog. If a payment is already open, Add credits reopens that payment instead of starting another.

## Notice card

In-chat card for anything about a run.

- White, radius 12, 1px `gray.200` ring, padding 14, gap 12. Sits at the end of the agent reply.
- Anatomy: head (status icon tile 20, title), body line, up to two small buttons.
- Slots: `kind` (limit, error, ok), `title`, `body`, `actions`.
- Used in: S92.01 limit reached (Reset), S49.01 run failed (Resume, Undo), S92.04 usage reset (Resume).
- Rule: every run status uses this card. No plain red text lines in the chat.

## Toast

Small result that needs no choice.

- Dark bar (`gray.900`), height 40, radius 10, top center, 12 from the top of the view.
- Anatomy: optional icon (success check or error tile), one line, optional one action.
- Slots: `kind` (success, error, info), `text`, `action`.
- Used in: S33.01 deck moved (Undo), S41.04 slides pasted (Undo), S61.03 downloaded, S69.01 export failed (Try again), S49.02 offline, S92.04 usage reset.

## Waiting banner

Shown while a payment is open.

- Blue tint (`blue.tint`), radius 8, inside the Credits module under the balance.
- Anatomy: spinner, line `pay.waiting`, actions Open payment page and Cancel.
- Used in: S91.02.
- Rule: history lists only finished payments; the banner is the only sign of an open one.

## Module card (Settings)

Every Settings tab is built from these cards.

- White, radius 12, 1px `gray.200` edge, padding 20, gap 14, stacked with 16 between cards, 860 wide.
- Anatomy: head (title, one line, actions on the right), then rows separated by 1px `gray.200` lines.
- Row: optional logo tile 28, title and status line, action on the right (button, toggle, select).
- Usage tab (S81.01): Weekly usage (bar, `usage.resets`, Reset), Credits (balance, `credits.facts`, Add credits, waiting banner, Auto reset row), History (date, what, amount).
- Agents tab (S81.02): Agents (Aira with toggle, Claude with Manage, Codex with Connect), MCP server (address field with Copy, setup guides link).
- Account tab (S81.03): Profile (Edit), Preferences (Language, Slide size), Account (Sign out, Delete account in red text).

## Usage bar

Track 8 high, radius 4, `gray.200`; fill `brand`; value "62% used" on the right. The ring in the agent panel turns red at the limit.

## Working glow

Shown while any agent (Aira, Claude, Codex) changes a slide.

- The slide gets a 2px gradient edge (brand, light blue, soft violet, brand at 135 degrees), layered blue and violet glow, and a light sweep over the element being changed.
- No agent name, no pill, no agent colors. The slide thumbnail in the slide list shows a small blue dot.
- Used in: S42.01, S42.03.

## Composer (agent message box)

- Default: one line, radius 14, attach button, selection chip, placeholder "Ask Aira", mic button.
- Working: placeholder "Add to the request", stop button (dark circle with a square).
- At the limit: placeholder `usage.resets`, no chip.
- Offline: grayed, placeholder "Waits for connection".
- Long message (S42.04): grows into a card: selection chips on top, paragraph up to 168 high with a fade, attach at bottom left, round primary send button at bottom right.
- Selection chips: slide chip in gray ("Slide 3"); element chip in blue tint with its icon ("Bar chart"). Each has a remove x. The selected element shows a light selection, like Figma: a 1px `brand` outline with square corners and four 7px white handles with a 1px `brand` edge.

## Deck card and deck row

- Card (Home grid): name, status line, 16:9 preview. States: default (Edited ...), importing (blue status line, PPTX tile and progress bar), import failed (red "Unable to import", PPTX tile, Choose another file, Remove).
- Row (list view, S31.03, S31.05): header labels 12 medium `gray.500`, bottom-aligned with 10 above the rule; rows with 12 padding, 64 x 36 preview, name, Edited, Created.

## Agent logo tiles

28 square, radius 7. Aira: white tile, 1px `gray.200` edge, blue spark mark (open A legs and a four-point star). Claude: orange tile with the Claude mark. Codex: black tile with the OpenAI mark. Use the real marks from `source/logos.json`, never letters.

## Panel switch

In the editor toolbar: Agent and Design, height 28, inside a 32 high group. The label stays "Agent"; the built-in agent itself is named Aira everywhere else.

## Inputs

- Text field: 44 high on sign-in, 40 in dialogs, radius 8, 1px `gray.300` edge, 2px `brand` ring on focus.
- Code entry (S22.01): six boxes 44 x 48, radius 8; the active box has the focus ring.
- Toggle: 36 x 20, `brand` when on.
- Select: 120 x 32, radius 8, chevron.

## Landing page parts (S11.01)

The landing page always takes the bolder visual option: it is for high-paid experts whose decks must win buy-in or a deal. It uses the same tokens and parts as the product. Research and concept notes are in [research/](research/).

- **Hero collage:** editorial headline on the left ("Win the room before you walk in.", 88 semibold, -3.4 tracking). On the right a layered stack: two faded back slides, the front slide with the working glow, a Figma-style title selection and a "Was" tag with the old title struck through, floating review chips (blue check tiles: Answer first, One point per slide, Every number sourced) and a floating Aira card with activity steps.
- **Pyramid:** governing thought slide on top, three argument slides below joined by gray connector lines with a blue node, an evidence pill under each.
- **Storyline wall:** full-bleed navy (#0F2433) section, eight mini slides in two rows with action titles; the slide being rebuilt carries the working glow; one Aira status line below.
- **Red pen:** "Your draft" slide with red pen marks (ellipse, arrow, underline) and red notes ("So what? State the answer.", "Source?", "Which bar matters?"), an Aira tile in the middle, then "After Aira". Red marks are the only red outside errors.
- **Compare pair:** the same slide in PowerPoint and in AirDesign, then kept items with blue check tiles.
- **Agent cards and MCP row:** Aira, Claude, Codex with real marks, then the MCP address with Copy address.
- **Closing:** navy with a radial blue light, one glowing slide, "Your next deck has to win.", primary and ghost buttons; navy footer.
- Mini slides: 16:9, number in teal, title in navy, one simple exhibit. Sample companies Halden and Brightwater, always labeled as sample data.
