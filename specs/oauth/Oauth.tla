---- MODULE Oauth ----
EXTENDS Integers

VARIABLES principal, openedAs, deck, code, generation, revoked, reused, exchanges, exchangeDeck,
          callNamed, callAt, callDeck, rotateNamed, rotateAt, acceptedAfter

vars == <<principal, openedAs, deck, code, generation, revoked, reused, exchanges, exchangeDeck,
          callNamed, callAt, callDeck, rotateNamed, rotateAt, acceptedAfter>>

Max == 3

TypeOK ==
  /\ principal \in {"person", "agent"}
  /\ openedAs \in {"person", "agent"}
  /\ deck \in {"home", "other"}
  /\ code \in {"open", "used"}
  /\ generation \in 0..Max
  /\ revoked \in BOOLEAN
  /\ reused \in BOOLEAN
  /\ exchanges \in 0..2
  /\ exchangeDeck \in {"none", "home", "other"}
  /\ callNamed \in -1..Max
  /\ callAt \in -1..Max
  /\ callDeck \in {"none", "home", "other"}
  /\ rotateNamed \in -1..Max
  /\ rotateAt \in -1..Max
  /\ acceptedAfter \in BOOLEAN

\* A code works once.
CodeWorksOnce == exchanges <= 1

\* A rotated refresh token never works again.
RotatedRefreshIsDead ==
  /\ callNamed = -1 \/ callNamed = callAt
  /\ rotateNamed = -1 \/ rotateNamed = rotateAt

\* Reuse of a rotated token revokes the family.
ReuseRevokesFamily == reused => revoked

\* After revocation no call and no rotation is accepted.
AfterRevocation == acceptedAfter = FALSE

\* The identity is the stored one.
IdentityIsStored == principal = openedAs

\* A token for one deck does not authorize another.
DeckIsBound ==
  /\ callDeck = "none" \/ callDeck = deck
  /\ exchangeDeck = "none" \/ exchangeDeck = deck

Init ==
  /\ principal \in {"person", "agent"}
  /\ openedAs = principal
  /\ deck \in {"home", "other"}
  /\ code = "open"
  /\ generation = 0
  /\ revoked = FALSE
  /\ reused = FALSE
  /\ exchanges = 0
  /\ exchangeDeck = "none"
  /\ callNamed = -1
  /\ callAt = -1
  /\ callDeck = "none"
  /\ rotateNamed = -1
  /\ rotateAt = -1
  /\ acceptedAfter = FALSE

kept == <<principal, openedAs, deck, revoked, reused, callNamed, callAt, callDeck, rotateNamed, rotateAt, acceptedAfter>>

ExchangeHome ==
  /\ deck = "home"
  /\ code = "open"
  /\ revoked = FALSE
  /\ code' = "used"
  /\ generation' = 1
  /\ exchanges' = exchanges + 1
  /\ exchangeDeck' = "home"
  /\ UNCHANGED kept

ExchangeHomeRefused ==
  /\ ~(deck = "home" /\ code = "open" /\ revoked = FALSE)
  /\ UNCHANGED vars

ExchangeOther ==
  /\ deck = "other"
  /\ code = "open"
  /\ revoked = FALSE
  /\ code' = "used"
  /\ generation' = 1
  /\ exchanges' = exchanges + 1
  /\ exchangeDeck' = "other"
  /\ UNCHANGED kept

ExchangeOtherRefused ==
  /\ ~(deck = "other" /\ code = "open" /\ revoked = FALSE)
  /\ UNCHANGED vars

CallHome0Refused ==
  UNCHANGED vars

CallOther0Refused ==
  UNCHANGED vars

callKept == <<principal, openedAs, deck, code, generation, revoked, reused, exchanges, exchangeDeck, rotateNamed, rotateAt>>

CallHome1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ deck = "home"
  /\ callNamed' = 1
  /\ callAt' = generation
  /\ callDeck' = "home"
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

CallHome1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1 /\ deck = "home")
  /\ UNCHANGED vars

CallHome2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ deck = "home"
  /\ callNamed' = 2
  /\ callAt' = generation
  /\ callDeck' = "home"
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

CallHome2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2 /\ deck = "home")
  /\ UNCHANGED vars

CallHome3 ==
  /\ revoked = FALSE
  /\ generation = 3
  /\ deck = "home"
  /\ callNamed' = 3
  /\ callAt' = generation
  /\ callDeck' = "home"
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

CallHome3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3 /\ deck = "home")
  /\ UNCHANGED vars

CallOther1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ deck = "other"
  /\ callNamed' = 1
  /\ callAt' = generation
  /\ callDeck' = "other"
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

CallOther1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1 /\ deck = "other")
  /\ UNCHANGED vars

CallOther2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ deck = "other"
  /\ callNamed' = 2
  /\ callAt' = generation
  /\ callDeck' = "other"
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

CallOther2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2 /\ deck = "other")
  /\ UNCHANGED vars

CallOther3 ==
  /\ revoked = FALSE
  /\ generation = 3
  /\ deck = "other"
  /\ callNamed' = 3
  /\ callAt' = generation
  /\ callDeck' = "other"
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

CallOther3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3 /\ deck = "other")
  /\ UNCHANGED vars

Rotate0 ==
  UNCHANGED vars

rotateKept == <<principal, openedAs, deck, code, revoked, reused, exchanges, exchangeDeck, callNamed, callAt, callDeck>>

Rotate1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ generation' = 2
  /\ rotateNamed' = 1
  /\ rotateAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED rotateKept

Rotate1Reuse ==
  /\ revoked = FALSE
  /\ generation > 1
  /\ revoked' = TRUE
  /\ reused' = TRUE
  /\ UNCHANGED <<principal, openedAs, deck, code, generation, exchanges, exchangeDeck, callNamed, callAt, callDeck, rotateNamed, rotateAt, acceptedAfter>>

Rotate1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1)
  /\ ~(revoked = FALSE /\ generation > 1)
  /\ UNCHANGED vars

Rotate2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ generation' = 3
  /\ rotateNamed' = 2
  /\ rotateAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED rotateKept

Rotate2Reuse ==
  /\ revoked = FALSE
  /\ generation > 2
  /\ revoked' = TRUE
  /\ reused' = TRUE
  /\ UNCHANGED <<principal, openedAs, deck, code, generation, exchanges, exchangeDeck, callNamed, callAt, callDeck, rotateNamed, rotateAt, acceptedAfter>>

Rotate2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2)
  /\ ~(revoked = FALSE /\ generation > 2)
  /\ UNCHANGED vars

Rotate3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3)
  /\ UNCHANGED vars

Rotate4 ==
  UNCHANGED vars

Revoke ==
  /\ revoked = FALSE
  /\ revoked' = TRUE
  /\ UNCHANGED <<principal, openedAs, deck, code, generation, reused, exchanges, exchangeDeck, callNamed, callAt, callDeck, rotateNamed, rotateAt, acceptedAfter>>

RevokeAgain ==
  /\ revoked = TRUE
  /\ UNCHANGED vars

Next ==
  \/ ExchangeHome
  \/ ExchangeHomeRefused
  \/ ExchangeOther
  \/ ExchangeOtherRefused
  \/ CallHome0Refused
  \/ CallOther0Refused
  \/ CallHome1
  \/ CallHome1Refused
  \/ CallHome2
  \/ CallHome2Refused
  \/ CallHome3
  \/ CallHome3Refused
  \/ CallOther1
  \/ CallOther1Refused
  \/ CallOther2
  \/ CallOther2Refused
  \/ CallOther3
  \/ CallOther3Refused
  \/ Rotate0
  \/ Rotate1
  \/ Rotate1Reuse
  \/ Rotate1Refused
  \/ Rotate2
  \/ Rotate2Reuse
  \/ Rotate2Refused
  \/ Rotate3Refused
  \/ Rotate4
  \/ Revoke
  \/ RevokeAgain

Spec == Init /\ [][Next]_vars

====
