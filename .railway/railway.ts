import { bucket, defineRailway, github, postgres, project, service, volume } from "railway/iac"

type CliProjectDefinition = Parameters<typeof project>[1] & { variables: { managed: boolean } }

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "asia-southeast1-eqsg3a" })
  Postgres.networking = { privateNetworkEndpoint: "postgres" }
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "asia-southeast1-eqsg3a",
    sizeMB: 5000,
  })
  const PostgresPITR = bucket("Postgres-PITR", { region: "sin" })
  const api = service("api", {
    source: github("Rickvu309/AirDesign", { branch: "green", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "RAILPACK", buildCommand: "pnpm --filter @airdesign/api... build" },
    start: "node apps/api/dist/start.js",
    healthcheck: "/health",
    healthcheckTimeout: 60,
    preDeploy: "node apps/api/dist/setup.js",
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
  })

  const definition: CliProjectDefinition = {
    variables: { managed: false },
    resources: [Postgres, api, postgresVolume, PostgresPITR],
  }
  return project("airdesign-next", definition)
})
