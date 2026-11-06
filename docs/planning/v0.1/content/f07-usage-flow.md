# F07 Usage Flow

AirDesign / v0.1 / F07

F07 Usage and resets

Release state: X06 is open. Without a configured payment provider, Settings shows “Buying credits is not available yet.” with no checkout or waiting state. Weekly allowance, reset time and existing balances remain available. Signed local payment fixtures require explicit test or bench wiring. The payment journeys below describe the provider-enabled state.

AirDesign is free. Usage resets every week. People who do not want to wait pay to reset, from a credit balance.

Screen

Other flow or outside

Decision

manage

not now

yes

no

yes

F02, F03

Out of usage, run stopped

F09

From settings

S81 Settings, usage

1 See where they stand

Weekly usage, when it resets (Monday 8:00 AM in the person's time zone), credit balance, auto reset. The usage ring is blue, then red at the limit.

X6 Payment provider

Receipts by email

Reset now?

Back to the deck

Request kept

S92.01 to S92.04 Limit card, confirm, add credits, reset

2 Reset from balance

Balance $5+?

S91.01 Add credits

Payment step first, then back

S81 Settings, usage

3 Usage back to 0% used

$5 leaves the credit balance at once. No card is charged. The person sends the kept request in one step.

F02, F03

Send the kept request

How credits work

What the person sees

Weekly usage shown as percent used, never tokens. It resets every week, Monday 8:00 AM in the person's time zone. A reset costs $5 from the credit balance and brings usage back to 0% used. Credits never expire; refunds only for our mistakes or double payments.

What a run spends

No estimate up front. A run starts if any usage is left, uses it as it goes, and stops at the limit after finishing the current change. A run that fails on our side gives its usage back.

Plans

No plans. Everyone is free with weekly usage. Credits: add from $10, any amount. Auto reset is off by default and runs at most 3 times a week. When it can run, $5 leaves the balance and the run carries on without stopping. When credits are under $5 or the weekly cap is reached, the run stops and the limit card shows. Turning it on while already at the limit does not reset by itself; the person presses Reset once. Pay on the provider's checkout: card, or bank QR through payOS (VietQR, Napas 24/7). Promo codes are entered on the provider's checkout; the code is used only when the payment lands, bonus credits are spent first and never refunded.

Steps and screens

Step

Screen

Route

What happens

Goes to

Credits low or run waiting

S40 Editor

/d/:id

The usage ring turns red at the limit. With auto reset off, the agent reply ends in a limit card, not a popup: You have hit this week's limit. It resets Monday at 8:00 AM. Your request is saved. Reset. The person can keep editing by hand. With auto reset on, $5 leaves the balance and nothing shows.

1

1 See where they stand

S81 Settings, usage

/settings/usage

Weekly usage, reset time, credit balance, auto reset and history. Reset, add credits, or turn on auto reset (off by default, up to 3 a week). With auto reset off, when either agent runs out the agent reply ends in the limit card (S92.01).

2, or X6

2 Reset from balance

X5 Payment step

outside

Money has one home: Settings, Usage tab, built from three modules. Weekly usage (bar, reset time, Reset). Credits (balance, Add credits, waiting banner, Auto reset). History (only finished payments and resets; a payment appears once it lands). Add credits is the only way in: the Settings button and the limit card both open the same Add credits dialog. AirDesign only asks the amount; the payment partner's page handles the way to pay, details, promo code, tax and receipts. AirDesign never shows or stores ways to pay. Results show as one alert dialog: {amount} added, Unable to complete payment, or Payment expired. Results reach the person wherever they are in AirDesign, not only in Settings, and a deck that was waiting keeps its request until the person presses Resume. A reset itself never charges anything.

3, or F15

3 Usage back to 0% used

S81 Settings, usage

/settings/usage

$5 leaves the credit balance. Usage is back to 0% used at once. A toast confirms it and the chat offers Resume for the kept request.

F02 or F03

Payment method

X6 Payment provider

outside

No payment method in AirDesign. Ways to pay live only on the payment partner's page, chosen each time someone adds credits. Receipts come by email.

1

Screens in F07: S81.01 Usage (three modules). Add credits: S91.01 amount, S91.02 waiting for payment, S91.03 credits added. Payment errors: S99.01 failed, S99.02 expired. Out of usage: S92.01 limit reached, S92.02 confirm reset, S92.03 add credits first, S92.04 reset complete. X5 Payment step, X6 Payment provider.

When something goes wrong

Payment fails

Told why, nothing charged. Try again or pick another way to pay.

Event arrives late

payOS is the first provider, for bank QR. Its hosted checkout page shows the QR, a fixed VND amount and a short transfer code, so the bank app fills everything in and refuses a wrong amount. It runs on the owner's personal payOS account with VietQR Pro. An expired or cancelled link takes no payments (payOS confirmed). payOS status maps to ours: PENDING and PROCESSING are open, PAID is paid, expired is expired, anything unknown stays open. The VND rate is locked while the link is live (15 minutes).

Out of usage mid-run

The current change finishes, then the run stops. That change may take usage past 100%; the extra is not charged and does not carry into the next week.

Run fails on our side

Its usage returns automatically.

Refund or chargeback

Credits bought are removed. If some were already spent on resets, the balance stays at zero and the person is told.

Balance under $5

Every Reset button (Settings and the limit card) opens one confirm first: Reset usage? This uses $5 of your credits. Cancel, Reset (S92.02). With enough credits, Reset runs at once; otherwise it opens the one Add credits dialog (S92.03) and the reset runs as soon as the payment lands, if that week's limit still applies. Auto reset skips the confirm because the person turned it on.

A User Agent is busy

It uses the same weekly usage. At 100% the MCP reply says it is out of usage, when it resets, the balance, and a link to reset. The request waits for the person.

Rules

Usage, never tokens. No estimate before a run. Usage never goes below 0%.

Both agents use weekly usage; Aira uses it faster. Imports, exports, themes and stock images are free.

Credits land only on a verified provider event, never on a return page. Each payment is handled once, by its id. If a cancel fails because the payment just went through, it is credited. One open payment per person: Add credits reopens it instead of starting another; the waiting banner shows it. An open payment is checked with the provider when the person returns, reopens it or its link expires; until the provider answers it stays Waiting, and Nothing was charged is shown only once the provider confirms it. One reset per limit hit: a reset belongs to the week and limit it was asked for. If usage already reset (Monday, another tab, auto reset) before the payment lands, the credits still land but no $5 is spent.

A kept request survives payment. Nothing is sent without the person.

Every credit movement is in the ledger. It is checked against Anthropic usage every night.

Billing lives in apps/server billing and calls usage.addCredits. Billing is not core. Our side owns one Payment (id, person, amount in USD, status: open, paid, failed, expired, cancelled) and the ledger. Each provider is an adapter with four parts: start a payment (returns its secure page link and expiry), read its status, cancel it, and turn its signed webhook into paid or failed. Adding a provider adds an adapter, never new screens. Keys come from env. payOS: @payos/node, keys PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, no sandbox.

A reset is $5. Revisit after launch with measured deck cost.
