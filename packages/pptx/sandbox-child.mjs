const held = []

function touch(bytes) {
  const block = new Uint8Array(bytes)
  const page = 4096
  for (let index = 0; index < block.length; index += page) block[index] = 1
  if (block.length > 0) block[block.length - 1] = 1
  return block
}

process.on("message", (message) => {
  if (message?.name === "ping") {
    process.send({ name: "pong" })
    return
  }
  if (message?.name !== "grow") return
  const step = 1024 * 1024
  let filled = 0
  while (filled < message.bytes) {
    const size = Math.min(step, message.bytes - filled)
    held.push(touch(size))
    filled += size
  }
  process.send({ name: "grew", bytes: filled })
})
