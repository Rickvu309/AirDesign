import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

const region = "asia-southeast1-eqsg3a";
const volumeAlerts = { usage: { "100": {}, "80": {}, "95": {} } };

export default defineRailway(() => {
  const database = postgres("Postgres-d8At", { region });
  database.networking = { privateNetworkEndpoint: "postgres-d8at" };
  const workerVolume = volume("worker-volume", { alerts: volumeAlerts, allowOnlineResize: true, region, sizeMB: 5000 });
  const webVolume = volume("web-volume", { alerts: volumeAlerts, allowOnlineResize: true, region, sizeMB: 5000 });
  const databaseVolume = volume("postgres-volume-7MuZ", { alerts: volumeAlerts, allowOnlineResize: true, region, sizeMB: 5000 });
  const source = github("Rickvu309/AirDesign", { branch: "main", checkSuites: false });
  const build = { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" } as const;

  const web = service("web", {
    source,
    build,
    start: "/app/scripts/docker/entrypoint.sh",
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    replicas: { [region]: 1 },
    domains: ["mcp.airdesign.app", "studio.airdesign.app"],
    volumeMounts: { "/data": webVolume },
    variables: {
      NODE_ENV: "production",
      PORT: "8080",
      AIRDESIGN_PUBLIC_ORIGIN: "https://studio.airdesign.app",
      AIRDESIGN_MCP_ORIGIN: "https://mcp.airdesign.app",
      AIRDESIGN_OPERATIONS_PATH: "/data/operations.sqlite",
      AIRDESIGN_CLAUDE_MODEL: "claude-sonnet-5-5",
      AIRDESIGN_SMOKE_EMAILS: "smoke@airdesign.app",
      MAIL_FROM: "AirDesign <hello@airdesign.app>",
      DATABASE_URL: preserve(),
      AIRDESIGN_SECRET: preserve(),
      AIRDESIGN_CLAUDE_KEY: preserve(),
      RESEND_API_KEY: preserve(),
    },
  });

  const worker = service("worker", {
    source,
    build,
    start: "/app/scripts/docker/entrypoint.sh",
    replicas: { [region]: 1 },
    volumeMounts: { "/data": workerVolume },
    variables: {
      NODE_ENV: "production",
      AIRDESIGN_ROLE: "worker",
      AIRDESIGN_ISOLATION: "container",
      RAILWAY_DEPLOYMENT_DRAINING_SECONDS: "5",
      AIRDESIGN_OPERATIONS_PATH: "/data/operations.sqlite",
      AIRDESIGN_WORKER_TEMP: "/data/jobs",
      AIRDESIGN_WORKER_API_ORIGIN: "http://web.railway.internal:8080",
      DATABASE_URL: preserve(),
      AIRDESIGN_SECRET: preserve(),
    },
  });

  return project("airdesign", {
    resources: [web, worker, database, workerVolume, webVolume, databaseVolume],
  });
});
