const oldDeploymentPaths = ["/pricing", "/agents", "/status", "/assets", "/agent-instructions.txt"];

function isOldDeploymentPath(pathname: string): boolean {
  return oldDeploymentPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default {
  fetch(request: Request): Promise<Response> | Response {
    if (isOldDeploymentPath(new URL(request.url).pathname)) {
      return fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
