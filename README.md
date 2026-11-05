# AirDesign

Create a slide deck from an idea or a PowerPoint, refine it by hand or with an agent, then export it for use in PowerPoint.

This walkthrough describes the **planned v0.1 experience**. This monorepo is where the app is built. Until v0.1 ships, these steps describe the intended experience, not a running app.

## 1. Sign in

Enter your email, then follow the email link or enter its code. If you started by choosing to create a deck, import a PowerPoint or connect an agent, sign-in returns you to that task.

[Sign-in walkthrough](docs/planning/v0.1/content/sign-in-flow.md)

## 2. Start your first deck

Choose the starting point that matches what you have.

### Start with an idea

Choose **New deck** and describe what you need to Aira, the built-in agent. Include the audience, purpose and any notes or documents you want it to use. For example:

> Create a six-slide project update for our leadership team. Use these notes to explain progress, risks and the decisions we need this week.

The editor shows changes as Aira works. You can edit alongside it or stop the run and keep the work so far.

[First-deck walkthrough](docs/planning/v0.1/content/f02-first-deck-flow.md)

### Start with a PowerPoint

Choose **New deck**, then **Import PowerPoint**, and select a `.pptx` file. Home shows an importing card with progress; the deck opens when ready. Imported decks keep their own look.

Check the import report for anything that needs attention. For an old `.ppt` file or a Keynote presentation, save a `.pptx` first.

[Import walkthrough](docs/planning/v0.1/content/f05-import-flow.md)

### Start with your own agent

Open **Settings → Agents** and follow the connection guide for Claude or Codex. Sign in and approve the agent's access, then ask it to create a deck. It returns an editor link you can open in Studio.

An approved agent can read and edit your decks and use your files. It cannot change billing or your account, or delete decks. End its connection from Settings whenever you need to.

[Agent connection walkthrough](docs/planning/v0.1/content/f06-connect-agent-flow.md)

## 3. Refine the deck

Select slides or elements and ask for a change, such as "Simplify this slide and make the recommendation clearer." Your selection goes with the request. With nothing selected, the request applies to the whole deck.

Edit by hand whenever you want. After an agent finishes, review its summary and the changes by slide. **Undo** for a run removes that run's changes while keeping your later manual edits.

Review warnings about overflow, contrast and PowerPoint fit. Use them to decide what to fix before exporting.

[Editing walkthrough](docs/planning/v0.1/content/f03-edit-and-refine-flow.md)

## 4. Choose a look you can reuse

Pick a Basic template or one of your own. You can save colors, fonts, logos and layouts from a deck or an imported PowerPoint, then make that template your default for new decks.

Applying a template changes linked items in one undoable step. Items with their own styling stay as they are.

[Template walkthrough](docs/planning/v0.1/content/f11-templates-flow.md)

## 5. Export your deck

Choose **Export**, select PowerPoint or PDF, and choose all slides or a selection. If anything is flagged, review the affected slides and the proposed fallback. Fix those items or continue with the export.

The file is built from one saved version while you keep working. Download it when ready. For PowerPoint, supported content remains editable; the report identifies elements that need an approximation or an image fallback.

[Export walkthrough](docs/planning/v0.1/content/f04-export-flow.md)

## 6. Return to your work

Home lists your decks with the most recently edited first. Search, reopen, rename or duplicate a deck to continue. Deleted decks go to Trash, where you can restore them for 30 days unless you empty it first.

Both Aira and connected agents use your weekly allowance. If a run reaches the limit, it finishes the current change and stops, keeping the work so far. You can keep editing manually, wait for the weekly reset or use credits to reset usage from **Settings → Usage**.

[Manage decks](docs/planning/v0.1/content/f14-manage-decks-flow.md) · [Usage and resets](docs/planning/v0.1/content/f07-usage-flow.md)

## Follow the build

The [design index](docs/design/v0.1/README.md) shows the planned screens and identifies missing states. The [planning index](docs/planning/v0.1/README.md) covers scope, architecture and research. The [nine-PR delivery plan](docs/planning/v0.1/delivery/autopilot-plan.md) defines the implementation sequence and acceptance gates.
