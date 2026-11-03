import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ChangeLog, OfflineQueue, keys, type Actor, type Command, type Key, type Write } from "./log.js";

const options = { numRuns: 5000, seed: 20261103 };
const keyArb = fc.constantFrom(...keys);
const writesArb = fc.uniqueArray(fc.record({ key: keyArb, value: fc.string({ maxLength: 20 }) }), {
  minLength: 1, maxLength: 4, selector: write => write.key,
});
const stepArb = fc.record({
  actor: fc.constantFrom<Actor>("person", "agent"),
  run: fc.constantFrom("r0", "r1", "r2"),
  writes: writesArb,
  stale: fc.boolean(),
});
const stepsArb = fc.array(stepArb, { minLength: 1, maxLength: 80 });
type Step = typeof stepArb extends fc.Arbitrary<infer T> ? T : never;
function command(log: ChangeLog, step: Step, id: string): Command {
  const state = log.read();
  return { kind: "commit", id, actor: step.actor,
    run: step.actor === "person" ? "person-session" : step.run,
    writes: step.writes.map(w => ({ ...w, base: step.stale ? 0 : state.versions[w.key] })),
  };
}
function set(log: ChangeLog, id: string, actor: Actor, run: string, key: Key, value: string, base = log.read().versions[key]) {
  return log.execute({ kind: "commit", id, actor, run, writes: [{ key, value, base }] });
}

describe("5000 seeded cases per property", () => {
  it("Undo run preserves every later person edit and all other retained contributions", () => {
    fc.assert(fc.property(stepsArb, fc.constantFrom("r0", "r1", "r2"), (steps, target) => {
      const log = new ChangeLog();
      const accepted: { actor: Actor; run: string; writes: Write[] }[] = [];
      for (const [i, step] of steps.entries()) {
        const input = command(log, step, `c${i}`);
        const result = log.execute(input);
        if (input.kind === "commit" && result.kind === "accepted") accepted.push(input);
      }
      const expected = { "a.text": "", "a.x": "", "b.text": "", "b.x": "" };
      for (const event of accepted) {
        if (event.run !== target) for (const w of event.writes) expected[w.key] = w.value;
      }
      const personValues = new Map<Key, string>();
      for (const event of accepted) if (event.actor === "person") {
        for (const w of event.writes) personValues.set(w.key, w.value);
      }
      log.execute({ kind: "undo", id: "undo", run: target });
      expect(log.read().deck).toEqual(expected);
      for (const [key, value] of personValues) expect(log.read().deck[key]).toBe(value);
    }), options);
  });

  it("replaying each accepted/refused commit and undo twice changes nothing", () => {
    fc.assert(fc.property(stepsArb, steps => {
      const log = new ChangeLog();
      for (const [i, step] of steps.entries()) {
        const input = command(log, step, `c${i}`);
        const result = log.execute(input);
        const before = { state: log.read(), history: log.history() };
        expect(log.execute(input)).toEqual(result);
        expect({ state: log.read(), history: log.history() }).toEqual(before);
      }
      const undo: Command = { kind: "undo", id: "undo", run: "r0" };
      const result = log.execute(undo);
      const before = log.read();
      expect(log.execute(undo)).toEqual(result);
      expect(log.read()).toEqual(before);
    }), options);
  });

  it("every generated interleaving preserves latest person values, including fresh-read agents", () => {
    fc.assert(fc.property(stepsArb, steps => {
      const log = new ChangeLog();
      const personValues = new Map<Key, string>();
      for (const [i, step] of steps.entries()) {
        const input = command(log, step, `c${i}`);
        const result = log.execute(input);
        if (step.actor === "person") {
          expect(result.kind).toBe("accepted");
          for (const w of step.writes) personValues.set(w.key, w.value);
        }
        for (const [key, value] of personValues) expect(log.read().deck[key]).toBe(value);
      }
    }), options);
  });

  it("offline replay with lost ACK and queue reconstruction equals uninterrupted delivery", () => {
    fc.assert(fc.property(stepsArb, steps => {
      const online = new ChangeLog();
      const offline = new ChangeLog();
      const queue = new OfflineQueue();
      const inputs = steps.map((step, i) => command(online, step, `c${i}`));
      for (const input of inputs) { online.execute(input); queue.enqueue(input); }
      queue.replay(offline);
      const before = offline.read();
      const restored = new OfflineQueue(queue.snapshot());
      for (const receipt of restored.replay(offline)) restored.acknowledge(receipt.id);
      expect(offline.read()).toEqual(before);
      expect(offline.read()).toEqual(online.read());
      expect(restored.snapshot()).toEqual([]);
    }), options);
  });
});

it("property conflicts refuse the entire batch; unrelated properties remain writable", () => {
  const log = new ChangeLog();
  set(log, "a", "agent", "r0", "a.text", "first");
  const before = log.read();
  expect(log.execute({ kind: "commit", id: "b", actor: "agent", run: "r1", writes: [
    { key: "b.x", value: "must not leak", base: 0 }, { key: "a.text", value: "stale", base: 0 },
  ] })).toEqual({ kind: "refused", reason: "conflict" });
  expect(log.read()).toEqual(before);
  expect(set(log, "c", "agent", "r1", "a.x", "10", 0).kind).toBe("accepted");
});

it("person wins in both arrival orders; own tabs use server arrival order", () => {
  for (const personFirst of [true, false]) {
    const log = new ChangeLog();
    if (!personFirst) set(log, "a", "agent", "r0", "a.text", "agent", 0);
    set(log, "p", "person", "person-session", "a.text", "person", 0);
    if (personFirst) set(log, "a", "agent", "r0", "a.text", "agent", 0);
    expect(log.read().deck["a.text"]).toBe("person");
    expect(set(log, "fresh", "agent", "r1", "a.text", "overwrite")).toEqual({ kind: "refused", reason: "person-owned" });
    set(log, "tab2", "person", "person-session", "a.text", "latest tab", 0);
    expect(log.read().deck["a.text"]).toBe("latest tab");
  }
});

it("undo never resurrects an already undone run and closes its late writes", () => {
  const log = new ChangeLog();
  set(log, "a", "agent", "r0", "a.text", "A");
  set(log, "b", "agent", "r1", "a.text", "B");
  log.execute({ kind: "undo", id: "u0", run: "r0" });
  expect(log.read().deck["a.text"]).toBe("B");
  log.execute({ kind: "undo", id: "u1", run: "r1" });
  expect(log.read().deck["a.text"]).toBe("");
  expect(set(log, "late", "agent", "r0", "a.text", "zombie")).toEqual({ kind: "refused", reason: "run-undone" });
});

it("undo advances versions even when restoring an equal value (ABA)", () => {
  const log = new ChangeLog();
  set(log, "a", "agent", "r0", "a.text", "");
  const old = log.read().versions["a.text"];
  log.execute({ kind: "undo", id: "u", run: "r0" });
  expect(set(log, "stale", "agent", "r1", "a.text", "stale", old)).toEqual({ kind: "refused", reason: "conflict" });
});

it("same id with different payload is refused; caller mutation cannot alter receipts/history", () => {
  const log = new ChangeLog();
  const input: Command = { kind: "commit", id: "a", actor: "agent", run: "r0", writes: [{ key: "a.x", value: "1", base: 0 }] };
  const result = log.execute(input);
  if (result.kind === "accepted") result.sequence = 999;
  expect(log.execute(input)).toEqual({ kind: "accepted", sequence: 1 });
  input.writes.push({ key: "b.x", value: "2", base: 0 });
  expect(log.execute(input)).toEqual({ kind: "refused", reason: "id-reused" });
  expect(log.history()[0]?.command).not.toEqual(input);
});

it("offline person edits beat intervening agents; stale queued agents remain refused after retry", () => {
  const log = new ChangeLog();
  const queue = new OfflineQueue();
  queue.enqueue({ kind: "commit", id: "offline-p", actor: "person", run: "person-session", writes: [{ key: "a.text", value: "mine", base: 0 }] });
  queue.enqueue({ kind: "commit", id: "offline-a", actor: "agent", run: "r1", writes: [{ key: "b.x", value: "stale", base: 0 }] });
  set(log, "live-a", "agent", "r0", "a.text", "theirs");
  set(log, "live-b", "agent", "r0", "b.x", "current");
  const receipts = queue.replay(log);
  expect(receipts.map(r => r.result.kind)).toEqual(["accepted", "refused"]);
  expect(log.read().deck["a.text"]).toBe("mine");
  expect(log.read().deck["b.x"]).toBe("current");
  expect(queue.replay(log)).toEqual(receipts);
});
