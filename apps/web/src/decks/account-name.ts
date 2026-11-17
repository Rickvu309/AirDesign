export function accountName(email: string): string {
  const words = email
    .slice(0, email.indexOf("@") === -1 ? email.length : email.indexOf("@"))
    .split("+")[0]
    .split(/[._-]+/)
    .map((word) => word.replace(/\d+$/, ""))
    .filter((word) => word !== "")
  if (words.length === 0) return email
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}
