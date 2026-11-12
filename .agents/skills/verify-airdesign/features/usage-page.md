# Usage page

`/settings/usage` is the first tab of Settings. It shows how much of the week's Aira usage the person has used and when it resets. The account menu's `Usage` and the `Settings` link in the side navigation open it.

## Sub-features

- `usage-reach` the account menu's `menuitem "Usage"` and the side navigation's `link "Settings"` open `/settings/usage`; `navigation "Settings"` holds the `Usage`, `Agents` and `Account` tabs, the current one with `aria-current="page"`.
- `usage-loading` while it loads, `meter "Weekly usage"` has `aria-busy="true"` and the text reads `Loading usage…`; the account button reads `Account` until the email loads.
- `usage-loaded` the meter shows `<n>% used` and the card says `Resets <when>` from `airaRoutes.usage`; the fill turns red at 100%. A second card says what happens `When usage runs out`.
- `usage-failed` a failed load shows the alert `Unable to load your usage. Check your connection and try again.` with `Try again`.
- `usage-refresh` it loads again on window focus. Signed out, the page goes to sign-in.

## How to get to it (user POV)

- The account button at the top of the side navigation > `Usage`.
- `Settings` in the side navigation.
- `See all` in the Agent panel's usage popover.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> usage-page`. Prints `"passed":true`.
- **Open.** Sign in, account menu > `Usage`. The heading `Settings`, the `Usage` tab current, the meter not busy, `Resets …` and `N% used`. The journey saves the server's `airaRoutes.usage` answer. Evidence `NN-usage-loaded`.
- **Tabs and link.** The `Agents` tab opens `/settings/agents`; the side navigation's `Settings` comes back to `/settings/usage`.
- **Failed.** Abort `airaRoutes.usage` in the browser and reload: the alert shows. Evidence `NN-usage-failed`. Let it through and click `Try again`: the meter loads.

## Gotchas

- A new account's week shows `0% used`. To see a full week, drive Aira calls first, or see `tests/browser/usage.spec.ts`.
- The `Reset` action and the credits history on the design screen are not in the app.
