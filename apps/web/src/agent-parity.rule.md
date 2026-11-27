# A person and an agent reach the same deck: each capability of one names the other's, or is owed

`apps/web/src/agent-parity.test.ts` holds the person's side and `apps/web/src/agent-values-seen.test.ts` the agent's, over the one table in `apps/web/src/testing/agent-reach.ts`.

From the person: it lists each way a person changes a deck, from every control the design panel shows on a text, shape, line, icon, picture and frame layer, every gesture row that changes the deck, and the other surfaces (slide notes, the deck name, the theme card, dropped pictures). A value case the panel offers inside one control, such as a gradient in the fill picker, has its own `panel:<control>#<case>` entry. Each names one of three things. `agent` is the field, op or add kind of `airdesign_execute` that does the same, and when it names `writes` the test compiles that field on a probe layer and wants a write to that property. `personOnly` gives the reason it is the person's own, which today is only their undo history. `owed` is a capability agents do not have yet, with the change an agent would send for it as `probe`. The test fails once `readIntent` accepts that probe, so the entry moves to `agent`, and the list of owed entries is pinned, so it only shrinks.

Chart data editing is agent-only.

From the agent: every field and op of the agent's schema names the person capabilities where a person sees and changes that value (`person`), says it is an address (`address`), is owed to the person with a reason (`owedToPerson`), or is declined with a reason (`declined`) when the panel will not grow that control. A declined field stays on the owed list so the decision is counted. The owed list is pinned the same way. A value field must have a probe value in `sample`. A new agent field ships only once a person can see, change and undo what it sets.

A new panel control, a new gesture, a new agent field or a property the editor newly writes fails until it is named.
