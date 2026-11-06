import {spawnSync} from "node:child_process"
import {expect,it} from "vitest"

it("denies DNS record and resolver APIs before an outbound attempt",() => {
  const result = spawnSync(process.execPath,["--import",new URL("../src/container-network.ts",import.meta.url).href,"--input-type=module","-e",`
    import dns from "node:dns"
    dns.setServers(["127.0.0.1:9"])
    const resolver = new dns.Resolver()
    const promised = new dns.promises.Resolver()
    resolver.setServers(["127.0.0.1:9"])
    promised.setServers(["127.0.0.1:9"])
    const attempts = [
      () => dns.lookupService("127.0.0.1",80,() => {}),
      () => dns.resolve4("example.invalid",() => {}),
      () => dns.reverse("127.0.0.1",() => {}),
      () => dns.promises.resolve4("example.invalid").catch(() => {}),
      () => resolver.resolve4("example.invalid",() => {}),
      () => promised.resolve4("example.invalid").catch(() => {})
    ]
    process.stdout.write(JSON.stringify(attempts.map(attempt => {
      try { attempt(); return "allowed" } catch (error) { return error.message }
    })))
    process.exit(0)
  `],{encoding:"utf8",timeout:5000})
  expect(result.status,result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual(Array(6).fill("job-network-denied"))
})
