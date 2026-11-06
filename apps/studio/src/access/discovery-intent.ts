import {isIntentKind,type IntentKind} from "@airdesign/access/client"
export function discoveryIntent(location: {pathname: string; search: string}): IntentKind {
  if(location.pathname === "/agents/approve") return "connect-agent"
  const requested=new URLSearchParams(location.search).get("start")
  return requested && isIntentKind(requested) ? requested : "home"
}
