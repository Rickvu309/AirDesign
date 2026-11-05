export type MailMessage = {
  to: string
  code: string
  linkToken: string
  sentAt: number
}

export type MailAdapter = {
  send(message: MailMessage): Promise<void>
}

export type MemoryInbox = MailAdapter & {
  read(to: string): MailMessage[]
  lastDeliveryMs(): number
}

export function createMemoryInbox(): MemoryInbox {
  const messages: MailMessage[] = []
  let deliveryMs = 0
  return {
    async send(message) {
      const started = performance.now()
      messages.push(message)
      deliveryMs = performance.now() - started
    },
    read(to) {
      return messages.filter((message) => message.to === to)
    },
    lastDeliveryMs() {
      return deliveryMs
    },
  }
}
