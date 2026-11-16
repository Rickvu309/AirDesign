const fields = {
  input: "input_tokens",
  read: "cache_read_input_tokens",
  write: "cache_creation_input_tokens",
  output: "output_tokens",
}

function tally(counts, usage) {
  for (const [field, name] of Object.entries(fields)) if (typeof usage?.[name] === "number") counts[field] = usage[name]
}

async function* counted(events, write) {
  const counts = { input: 0, read: 0, write: 0, output: 0 }
  try {
    for await (const event of events) {
      if (event?.type === "message_start") tally(counts, event.message?.usage)
      if (event?.type === "message_delta") tally(counts, event.usage)
      yield event
    }
  } finally {
    write(counts)
  }
}

export function countedTransport(transport, write) {
  return async (call, key, signal) => {
    const opened = await transport(call, key, signal)
    return opened.ok ? { ...opened, events: counted(opened.events, write) } : opened
  }
}
