import { accumulateMetrics, createEmptyMetrics } from './scorer';
import type {
  AnyWorldState,
  PlaybackSpeed,
  SimEvent,
  SimMetrics,
  TimelineState,
} from './types';

export type { TimelineState };

/**
 * Creates an immutable TimelineState initialized at `startCursor` (default -1,
 * representing `initialState` before event 0).
 */
export function createTimeline<TState = AnyWorldState>(
  initialState: TState,
  events: SimEvent<TState>[] = [],
  options?: {
    speed?: PlaybackSpeed;
    isPlaying?: boolean;
    startCursor?: number;
  }
): TimelineState<TState> {
  const maxCursor = events.length - 1;
  const rawCursor = options?.startCursor ?? -1;
  const cursor = clampCursor(rawCursor, maxCursor);

  return {
    initialState,
    events,
    cursor,
    isPlaying: options?.isPlaying ?? false,
    speed: options?.speed ?? 1,
  };
}

function clampCursor(index: number, maxCursor: number): number {
  if (index < -1) return -1;
  if (index > maxCursor) return maxCursor;
  return index;
}

/**
 * Advances the timeline by one event. Automatically pauses if the end is reached.
 */
export function stepForward<TState = AnyWorldState>(
  timeline: TimelineState<TState>
): TimelineState<TState> {
  const maxCursor = timeline.events.length - 1;
  if (timeline.cursor >= maxCursor) {
    return timeline.isPlaying ? { ...timeline, isPlaying: false } : timeline;
  }

  const nextCursor = timeline.cursor + 1;
  const reachedEnd = nextCursor >= maxCursor;
  return {
    ...timeline,
    cursor: nextCursor,
    isPlaying: reachedEnd ? false : timeline.isPlaying,
  };
}

/**
 * Steps the timeline backward by one event (clamped at -1 / initialState).
 */
export function stepBack<TState = AnyWorldState>(
  timeline: TimelineState<TState>
): TimelineState<TState> {
  if (timeline.cursor <= -1) {
    return timeline.isPlaying ? { ...timeline, isPlaying: false } : timeline;
  }

  return {
    ...timeline,
    cursor: timeline.cursor - 1,
    isPlaying: false,
  };
}

/**
 * Seeks directly to a target event index (-1 for initialState, up to events.length - 1).
 */
export function seekTimeline<TState = AnyWorldState>(
  timeline: TimelineState<TState>,
  index: number
): TimelineState<TState> {
  const maxCursor = timeline.events.length - 1;
  const clamped = clampCursor(Math.trunc(index), maxCursor);
  if (clamped === timeline.cursor) {
    return timeline;
  }

  return {
    ...timeline,
    cursor: clamped,
    isPlaying: clamped >= maxCursor ? false : timeline.isPlaying,
  };
}

/**
 * Rewinds the timeline to -1 (initialState) and pauses playback.
 */
export function resetTimeline<TState = AnyWorldState>(
  timeline: TimelineState<TState>
): TimelineState<TState> {
  return {
    ...timeline,
    cursor: -1,
    isPlaying: false,
  };
}

/**
 * Sets playback state. If starting play while at the end, rewinds to -1 first.
 */
export function setTimelinePlaying<TState = AnyWorldState>(
  timeline: TimelineState<TState>,
  isPlaying: boolean
): TimelineState<TState> {
  if (!isPlaying) {
    return timeline.isPlaying ? { ...timeline, isPlaying: false } : timeline;
  }

  if (timeline.events.length === 0) {
    return { ...timeline, isPlaying: false };
  }

  const atEnd = timeline.cursor >= timeline.events.length - 1;
  return {
    ...timeline,
    cursor: atEnd ? -1 : timeline.cursor,
    isPlaying: true,
  };
}

export function setTimelineSpeed<TState = AnyWorldState>(
  timeline: TimelineState<TState>,
  speed: PlaybackSpeed
): TimelineState<TState> {
  return { ...timeline, speed };
}

/**
 * Returns the currently active SimEvent at `timeline.cursor`, or null when at initialState (-1).
 */
export function getActiveEvent<TState = AnyWorldState>(
  timeline: TimelineState<TState>
): SimEvent<TState> | null {
  if (timeline.cursor < 0 || timeline.cursor >= timeline.events.length) {
    return null;
  }
  return timeline.events[timeline.cursor];
}

/**
 * Returns the world state snapshot corresponding to `timeline.cursor`.
 */
export function getCurrentState<TState = AnyWorldState>(
  timeline: TimelineState<TState>
): TState {
  const active = getActiveEvent(timeline);
  return active ? active.snapshot : timeline.initialState;
}

/**
 * Computes cumulative SimMetrics from event 0 through `timeline.cursor`.
 */
export function getCumulativeMetrics<TState = AnyWorldState>(
  timeline: TimelineState<TState>
): SimMetrics {
  let metrics = createEmptyMetrics();
  if (timeline.cursor < 0) return metrics;

  const end = Math.min(timeline.cursor, timeline.events.length - 1);
  for (let i = 0; i <= end; i++) {
    metrics = accumulateMetrics(metrics, timeline.events[i].metricsDelta);
  }
  return metrics;
}
