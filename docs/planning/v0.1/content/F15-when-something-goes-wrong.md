_AirDesign / v0.1 / F15, across every flow_

# F15 When something goes wrong

One pattern everywhere: say what happened, say what is safe, offer one next step. Saved work is never lost.

## Flow

- **1 Something fails** (Where it happened)
- **Fixes itself?**
- **2 Told plainly** (Where it happened)
- **3 One next step** (Where it happened)
- **Back on track** (The flow it came from)

Arrow labels: yes: retried quietly, up to 3 times; no

## Failure map: what happened, what is safe, next step

| Failure | What is safe | Next step |
|---|---|---|
| Agent run fails | Changes so far stay | Resume, or Undo run. Credits for a failure on our side return. F02, F03. |
| Credits run out mid-run | The current change finishes | Top up or upgrade, then send the kept request. F07. |
| Agent connection ended mid-run | Changes so far stay | Connect again. F06. |
| Import refused | Nothing saved | Fix the file as told, try again. F05. |
| Export fails | The deck is untouched | Retry. The same version builds again. F04. |
| Image refused | Nothing added | Use another file. F12. |
| Sign-in link expired or code wrong | Nothing changed | Send a new link and code. F01. |
| Payment fails | Nothing charged | Try another card. F07. |
| Connection lost | Edits are kept on this device | Keep working. They are sent when the connection is back. |
| User Agent rate limited | Nothing lost | The agent is told when to retry. |
| AirDesign is down | Saved work is safe | A status page says what is known. Try again later. |

No new codes in F15. It shows where the failure happens. Next free codes are S15 and X7.

## Rules

- Saved work is never lost.
- Every message says what happened, what is safe, and one next step. Plain words, no blame.
- Short glitches retry quietly, up to 3 times. If it takes over 3 s, the person is told it is retrying.
- Agents get the same failures as structured errors, with a retry hint.
- Every failure carries a reference that support can trace.
- Edits sent after a lost connection follow the same rules: the person wins over agents, and between the person's own tabs the latest change to each property wins.
