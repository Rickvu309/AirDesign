const names = { keyEnv: "--model-key-env", model: "--model", effort: "--effort" }

export function airaFlags(args) {
  const choice = {}
  for (const [field, name] of Object.entries(names)) {
    const at = args.indexOf(name)
    if (at !== -1) choice[field] = args[at + 1] ?? ""
  }
  return choice
}

export function airaChoice(args, env, efforts) {
  const choice = airaFlags(args)
  if (choice.keyEnv !== undefined && !env[choice.keyEnv])
    return { ok: false, message: `${names.keyEnv} ${choice.keyEnv} names an empty or unset variable` }
  if (choice.effort !== undefined && !efforts.includes(choice.effort))
    return { ok: false, message: `${names.effort} ${choice.effort} is not one of ${efforts.join(", ")}` }
  if (choice.model !== undefined && !/^claude-[a-z0-9-]+$/.test(choice.model))
    return { ok: false, message: `${names.model} ${choice.model} is not a Claude model id` }
  return { ok: true, choice }
}

export function airaArgs(choice) {
  return Object.entries(names).flatMap(([field, name]) => (choice[field] === undefined ? [] : [name, choice[field]]))
}
