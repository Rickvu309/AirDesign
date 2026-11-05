export type Actor = "person" | "agent";
export type Key = "a.text" | "a.x" | "b.text" | "b.x";
export const keys: Key[] = ["a.text", "a.x", "b.text", "b.x"];
export type Deck = Record<Key, string>;
export type Write = { key: Key; value: string; base: number };
export type Command =
  | { kind: "commit"; id: string; actor: Actor; run: string; writes: Write[] }
  | { kind: "undo"; id: string; run: string };
export type Result =
  | { kind: "accepted"; sequence: number }
  | { kind: "refused"; reason: "conflict" | "person-owned" | "invalid" | "run-undone" | "id-reused" };
type Event = { sequence: number; command: Command };
type Receipt = { fingerprint: string; result: Result };

export class ChangeLog {
  private events: Event[] = [];
  private receipts = new Map<string, Receipt>();
  private versions: Record<Key, number> = { "a.text": 0, "a.x": 0, "b.text": 0, "b.x": 0 };
  private protectedKeys = new Set<Key>();
  private undone = new Set<string>();
  private deck: Deck = { "a.text": "", "a.x": "", "b.text": "", "b.x": "" };

  read() {
    return { deck: { ...this.deck }, versions: { ...this.versions }, sequence: this.events.length };
  }

  history(): readonly Event[] {
    return structuredClone(this.events);
  }

  execute(input: Command): Result {
    const command = structuredClone(input);
    const fingerprint = JSON.stringify(command);
    const prior = this.receipts.get(command.id);
    if (prior) {
      return prior.fingerprint === fingerprint
        ? structuredClone(prior.result)
        : { kind: "refused", reason: "id-reused" };
    }
    const finish = (result: Result): Result => {
      this.receipts.set(command.id, { fingerprint, result: structuredClone(result) });
      return result;
    };
    if (command.kind === "commit") {
      if (this.undone.has(command.run)) return finish({ kind: "refused", reason: "run-undone" });
      if (command.writes.length === 0 || new Set(command.writes.map(w => w.key)).size !== command.writes.length ||
          command.writes.some(w => !Number.isSafeInteger(w.base) || w.base < 0 || w.base > this.events.length)) {
        return finish({ kind: "refused", reason: "invalid" });
      }
      for (const write of command.writes) {
        if (command.actor === "agent") {
          if (this.protectedKeys.has(write.key)) return finish({ kind: "refused", reason: "person-owned" });
          if (this.versions[write.key] !== write.base) return finish({ kind: "refused", reason: "conflict" });
        }
      }
      const sequence = this.events.length + 1;
      this.events.push({ sequence, command });
      for (const write of command.writes) {
        this.deck[write.key] = write.value;
        this.versions[write.key] = sequence;
        if (command.actor === "person") this.protectedKeys.add(write.key);
      }
      return finish({ kind: "accepted", sequence });
    }
    const before = { ...this.deck };
    this.undone.add(command.run);
    const next: Deck = { "a.text": "", "a.x": "", "b.text": "", "b.x": "" };
    for (const event of this.events) {
      const candidate = event.command;
      if (candidate.kind === "commit" && !this.undone.has(candidate.run)) {
        for (const write of candidate.writes) next[write.key] = write.value;
      }
    }
    const sequence = this.events.length + 1;
    this.events.push({ sequence, command });
    this.deck = next;
    for (const key of keys) {
      const touchedByRun = this.events.some(event => event.command.kind === "commit" &&
        event.command.run === command.run && event.command.writes.some(w => w.key === key));
      if (before[key] !== next[key] || touchedByRun) this.versions[key] = sequence;
    }
    return finish({ kind: "accepted", sequence });
  }
}

export class OfflineQueue {
  private pending: Command[];
  constructor(snapshot: readonly Command[] = []) {
    this.pending = structuredClone([...snapshot]);
  }
  enqueue(command: Command) {
    this.pending.push(structuredClone(command));
  }
  snapshot() {
    return structuredClone(this.pending);
  }
  replay(log: ChangeLog) {
    return this.pending.map(command => ({ id: command.id, result: log.execute(command) }));
  }
  acknowledge(id: string) {
    this.pending = this.pending.filter(command => command.id !== id);
  }
}
