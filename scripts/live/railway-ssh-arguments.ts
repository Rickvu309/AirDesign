export type RailwayTarget = { kind: "linked" } | { kind: "explicit"; project: string; environment: string }

export function railwayTarget(project: string | undefined, environment: string | undefined): RailwayTarget {
  if (project === undefined && environment === undefined) return { kind: "linked" }
  if (!project || !environment) throw new Error("railway-target-needs-project-and-environment")
  return { kind: "explicit", project, environment }
}

export function railwaySshArguments(target: RailwayTarget, command: readonly string[]): string[] {
  switch (target.kind) {
    case "linked":
      return ["ssh", "--service", "web", "--", ...command]
    case "explicit":
      return ["ssh", "--project", target.project, "--environment", target.environment, "--service", "web", "--", ...command]
  }
}
