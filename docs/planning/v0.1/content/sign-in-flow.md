# Sign In Flow

AirDesign / v0.1 / F01

F01 Sign in and account

No passwords, no extra questions. Email link and code at launch. Every entry keeps its intent.

Screen

Outside AirDesign

Decision

yes, already signed in

no

later

Email, at launch

link expired or wrong code: try again

S11 Landing

1 Arrive

Start free, Import, Use my agent, or Sign in. Each keeps its intent.

Signed in?

S21 Sign in

2 Choose a way in

Email link and code. No other methods at launch.

Later, not at launch: X1 Google, X2 Microsoft

3a Google or Microsoft, later

Placeholder, switched on after launch

S22 Check your email

3b Confirm email

Click the link, or type the code

S31 Home

4 Land where they meant to go

New deck or import opens right away. Otherwise Home.

Steps and screens

Step

Screen

Route

What happens

Goes to

1 Arrive

S11 Landing

airdesign.app

The person picks an intent: start free, import a PowerPoint, use my own agent, or sign in. The intent is kept through sign-in.

Signed in: 4. Else: 2

2 Choose a way in

S21 Sign in

/signin

The person gives an email. It is the only method at launch.

3b now, 3a later

3a Google or Microsoft, later

X1 Google, X2 Microsoft

outside

Placeholder. The person picks an account. Cancel returns to step 2.

4

3b Confirm email

S22 Check your email

/signin/check

A link and a code are sent. Either one signs them in. Resend after 30 s. The address can be changed.

4

4 Land where they meant to go

S31 Home

/home or intent

Goes to the kept intent: a new deck, an import, or connecting their agent. First time: a full week of usage. Returning: their decks.

F02, F05 or F06

Screen codes are S, an area digit and a flow digit, then the screen: S42.01 is Editor (S40), Agent (S42), screen 01. Areas go in tens (S10 Discover to S90 Credits); flow 9 in each area holds its errors. Screens in a flow are numbered in the order things happen. Until build starts, renumber freely to keep that order; after that, new screens take the next number and codes are never reused. Screen names read Code Area / Flow / State, for example S92.02 Credits / Out of usage / Confirm reset.

Account basics

Profile

Name and email. Email is the only sign-in method.

Sign out

Ends this session, back to the landing page.

Sign out everywhere

Not in v0.1. Agents are ended in Settings, Agents.

Delete account

Asks for an explicit confirmation. Unused credits are lost. Data removed within 30 days.

Rules

At launch: email with a link and a code. No passwords.

Google and Microsoft are placeholders. Microsoft first, because our people live in PowerPoint.

One account per verified email. Every method links to it.

No name step. The first part of the email is used until they set a name in Profile.

Every entry keeps its intent through sign-in.

Links last 15 minutes and work once. Codes autofill. Resend after 30 seconds.

One free week of usage per normalized email at sign-up. Turnstile guards the email send.

Sessions last 30 days and renew when used.

Built on Better Auth in the access module. Emails sent with Resend.
