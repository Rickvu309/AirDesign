export const baseFault = (number, base) =>
  base === "main"
    ? undefined
    : `pull request ${number} targets ${base}, and every pull request targets main. A branch of another pull request has no merge queue, so a merge there lands with no ci, and a later force-push of that branch drops it. Fix: gh pr edit ${number} --base main, and wait for the other pull request to merge before this one.`
