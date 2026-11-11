import Anthropic from "@anthropic-ai/sdk"

import type { ModelCall, ModelOpen, Transport } from "./aira.js"

async function* relay(stream: AsyncIterable<unknown>): AsyncIterable<unknown> {
  try {
    for await (const event of stream) yield event
  } catch (error) {
    if (!(error instanceof Anthropic.APIError)) throw error
    yield { type: "error", error: { type: error.type ?? "api_error", message: error.apiMessage ?? "" } }
  }
}

function failed(error: InstanceType<typeof Anthropic.APIError>): ModelOpen {
  return {
    ok: false,
    request: error.requestID ?? null,
    status: error.status ?? 0,
    type: error.type ?? "api_error",
    message: error.apiMessage ?? "",
  }
}

export function anthropicTransport(baseURL?: string): Transport {
  const clients = new Map<string, Anthropic>()
  return async (call: ModelCall, key: string): Promise<ModelOpen> => {
    const client =
      clients.get(key) ?? new Anthropic({ apiKey: key, maxRetries: 0, ...(baseURL === undefined ? {} : { baseURL }) })
    clients.set(key, client)
    try {
      const { data, request_id } = await client.messages
        .create({
          model: call.model,
          max_tokens: call.max_tokens,
          system: call.system,
          messages: call.messages.map((message) => ({ role: message.role, content: message.content })),
          metadata: { user_id: call.metadata.user_id },
          output_config: { effort: call.output_config.effort },
          stream: true,
        })
        .withResponse()
      return { ok: true, request: request_id ?? null, events: relay(data) }
    } catch (error) {
      if (error instanceof Anthropic.APIError) return failed(error)
      throw error
    }
  }
}
