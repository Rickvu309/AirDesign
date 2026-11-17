export const accountFuzzGood = {
  "POST /account/profile": [{ shape: "json", answers: 200, fields: {} }],
  "POST /account/name": [{ shape: "json", answers: 200, fields: { name: "Ada Lovelace" } }],
  "POST /account/agents": [{ shape: "json", answers: 200, says: '"ok":true', fields: {} }],
  "POST /account/agents/revoke": [
    { shape: "json", answers: 403, says: '"refusal":"owner"', fields: { id: "missing" } },
  ],
  "POST /account/delete": [{ shape: "json", answers: 400, fields: { email: "wrong@example.com" } }],
} satisfies Record<
  string,
  readonly {
    shape: "json"
    answers: number
    fields: object
    says?: string
  }[]
>
