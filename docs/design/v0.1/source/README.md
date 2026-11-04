# Source

Generators used to build the v0.1 screens on the Brilliant canvas. They are design tooling, not product code, but they show each component's exact structure, values and copy keys.

| File | What it builds |
|---|---|
| `gen-editor.mjs` | Editor screens as JSX + Tailwind: slide, slide list, toolbar, agent panel, composer, notice card, toast, working glow, alerts in the editor |
| `billing_components.py` | Add credits dialog, alert dialog, status icon tiles, summary box, buttons (Brilliant blueprint rows) |
| `settings_usage_modules.py` | Settings Usage tab modules: Weekly usage, Credits (with waiting banner and Auto reset), History |
| `settings_agents_account_modules.py` | Settings Agents and Account tab modules and rows |
| `logos.json` | SVG path data for the Claude and OpenAI marks |

Strings come from `../copy-kit.json` by key.
