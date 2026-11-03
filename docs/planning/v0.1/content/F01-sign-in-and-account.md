_AirDesign / v0.1 / F01_

# F01 Sign in and account

No passwords, no extra questions. Email at launch, Google and Microsoft later. Every entry keeps its intent.

## Flow

- **1 Arrive** (S01 Landing): Start free, Import, Use my agent, or Sign in. Each keeps its intent.
- **Signed in?**
- **2 Choose a way in** (S02 Sign in): Email at launch. Google and Microsoft later.
- **3a Google or Microsoft** (Later: X1 Google, X2 Microsoft): Placeholder, switched on after launch
- **3b Confirm email** (S03 Check your email): Click the link, or type the code
- **4 Land where they meant to go** (S04 Home): New deck or import opens right away. Otherwise Home.

Arrow labels: yes, already signed in; no; later; Email, at launch; link expired or wrong code: try again

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| 1 Arrive | S01 Landing | airdesign.app | The person picks an intent: start free, import a PowerPoint, use my own agent, or sign in. The intent is kept through sign-in. | Signed in: 4. Else: 2 |
| 2 Choose a way in | S02 Sign in | /signin | The person gives an email. Google and Microsoft come later. | 3b now, 3a later |
| 3a Google or Microsoft, later | X1 Google, X2 Microsoft | outside | Placeholder. The person picks an account. Cancel returns to step 2. | 4 |
| 3b Confirm email | S03 Check your email | /signin/check | A link and a code are sent. Either one signs them in. Resend after 30 s. The address can be changed. | 4 |
| 4 Land where they meant to go | S04 Home | /home or intent | Goes to the kept intent: a new deck, an import, or connecting their agent. First time: starter credits. Returning: their decks. | F02, F05 or F06 |

Codes follow the order flows are mapped. A screen keeps its first code in every later flow.

## Account basics

| Item | Detail |
|---|---|
| Profile | Name, email, sign-in methods. Add or remove Google and Microsoft. |
| Sign out | Ends this session, back to the landing page. |
| Sign out everywhere | Ends every session. Agents are revoked in Connected agents. |
| Delete account | Offers a data export first, cancels the plan, asks for an explicit confirmation. Data removed within 30 days. |

## Rules

- At launch: email with a link and a code. No passwords.
- Google and Microsoft are placeholders. Microsoft first, because our people live in PowerPoint.
- One account per verified email. Every method links to it.
- No name step. The first part of the email is used until they set a name in Profile.
- Every entry keeps its intent through sign-in.
- Links last 15 minutes and work once. Codes autofill. Resend after 30 seconds.
- Starter credits once per normalized email. Turnstile guards the email send.
- Sessions last 30 days and renew when used.
- Built on Better Auth in the access module. Emails sent with Resend.
