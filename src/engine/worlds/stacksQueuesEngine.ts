import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  LevelDefinition,
  PipelineBuffer,
  ScoreReport,
  SimEvent,
  SimMetrics,
  StacksQueuesWorldState,
} from '../types';

export function cloneStacksQueuesState(
  state: StacksQueuesWorldState
): StacksQueuesWorldState {
  const buffers: Record<string, PipelineBuffer> = {};
  for (const [id, buf] of Object.entries(state.buffers)) {
    buffers[id] = {
      ...buf,
      items: buf.items.map((item) => ({ ...item })),
    };
  }
  return {
    world: 'stacks-queues',
    inputStream: state.inputStream.map((item) => ({ ...item })),
    buffers,
    outputEmitted: state.outputEmitted.map((item) => ({ ...item })),
    targetManifest: [...state.targetManifest],
  };
}

function totalBufferedItems(state: StacksQueuesWorldState): number {
  let total = 0;
  for (const buf of Object.values(state.buffers)) {
    total += buf.items.length;
  }
  return total;
}

export interface StacksQueuesSession {
  hasInput(): boolean;
  peekInput(): string | null;
  intake(bufferId: string): boolean;
  transfer(fromId: string, toId: string): boolean;
  emit(bufferId: string): string | null;
  peek(bufferId: string): string | null;
  size(bufferId: string): number;
  getState(): StacksQueuesWorldState;
  getEvents(): SimEvent<StacksQueuesWorldState>[];
  getMetrics(): SimMetrics;
}

export function createStacksQueuesSession(
  initialState: StacksQueuesWorldState
): StacksQueuesSession {
  const state = cloneStacksQueuesState(initialState);
  const events: SimEvent<StacksQueuesWorldState>[] = [];
  const metrics = createEmptyMetrics();
  metrics.auxMemory = totalBufferedItems(state);
  let nextEventId = 1;

  const pushEvent = (
    type: SimEvent<StacksQueuesWorldState>['type'],
    label: string,
    pseudocodeLine: number,
    targets: string[],
    metricsDelta: Partial<SimMetrics>,
    pitchHint?: number
  ): void => {
    events.push({
      id: nextEventId++,
      type,
      label,
      pseudocodeLine,
      targets,
      pitchHint,
      metricsDelta,
      snapshot: cloneStacksQueuesState(state),
    });
  };

  return {
    hasInput(): boolean {
      return state.inputStream.length > 0;
    },

    peekInput(): string | null {
      return state.inputStream.length > 0 ? state.inputStream[0].value : null;
    },

    intake(bufferId: string): boolean {
      const buf = state.buffers[bufferId];
      if (!buf) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          `Unknown buffer "${bufferId}"`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return false;
      }

      if (state.inputStream.length === 0) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          `Input stream is empty — cannot intake into ${buf.label}`,
          -1,
          [bufferId],
          { cycles: 1 },
          0
        );
        return false;
      }

      if (buf.items.length >= buf.capacity) {
        buf.overflowed = true;
        metrics.overflows += 1;
        metrics.cycles += 1;
        pushEvent(
          'OVERFLOW',
          `OVERFLOW on ${buf.label} (capacity ${buf.capacity} reached)!`,
          3,
          [bufferId],
          { cycles: 1, overflows: 1 },
          0
        );
        return false;
      }

      const packet = state.inputStream.shift()!;
      buf.items.push(packet);
      buf.overflowed = false;

      const peak = Math.max(metrics.auxMemory, totalBufferedItems(state));
      metrics.auxMemory = peak;
      metrics.cycles += 1;

      const eventType = buf.kind === 'stack' ? 'PUSH' : 'ENQUEUE';
      pushEvent(
        eventType,
        `${buf.kind === 'stack' ? 'Push' : 'Enqueue'} "${packet.value}" → ${buf.label}`,
        1,
        [bufferId, packet.id],
        { cycles: 1, auxMemory: peak },
        buf.items.length / Math.max(1, buf.capacity)
      );
      return true;
    },

    transfer(fromId: string, toId: string): boolean {
      const src = state.buffers[fromId];
      const dst = state.buffers[toId];

      if (!src || src.items.length === 0) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          `UNDERFLOW on ${src ? src.label : fromId} — buffer is empty`,
          -1,
          [fromId],
          { cycles: 1 },
          0
        );
        return false;
      }

      if (!dst) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          `Unknown target buffer "${toId}"`,
          -1,
          [fromId],
          { cycles: 1 },
          0
        );
        return false;
      }

      if (dst.items.length >= dst.capacity) {
        dst.overflowed = true;
        metrics.overflows += 1;
        metrics.cycles += 1;
        pushEvent(
          'OVERFLOW',
          `OVERFLOW on ${dst.label} during transfer from ${src.label}!`,
          3,
          [toId],
          { cycles: 1, overflows: 1 },
          0
        );
        return false;
      }

      const packet =
        src.kind === 'stack' ? src.items.pop()! : src.items.shift()!;
      dst.items.push(packet);
      dst.overflowed = false;

      const peak = Math.max(metrics.auxMemory, totalBufferedItems(state));
      metrics.auxMemory = peak;
      metrics.cycles += 1;

      const eventType = dst.kind === 'stack' ? 'PUSH' : 'ENQUEUE';
      pushEvent(
        eventType,
        `Transfer "${packet.value}": ${src.label} → ${dst.label}`,
        2,
        [fromId, toId, packet.id],
        { cycles: 1, auxMemory: peak },
        dst.items.length / Math.max(1, dst.capacity)
      );
      return true;
    },

    emit(bufferId: string): string | null {
      const buf = state.buffers[bufferId];
      if (!buf || buf.items.length === 0) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          `UNDERFLOW on ${buf ? buf.label : bufferId} — nothing to emit`,
          -1,
          [bufferId],
          { cycles: 1 },
          0
        );
        return null;
      }

      const packet =
        buf.kind === 'stack' ? buf.items.pop()! : buf.items.shift()!;
      state.outputEmitted.push(packet);
      metrics.cycles += 1;

      const eventType = buf.kind === 'stack' ? 'POP' : 'DEQUEUE';
      pushEvent(
        eventType,
        `${buf.kind === 'stack' ? 'Pop' : 'Dequeue'} "${packet.value}" from ${buf.label} → Output`,
        2,
        [bufferId, packet.id],
        { cycles: 1 },
        Math.min(
          1,
          state.outputEmitted.length / Math.max(1, state.targetManifest.length)
        )
      );
      return packet.value;
    },

    peek(bufferId: string): string | null {
      const buf = state.buffers[bufferId];
      if (!buf || buf.items.length === 0) return null;
      return buf.kind === 'stack'
        ? buf.items[buf.items.length - 1].value
        : buf.items[0].value;
    },

    size(bufferId: string): number {
      return state.buffers[bufferId]?.items.length ?? 0;
    },

    getState(): StacksQueuesWorldState {
      return cloneStacksQueuesState(state);
    },

    getEvents(): SimEvent<StacksQueuesWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

function manifestMatches(actual: string[], target: string[]): boolean {
  if (actual.length !== target.length) return false;
  for (let i = 0; i < target.length; i++) {
    if (actual[i] !== target[i]) return false;
  }
  return true;
}

export function evaluateStacksQueuesLevel(
  level: LevelDefinition<StacksQueuesWorldState>,
  state: StacksQueuesWorldState,
  metrics: SimMetrics
): ScoreReport {
  const emitted = state.outputEmitted.map((p) => p.value);
  const kind = level.objectiveKind ?? 'manifest-match';

  if (kind === 'bracket-validate') {
    if (metrics.overflows > 0) {
      return evaluateScore(
        false,
        metrics,
        level.par,
        level.insight,
        `Buffer overflow occurred (${metrics.overflows}). Respect chamber capacity limits.`
      );
    }
    if (state.inputStream.length > 0) {
      return evaluateScore(
        false,
        metrics,
        level.par,
        level.insight,
        `${state.inputStream.length} packet(s) still remaining in the input stream.`
      );
    }
    const remainingBuffered = totalBufferedItems(state);
    if (remainingBuffered > 0) {
      return evaluateScore(
        false,
        metrics,
        level.par,
        level.insight,
        `Unmatched delimiter(s) still trapped inside buffers (${remainingBuffered} remaining).`
      );
    }
    if (!manifestMatches(emitted, state.targetManifest)) {
      return evaluateScore(
        false,
        metrics,
        level.par,
        level.insight,
        `Manifest mismatch: expected [${state.targetManifest.join(', ')}], emitted [${emitted.join(', ')}].`
      );
    }
    return evaluateScore(true, metrics, level.par, level.insight);
  }

  // Default: 'manifest-match'
  if (level.strictNoOverflows && metrics.overflows > 0) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Pressure seal ruptured (${metrics.overflows} overflow(s)). Keep buffers within capacity.`
    );
  }
  if (state.inputStream.length > 0) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Input stream not fully processed (${state.inputStream.length} packet(s) remaining).`
    );
  }
  if (!manifestMatches(emitted, state.targetManifest)) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Output manifest mismatch: expected [${state.targetManifest.join(', ')}], got [${emitted.join(', ')}].`
    );
  }

  return evaluateScore(true, metrics, level.par, level.insight);
}
