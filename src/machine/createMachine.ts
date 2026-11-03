import { useCallback, useReducer } from "react";

/** Any event is an object with a string `type`. */
export interface MachineEvent {
  type: string;
}

/** A transition: a bare target state name, or an object with guard and action. */
export type Transition<C, E extends MachineEvent> =
  | string
  | {
      target?: string;
      /** The transition only fires when this returns true. */
      guard?: (context: C, event: E) => boolean;
      /** Returns a partial context update applied with the transition. */
      action?: (context: C, event: E) => Partial<C>;
    };

export interface StateConfig<C, E extends MachineEvent> {
  on?: Record<string, Transition<C, E> | Transition<C, E>[]>;
}

/** One region of the machine. A region is always in exactly one of its states. */
export interface RegionConfig<C, E extends MachineEvent> {
  initial: string;
  states: Record<string, StateConfig<C, E>>;
}

export interface MachineConfig<C, E extends MachineEvent> {
  id: string;
  context: C;
  /** Regions run in parallel and all receive every event. */
  regions: Record<string, RegionConfig<C, E>>;
}

export interface Snapshot<C> {
  /** Current state name of each region, for example `{ panel: "file", canvas: "slide" }`. */
  value: Record<string, string>;
  context: C;
}

export interface Machine<C, E extends MachineEvent> {
  readonly id: string;
  readonly initial: Snapshot<C>;
  /** Pure: returns the next snapshot, or the same object when nothing changed. */
  transition(snapshot: Snapshot<C>, event: E): Snapshot<C>;
  /** True when at least one region would react to the event. */
  can(snapshot: Snapshot<C>, event: E): boolean;
  /** Builds a snapshot from partial values, validating state names. */
  restore(value?: Record<string, string>, context?: Partial<C>): Snapshot<C>;
}

const asList = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

function pick<C, E extends MachineEvent>(
  options: Transition<C, E>[],
  context: C,
  event: E,
): { target?: string; action?: (c: C, e: E) => Partial<C> } | undefined {
  for (const t of options) {
    const def = typeof t === "string" ? { target: t } : t;
    if (!def.guard || def.guard(context, event)) return def;
  }
  return undefined;
}

export function createMachine<C, E extends MachineEvent>(config: MachineConfig<C, E>): Machine<C, E> {
  const regionNames = Object.keys(config.regions);
  for (const r of regionNames) {
    const region = config.regions[r];
    if (!(region.initial in region.states)) throw new Error(`${config.id}.${r}: initial state "${region.initial}" is not declared`);
    for (const [s, st] of Object.entries(region.states)) {
      for (const [ev, t] of Object.entries(st.on ?? {})) {
        for (const o of asList(t)) {
          const target = typeof o === "string" ? o : o.target;
          if (target !== undefined && !(target in region.states)) throw new Error(`${config.id}.${r}.${s} on ${ev}: unknown target "${target}"`);
        }
      }
    }
  }
  const initial: Snapshot<C> = {
    value: Object.fromEntries(regionNames.map((r) => [r, config.regions[r].initial])),
    context: config.context,
  };

  const transition = (snapshot: Snapshot<C>, event: E): Snapshot<C> => {
    let value = snapshot.value;
    let context = snapshot.context;
    let changed = false;
    for (const r of regionNames) {
      const current = value[r];
      const options = asList(config.regions[r].states[current]?.on?.[event.type]);
      const hit = pick(options, context, event);
      if (!hit) continue;
      if (hit.target !== undefined && hit.target !== current) {
        value = { ...value, [r]: hit.target };
        changed = true;
      }
      if (hit.action) {
        context = { ...context, ...hit.action(context, event) };
        changed = true;
      }
    }
    return changed ? { value, context } : snapshot;
  };

  const can = (snapshot: Snapshot<C>, event: E) =>
    regionNames.some((r) => pick(asList(config.regions[r].states[snapshot.value[r]]?.on?.[event.type]), snapshot.context, event) !== undefined);

  const restore = (value: Record<string, string> = {}, context: Partial<C> = {}): Snapshot<C> => {
    for (const [r, s] of Object.entries(value)) {
      if (!config.regions[r]) throw new Error(`${config.id}: unknown region "${r}"`);
      if (!(s in config.regions[r].states)) throw new Error(`${config.id}.${r}: unknown state "${s}"`);
    }
    return { value: { ...initial.value, ...value }, context: { ...initial.context, ...context } };
  };

  return { id: config.id, initial, transition, can, restore };
}

/** React binding: `[snapshot, send]`. Pass a snapshot from `machine.restore()` to start somewhere else. */
export function useMachine<C, E extends MachineEvent>(machine: Machine<C, E>, start?: Snapshot<C>) {
  const [snapshot, dispatch] = useReducer((s: Snapshot<C>, e: E) => machine.transition(s, e), start ?? machine.initial);
  const send = useCallback((event: E) => dispatch(event), []);
  return [snapshot, send] as const;
}
