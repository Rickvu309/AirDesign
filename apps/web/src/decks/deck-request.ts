import { signInAddress } from "@/account/sign-in-address"

export async function post(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const answer = await response.json()
  if (response.status === 401 && answer.refusal === "session") window.location.assign(signInAddress(window.location))
  return answer
}

export async function answered(path: string, body: object): Promise<boolean> {
  try {
    return (await post(path, body)).ok === true
  } catch {
    return false
  }
}
