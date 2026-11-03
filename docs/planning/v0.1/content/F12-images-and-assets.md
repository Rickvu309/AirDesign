_AirDesign / v0.1 / F12_

# F12 Images and assets

Bring images in, place them, adjust them. Originals never change, and every image is reusable across decks.

## Flow

- **1 Bring images in** (S05 Editor): Upload, paste, stock photos or icons.
- **Or an agent finds them** (X3 Your agent app)
- **Safe and fits?**
- **Told why. Not added.** (F15)
- **2 Place** (S05 Editor): In a layout slot or anywhere. Fills, centered on its focus.
- **3 Adjust** (S05 Editor): Crop, focus, mask, replace. The original never changes.
- **Edit and refine** (F03)
- **Export to PowerPoint** (F04)

Arrow labels: no; yes; search_assets, add_file

## Where images come from, and where they live

- **Sources in v0.1**: The person's own uploads, free stock photos, and an icon set. Generated images come later, and will spend credits.
- **One library per person**: Every image belongs to the person, not to one deck. Stored once, reused anywhere, with its source and license.
- **Nothing destructive**: Crop, focal point and mask are settings on the placed image. The original stays. Export uses the crop.

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| 1 Bring images in | S05 Editor | /d/:id | Upload or paste files, search free stock photos, or pick an icon. Each image is checked, then joins the person's library with its source and license. | 2, or F15 |
| Or an agent finds them | X3 Your agent app | outside | Either agent calls search_assets, then add_file with the one it picks. The same checks apply. | 2 |
| 2 Place | S05 Editor | /d/:id | Into a layout's image slot or anywhere on the slide. It fills the space, centered on its focal point. The agent writes alt text if there is none. | 3 |
| 3 Adjust | S05 Editor | /d/:id | Crop, move the focal point, mask to a shape, or replace. The original never changes. Checks flag images too low in resolution for their size. | F03 or F04 |

No new codes in F12. It runs on S05 Editor. Next free codes are S11 and X5.

## When something goes wrong

| Item | Detail |
|---|---|
| Unsupported or unsafe file | Refused with the reason. SVGs are cleaned of scripts and outside links. |
| Phone photo or huge image | Converted and sized for slides. The original is kept. |
| Same image added twice | Stored once. Both places use it. |
| Removed while in use | Decks that use it keep it. It just leaves the library list. |
| Stock search finds nothing | The person or the agent is told, and can try other words. |
| Too small for its size | Flagged as blurry, never blocked. |
| Storage full | Told before upload, with what is using space. More storage comes with a plan (F07). |

## Rules

- Originals never change. Every edit is a setting.
- Source and license are stored with every image. Where a license asks for credit, it goes into the slide notes.
- Every image has alt text, from the person or the agent. It exports as PowerPoint alt text.
- Every file is untrusted: read in the worker, with limits.
- Images belong to the person and work across all their decks.
- Stock photos and icons are free. Generated images come later and will cost credits.
- Target: a placed image visible in under 1 s.
