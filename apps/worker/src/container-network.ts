import net from "node:net"
import http from "node:http"
import https from "node:https"
import tls from "node:tls"
import dgram from "node:dgram"
import dns from "node:dns"
import {syncBuiltinESMExports} from "node:module"

const denied = () => { throw new Error("job-network-denied") }
net.Socket.prototype.connect = denied
net.connect = denied
net.createConnection = denied
http.request = denied
http.get = denied
https.request = denied
https.get = denied
tls.connect = denied
dgram.createSocket = denied
for (const resolver of [dns,dns.promises,dns.Resolver.prototype,dns.promises.Resolver.prototype]) {
  for (const name of Object.getOwnPropertyNames(resolver)) {
    if (/^(lookup|resolve|reverse)/.test(name) && typeof Object.getOwnPropertyDescriptor(resolver,name)?.value === "function") {
      Object.defineProperty(resolver,name,{value:Object.assign(denied,{__promisify__:denied})})
    }
  }
}
globalThis.fetch = denied
globalThis.WebSocket = class extends WebSocket { constructor() { super("ws://127.0.0.1"); denied() } }
syncBuiltinESMExports()
