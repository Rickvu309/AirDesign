_AirDesign / after v0.1 / F13, later_

# F13 Share a view link

Mapped now so v0.1 leaves room for it. Read-only, no account to view, revoke any time.

## Flow

- **1 Make a link** (S05 Editor)
- **Link active?**
- **Told it is no longer shared**
- **2 Viewer opens it** (S15 View)
- **3 Revoke any time** (S05 Editor)

Arrow labels: revoked: the next open is refused; yes; no

## Steps and screens

| Failure | What is safe | Next step |
|---|---|---|
| 1 Make a link | S05 Editor /d/:id | The owner makes a view link. Downloads are off unless they allow them. Goes to 2 when someone opens it. |
| 2 Viewer opens it | S15 View /v/:token | Slides in order with a present mode, the latest saved version, no sign-in. Kept PowerPoint items show their previews. |
| 3 Revoke any time | S05 Editor /d/:id | Ends the link at once. A new link can be made; an ended link never works again. |

New code in F13: S15 View. Next free codes are S16 and X7.

## Rules and edge cases

- View only. No editing and no agent access through a view link.
- Links are long and random, and never indexed by search engines.
- Anyone with the link can view. The owner is told this when making it.
- Viewers see the latest saved version. Freezing a version comes later.
- Moving the deck to Trash ends its links. Restoring it does not bring them back.
- Drawn by render's Slide, so it looks the same as the editor.
- Free on every plan.
