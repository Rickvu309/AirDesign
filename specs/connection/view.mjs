const steps = {
  GoOffline: "the browser goes offline",
  GoOnline: "the browser comes back online",
  ServerDown: "AirDesign stops answering",
  ServerUp: "AirDesign answers again",
  EditRow: "the person edits, and the edit's send joins the lane",
  Send: "the first send in the lane goes on the wire",
  Answer: "its answer comes back",
  Retry: "the resend loop's pause ends and it sends",
  Leave: "the person leaves the deck",
}

const callers = ["", "the online event's", "the resend loop's", "an edit's", "a stopped loop's"]

const words = {
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline, saved on this device",
  unreached: "Unable to reach AirDesign",
}

const status = (v) => (!v.net ? "offline" : !v.pending ? "saved" : v.offline ? "unreached" : "saving")

const sends = (lane) =>
  lane === 0
    ? "no send"
    : String(lane)
        .split("")
        .map((digit) => callers[Number(digit)])
        .join(", ") + " send"

export const state = (v) =>
  `${v.open ? `reads "${words[status(v)]}"` : "deck closed"}; ` +
  `browser ${v.net ? "online" : "offline"}, AirDesign ${v.up ? "answers" : "down"}; ` +
  `${v.rows ? "rows wait on the device" : "nothing waits"}${v.fresh ? " (some after the send left)" : ""}; ` +
  `${sends(v.lane)}${v.started ? ` on the wire${v.carry ? " with rows" : " with none"}` : ""}; ` +
  `resend loop ${v.loop === "off" ? "off" : v.loop === "rest" ? "resting" : "waiting on its send"}`

export const step = (action) => steps[action] ?? null

export const group = (v) => {
  if (!v.open) return "Closed"
  return words[status(v)]
}

export const colors = {
  Saved: "green",
  "Saving…": "blue",
  "Offline, saved on this device": "gray",
  "Unable to reach AirDesign": "orange",
  Closed: "gray",
}

export const title = "The editor follows the network, resends once AirDesign answers, and says where the edits are"
