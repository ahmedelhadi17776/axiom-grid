import type {
  LevelDefinition,
  PacketItem,
  StacksQueuesWorldState,
} from '../engine/types';

const PACKET_COLORS = ['#00F0FF', '#A855F7', '#FFB800', '#00FF9D', '#FF2A5F', '#38BDF8'];

function makePackets(values: string[], prefix = 'pkt'): PacketItem[] {
  return values.map((value, idx) => ({
    id: `${prefix}-${idx}`,
    value,
    color: PACKET_COLORS[idx % PACKET_COLORS.length],
  }));
}

export const STACKS_QUEUES_LEVELS: LevelDefinition<StacksQueuesWorldState>[] = [
  {
    id: 'stacks-queues-1',
    code: '3.1',
    worldId: 'stacks-queues',
    order: 1,
    title: 'LIFO Inverter',
    concept: 'Stack Push / Pop Reversal',
    brief: 'Route all 4 incoming packets through the pressurized LIFO stack to emit the reversed manifest.',
    goalSummary: 'Emit reversed manifest: [D, C, B, A] with 0 overflows',
    objectiveKind: 'manifest-match',
    strictNoOverflows: true,
    initialState: {
      world: 'stacks-queues',
      inputStream: makePackets(['A', 'B', 'C', 'D'], 'l1'),
      buffers: {
        stackA: {
          id: 'stackA',
          kind: 'stack',
          label: 'LIFO STACK A',
          capacity: 4,
          items: [],
        },
      },
      outputEmitted: [],
      targetManifest: ['D', 'C', 'B', 'A'],
    },
    par: {
      sRankCycles: 8,
      threeStarCycles: 10,
      twoStarCycles: 14,
      maxAuxMemory: 4,
      targetBigO: 'O(n) ops / 0 overflows',
    },
    pseudocode: [
      'while inputStream is not empty:',
      '  push input into stackA',
      'while stackA is not empty:',
      '  pop stackA to output',
    ],
    starterCode: `// Route all packets through stackA to reverse their order.
// API: api.hasInput(), api.peekInput(), api.intake(buf), api.transfer(from, to), api.emit(buf), api.peek(buf), api.size(buf)

while (api.hasInput()) {
  api.intake('stackA');
}
// TODO: emit every packet from stackA
`,
    referenceSolution: `while (api.hasInput()) {
  api.intake('stackA');
}
while (api.size('stackA') > 0) {
  api.emit('stackA');
}
`,
    insight:
      'Last-In, First-Out (LIFO) buffers naturally invert any sequence in O(n) push/pop operations—the same mechanism behind Undo stacks and function call frames.',
    bigOIntuition:
      'Each packet enters and exits the stack exactly once: 2n O(1) operations total, using O(n) peak buffer space.',
  },
  {
    id: 'stacks-queues-2',
    code: '3.2',
    worldId: 'stacks-queues',
    order: 2,
    title: 'Bracket Airlock',
    concept: 'Balanced Delimiter Stack Validation',
    brief: 'Push opening gates onto the airlock stack; whenever a matching closer arrives, intake it and emit the matched pair.',
    goalSummary: 'Match & flush pairs: [ ], [, ), (, ), ( ] with 0 overflows',
    objectiveKind: 'bracket-validate',
    strictNoOverflows: true,
    initialState: {
      world: 'stacks-queues',
      inputStream: makePackets(['(', '[', ']', '(', ')', ')'], 'l2'),
      buffers: {
        airlock: {
          id: 'airlock',
          kind: 'stack',
          label: 'AIRLOCK STACK',
          capacity: 4,
          items: [],
        },
      },
      outputEmitted: [],
      targetManifest: [']', '[', ')', '(', ')', '('],
    },
    par: {
      sRankCycles: 12,
      threeStarCycles: 14,
      twoStarCycles: 18,
      maxAuxMemory: 3,
      targetBigO: 'O(n) stack validation',
    },
    pseudocode: [
      'pairs = { ")": "(", "]": "[" }',
      'while hasInput():',
      '  ch = peekInput()',
      '  if ch is closing and peek(airlock) == pairs[ch]:',
      '    intake(airlock); emit(airlock); emit(airlock)',
      '  else:',
      '    intake(airlock)',
    ],
    starterCode: `// Validate and pair nested brackets using the airlock stack.
// When a closing bracket matches the top opener, intake it and emit both!
const pairs = { ')': '(', ']': '[' };

while (api.hasInput()) {
  const next = api.peekInput();
  // TODO: if next is a closer matching api.peek('airlock'), intake then emit twice
  api.intake('airlock');
}
`,
    referenceSolution: `const pairs = { ')': '(', ']': '[' };

while (api.hasInput()) {
  const next = api.peekInput();
  if (next && pairs[next] && api.peek('airlock') === pairs[next]) {
    api.intake('airlock');
    api.emit('airlock');
    api.emit('airlock');
  } else {
    api.intake('airlock');
  }
}
`,
    insight:
      'Nested scopes always close from the innermost outward—making a LIFO stack the exact O(n) automaton for validating brackets, HTML tags, and syntax trees.',
    bigOIntuition:
      'Every delimiter is pushed once and popped once, bounding total time to O(n) and peak space to the maximum nesting depth.',
  },
  {
    id: 'stacks-queues-3',
    code: '3.3',
    worldId: 'stacks-queues',
    order: 3,
    title: 'Two-Stack Conveyor',
    concept: 'FIFO Queue via Two LIFO Stacks',
    brief: 'Emulate First-In, First-Out delivery [1, 2, 3, 4] using only two vertical LIFO chambers (inStack -> outStack).',
    goalSummary: 'Deliver FIFO manifest [1, 2, 3, 4] via inStack & outStack',
    objectiveKind: 'manifest-match',
    strictNoOverflows: true,
    initialState: {
      world: 'stacks-queues',
      inputStream: makePackets(['1', '2', '3', '4'], 'l3'),
      buffers: {
        inStack: {
          id: 'inStack',
          kind: 'stack',
          label: 'IN-STACK',
          capacity: 4,
          items: [],
        },
        outStack: {
          id: 'outStack',
          kind: 'stack',
          label: 'OUT-STACK',
          capacity: 4,
          items: [],
        },
      },
      outputEmitted: [],
      targetManifest: ['1', '2', '3', '4'],
    },
    par: {
      sRankCycles: 12,
      threeStarCycles: 14,
      twoStarCycles: 18,
      maxAuxMemory: 4,
      targetBigO: 'Amortized O(1) / packet',
    },
    pseudocode: [
      'while hasInput():',
      '  intake(inStack)          // reverses order once',
      'while size(inStack) > 0:',
      '  transfer(inStack, outStack) // double-reversal restores FIFO!',
      'while size(outStack) > 0:',
      '  emit(outStack)',
    ],
    starterCode: `// Emulate a FIFO Queue using two LIFO stacks: inStack and outStack.
while (api.hasInput()) {
  api.intake('inStack');
}
// TODO: transfer inStack -> outStack, then emit from outStack
`,
    referenceSolution: `while (api.hasInput()) {
  api.intake('inStack');
}
while (api.size('inStack') > 0) {
  api.transfer('inStack', 'outStack');
}
while (api.size('outStack') > 0) {
  api.emit('outStack');
}
`,
    insight:
      'Pouring one LIFO stack into a second LIFO stack reverses the sequence twice—restoring pure FIFO order in amortized O(1) operations per packet.',
    bigOIntuition:
      'Although a single transfer sweep takes O(n) time, each packet is transferred at most once across its lifetime, yielding amortized O(1) cost per enqueue/dequeue.',
  },
  {
    id: 'stacks-queues-4',
    code: '3.4',
    worldId: 'stacks-queues',
    order: 4,
    title: 'Pressure Valve',
    concept: 'Bounded Stack + Queue Routing',
    brief: 'Coordinate a capacity-3 Stack and capacity-3 Queue to reorder [B, C, A, E, D] into [A, B, C, D, E] without blowing a seal.',
    goalSummary: 'Emit sorted [A, B, C, D, E] without exceeding buffer caps (3)',
    objectiveKind: 'manifest-match',
    strictNoOverflows: true,
    initialState: {
      world: 'stacks-queues',
      inputStream: makePackets(['B', 'C', 'A', 'E', 'D'], 'l4'),
      buffers: {
        stackA: {
          id: 'stackA',
          kind: 'stack',
          label: 'VALVE STACK',
          capacity: 3,
          items: [],
        },
        queueB: {
          id: 'queueB',
          kind: 'queue',
          label: 'BYPASS QUEUE',
          capacity: 3,
          items: [],
        },
      },
      outputEmitted: [],
      targetManifest: ['A', 'B', 'C', 'D', 'E'],
    },
    par: {
      sRankCycles: 10,
      threeStarCycles: 12,
      twoStarCycles: 16,
      maxAuxMemory: 3,
      targetBigO: 'O(n) bounded routing',
    },
    pseudocode: [
      '// Hold B, C in FIFO queueB so they stay in order',
      'intake(queueB); intake(queueB)',
      '// Express A through stackA, then drain queueB (B, C)',
      'intake(stackA); emit(stackA)',
      'emit(queueB); emit(queueB)',
      '// Invert E, D through LIFO stackA -> D, E',
      'intake(stackA); intake(stackA)',
      'emit(stackA); emit(stackA)',
    ],
    starterCode: `// Reorder input [B, C, A, E, D] into [A, B, C, D, E] using stackA (LIFO, cap 3) & queueB (FIFO, cap 3).
// Hint: Use queueB to preserve [B, C] order while A passes through stackA, then invert [E, D] in stackA!

api.intake('queueB'); // B
api.intake('queueB'); // C
// TODO: route A, drain B & C, then invert E & D
`,
    referenceSolution: `// Stage B and C in FIFO queueB
api.intake('queueB');
api.intake('queueB');

// Route A through stackA and emit immediately
api.intake('stackA');
api.emit('stackA');

// Drain B and C in preserved FIFO order
api.emit('queueB');
api.emit('queueB');

// Stage E then D in LIFO stackA, then emit D followed by E
api.intake('stackA');
api.intake('stackA');
api.emit('stackA');
api.emit('stackA');
`,
    insight:
      'Choosing the right buffer primitive matters: a FIFO Queue preserves arrival order for delayed streams while a LIFO Stack inverts out-of-order pairs—keeping peak memory at 3.',
    bigOIntuition:
      'Flushing completed packets early prevents buffer saturation and keeps auxiliary memory bounded at O(k) instead of O(n).',
  },
];
