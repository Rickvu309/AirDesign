import { signOutRoutes } from "@airdesign/catalog"
import { signInAddress } from "@/account/sign-in-address"

export async function signOut(): Promise<void> {
  const response = await fetch(signOutRoutes.session.path, { method: signOutRoutes.session.method })
  if (response.ok) window.location.assign(signInAddress(window.location))
}
