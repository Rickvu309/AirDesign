export function MailProviderMark({ provider }: { provider: "outlook" | "gmail" }) {
  return provider === "gmail"
    ? <svg className="ad-mail-provider" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="var(--logo-google-blue)" d="M2 6v14h4V9z"/><path fill="var(--logo-google-green)" d="m18 9 4-3v14h-4z"/><path fill="var(--logo-google-red)" d="m2 6 10 8L22 6l-4-3-6 5-6-5z"/><path fill="var(--logo-google-yellow)" d="m18 3 4 3v5l-4-3z"/><path fill="var(--logo-google-dark-red)" d="M2 6 6 3v5l-4 3z"/></svg>
    : <svg className="ad-mail-provider" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="var(--logo-outlook-light)" d="M9 3h13v17H9z"/><path fill="var(--logo-outlook-blue)" d="m9 10 7 5 6-5v11H9z"/><path fill="var(--logo-outlook-dark)" d="m1 5 12-3v20L1 19z"/><ellipse cx="7" cy="12" rx="2.6" ry="4" fill="none" stroke="var(--card)" strokeWidth="1.5"/></svg>
}
