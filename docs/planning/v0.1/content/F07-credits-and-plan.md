_AirDesign / v0.1 / F07_

# F07 Credits and plan

See the balance, upgrade or top up, and get back to the request that was waiting. Credits only pay for the AirDesign Agent.

## Flow

- **No credits left, or run stopped** (F02, F03)
- **From settings** (F09)
- **1 See where they stand** (S11 Plan and usage): Balance, typical costs, renewal, use by deck.
- **Change card, invoices, cancel** (X6 Stripe portal)
- **Buy more?**
- **Request kept** (Back to the deck)
- **2 Pay** (X5 Stripe Checkout)
- **Paid?**
- **Told why. Not charged.** (F15)
- **3 Credits land** (S11 Plan and usage): On Stripe's verified event, never before.
- **Send the kept request** (F02, F03)

Arrow labels: manage; not now; yes; no; yes

## How credits work

- **What the person sees**: Credits, never tokens. Plan credits renew each month and do not roll over. Top-up credits last 12 months and are spent after plan credits.
- **What a run spends**: No estimate up front. A run starts if any credit is left, spends as it goes, and stops at the limit after finishing the current change. Credits are held behind the scenes so two runs never spend the same credit. A run that fails on our side gives its credits back.
- **Plans**: Free: starter credits once per normalized email. Pro: monthly credits and more storage. Prices are set from measured deck cost before launch.

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| Credits low or run waiting | S05 Editor | /d/:id | A warning at 20 percent left, once per period. Or a request in F02 or F03 finds no credits left, or a run stops at the limit; the request is kept. | 1 |
| 1 See where they stand | S11 Plan and usage | /settings/plan | Balance, what a typical deck and a typical edit cost, the renewal date, and use by deck and run. Free can upgrade, Pro can top up. | 2, or X6 |
| 2 Pay | X5 Stripe Checkout | outside | Stripe takes the payment and handles card checks. | 3, or F15 |
| 3 Credits land | S11 Plan and usage | /settings/plan | Stripe's verified event reaches billing, which calls usage.setPlan or adds the top-up. The person goes back to where they were, and can send the kept request in one step. | F02 or F03 |
| Manage the plan | X6 Stripe portal | outside | Change card, see invoices, or cancel. Cancelling keeps Pro until the period ends, then Free. | 1 |

New codes in F07: S11 Plan and usage, X5 Stripe Checkout, X6 Stripe portal. Next free codes are S12 and X7.

## When something goes wrong

| Item | Detail |
|---|---|
| Payment fails | Told why, nothing charged. They can try another card. |
| Event arrives late | Told it is processing. Credits land within a minute. The return page never grants credits by itself. |
| Out of credits mid-run | The current change finishes, the run stops, the balance never goes below zero. |
| Run fails on our side | Its credits return automatically. |
| Refund or chargeback | The credits it bought are removed. The plan returns to Free. |
| Cancelled mid-period | Pro stays until the period ends. |
| A User Agent is busy | No credits involved. It hits rate limits and is told when to retry. |

## Rules

- Credits, never tokens. No cost estimate before a run; it stops at the limit, never below zero.
- Only the AirDesign Agent spends credits. User Agents, imports, exports, themes and stock images are free.
- Paid access starts on Stripe's verified event, never on the return page. Each event is handled once.
- A kept request survives payment. Nothing is sent without the person.
- Every credit movement is in the ledger. It is checked against Anthropic usage every night.
- Billing lives in apps/server billing and calls usage.setPlan. Billing is not core.
- Prices are set from measured deck cost before launch.
