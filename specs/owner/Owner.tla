---- MODULE Owner ----
EXTENDS Integers

VARIABLES codeA, generationA, revokedA, codeB, generationB, revokedB,
          callAccount, callDeck, callOutcome

vars == <<codeA, generationA, revokedA, codeB, generationB, revokedB,
          callAccount, callDeck, callOutcome>>

Accounts == {"a", "b"}
Decks == {"deckA", "deckB", "unmade"}
Max == 2

Owner(deck) == CASE deck = "deckA" -> "a"
                 [] deck = "deckB" -> "b"
                 [] OTHER -> "nobody"

Code(account) == IF account = "a" THEN codeA ELSE codeB
Generation(account) == IF account = "a" THEN generationA ELSE generationB
Revoked(account) == IF account = "a" THEN revokedA ELSE revokedB

TypeOK ==
  /\ codeA \in {"none", "client", "open", "used"}
  /\ codeB \in {"none", "client", "open", "used"}
  /\ generationA \in 0..Max
  /\ generationB \in 0..Max
  /\ revokedA \in BOOLEAN
  /\ revokedB \in BOOLEAN
  /\ callAccount \in Accounts \cup {"nobody"}
  /\ callDeck \in Decks \cup {"none"}
  /\ callOutcome \in {"none", "landed", "owner", "deck", "invalid"}

\* Only the deck's owner can act on it through a tool call:
\* every accepted tool call's deck is owned by the account behind its credential.
OnlyOwnerActs == callOutcome = "landed" => Owner(callDeck) = callAccount

Init ==
  /\ codeA = "none" /\ generationA = 0 /\ revokedA = FALSE
  /\ codeB = "none" /\ generationB = 0 /\ revokedB = FALSE
  /\ callAccount = "nobody" /\ callDeck = "none" /\ callOutcome = "none"

calls == <<callAccount, callDeck, callOutcome>>

Grant(account, code, generation, revoked) ==
  IF account = "a"
  THEN /\ codeA' = code /\ generationA' = generation /\ revokedA' = revoked
       /\ UNCHANGED <<codeB, generationB, revokedB>>
  ELSE /\ codeB' = code /\ generationB' = generation /\ revokedB' = revoked
       /\ UNCHANGED <<codeA, generationA, revokedA>>

Register ==
  \E account \in Accounts :
    /\ Code(account) = "none"
    /\ Grant(account, "client", 0, FALSE)
    /\ UNCHANGED calls

Approve ==
  \E account \in Accounts :
    /\ Code(account) = "client"
    /\ Grant(account, "open", 0, FALSE)
    /\ UNCHANGED calls

Exchange ==
  \E account \in Accounts :
    /\ Code(account) = "open"
    /\ Grant(account, "used", 1, FALSE)
    /\ UNCHANGED calls

ExchangeAgain ==
  \E account \in Accounts :
    /\ Code(account) = "used"
    /\ Grant(account, "used", Generation(account), TRUE)
    /\ UNCHANGED calls

Rotate ==
  \E account \in Accounts :
    /\ Code(account) = "used"
    /\ ~Revoked(account)
    /\ Generation(account) < Max
    /\ Grant(account, "used", Generation(account) + 1, FALSE)
    /\ UNCHANGED calls

ReplayRotated ==
  \E account \in Accounts :
    /\ Code(account) = "used"
    /\ ~Revoked(account)
    /\ Generation(account) > 1
    /\ Grant(account, "used", Generation(account), TRUE)
    /\ UNCHANGED calls

Revoke ==
  \E account \in Accounts :
    /\ Code(account) = "used"
    /\ ~Revoked(account)
    /\ Grant(account, "used", Generation(account), TRUE)
    /\ UNCHANGED calls

grants == <<codeA, generationA, revokedA, codeB, generationB, revokedB>>

Outcome(account, deck) ==
  IF deck = "unmade" THEN "deck"
  ELSE IF Owner(deck) # account THEN "owner"
  ELSE "landed"

Call(account, deck) ==
  /\ callAccount' = account
  /\ callDeck' = deck
  /\ callOutcome' = Outcome(account, deck)
  /\ UNCHANGED grants

Refuse ==
  /\ callAccount' = "nobody"
  /\ callDeck' = "none"
  /\ callOutcome' = "invalid"
  /\ UNCHANGED grants

Live(account, generation) ==
  /\ Code(account) = "used"
  /\ ~Revoked(account)
  /\ Generation(account) = generation

CookieCall ==
  \E account \in Accounts, deck \in Decks : Call(account, deck)

TokenCall ==
  \E account \in Accounts, generation \in 1..Max, deck \in Decks :
    /\ Live(account, generation)
    /\ Call(account, deck)

TokenRefused ==
  \E account \in Accounts, generation \in 1..Max :
    /\ ~Live(account, generation)
    /\ Refuse

RefreshAsBearer ==
  Refuse

Next ==
  \/ Register
  \/ Approve
  \/ Exchange
  \/ ExchangeAgain
  \/ Rotate
  \/ ReplayRotated
  \/ Revoke
  \/ CookieCall
  \/ TokenCall
  \/ TokenRefused
  \/ RefreshAsBearer

Spec == Init /\ [][Next]_vars

====
