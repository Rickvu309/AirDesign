_AirDesign / v0.1 / F04_

# F04 Export to PowerPoint

Export, review only what needs it, open in PowerPoint. It looks the same and stays editable.

## Flow

- **1 Export** (S05 Editor): The person exports the deck. PowerPoint is the default.
- **Anything flagged?**
- **2 Review what is flagged** (S06 Export): Only flagged items, each with its slide and what will happen.
- **Fix, then export** (F03)
- **Or an agent calls export_deck** (X3 Your agent app)
- **3 Download** (S06 Export, ready): Built from one saved version. Private link.
- **Deck untouched. Retry.** (F15)
- **4 Open in PowerPoint** (X4 PowerPoint)
- **Edited there? Import it back** (F05)

Arrow labels: none: no extra step; yes; fix first; export anyway; link and report; failed; later

## What happens to each thing

Every item lands in one of three tiers. The fit report counts them before the file is built.

- **Native**: Becomes a real PowerPoint object. Text, shapes, images, tables, charts, groups, theme colors and fonts, layouts and placeholders, speaker notes. Auto layout becomes fixed positions that look the same.
- **Kept**: Goes back exactly as it came. Anything that came from an imported PowerPoint and was not touched returns byte for byte, even parts AirDesign does not understand. AirDesign data rides along in the file, so importing it again restores auto layout, roles and brand links.
- **Flagged**: No PowerPoint equal. A font PowerPoint does not have, an effect it cannot draw. We use the closest native version, or a picture of that one element when there is none, and list it. Never silent.

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| 1 Export | S05 Editor | /d/:id | The person exports the deck as PowerPoint. PDF and PNG are the other formats. The fit check has already run with deck health, so the answer is instant. | 3, or 2 if flagged |
| Or an agent exports | X3 Your agent app | outside | Either agent calls export_deck. It gets a private link and the fit report, and tells the person what was flagged. Nothing waits on a person. | 3 |
| 2 Review what is flagged | S06 Export | /d/:id/export | Only when something is flagged. Each item names its slide and what will happen. The person fixes first, or exports anyway. | 3, or F03 |
| 3 Download | S06 Export | /d/:id/export | The worker builds the file from one saved version, in the background. The person can keep working. The report and the file come from the same build. | 4, or F15 |
| 4 Open in PowerPoint | X4 PowerPoint | outside | Looks the same. Text stays text, shapes stay shapes. Notes, layouts and theme come along. | F05 later |

New codes in F04: S06 Export, X4 PowerPoint. Next free codes are S07 and X5.

## When something goes wrong

| Item | Detail |
|---|---|
| Font not in PowerPoint | Embedded in the file when its license allows. Otherwise flagged: switch to the suggested close font, or keep it and it shows only where installed. |
| Agent still editing | The person chooses: export now with the run's changes so far, or when the run ends. An agent exporting in its own run waits for its own changes. |
| Big deck | Builds in the background. The person keeps working and is told when it is ready. |
| Very large images | Scaled to twice their size on the slide to keep the file small. Originals stay in AirDesign. |
| Odd slide size | Kept as is. PowerPoint takes custom sizes. |
| Export fails | The deck is untouched. F15 says what failed and offers Retry. |
| Opened in Keynote or Google Slides | Built for PowerPoint. Others open it, with small differences possible. |
| Link expired | Export again. If the deck has not changed, the same file comes back at once. |

## Rules

- Open it in PowerPoint and it looks the same. Reference decks are checked on every change.
- Text stays text. A slide never turns into one picture.
- Every change in translation is listed. Nothing silent.
- Untouched imported parts go back byte for byte.
- The person and both agents use the same export and the same report.
- Export never costs credits.
- Target: a 20-slide deck ready in under 5 s.
- Download links are private to the deck owner and expire after 24 hours.
- Every export is built from one saved version. The report and the file come from the same build.
- No extra step when nothing is flagged.
