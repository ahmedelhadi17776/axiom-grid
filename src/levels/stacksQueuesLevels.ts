import type {
  LevelDefinition,
  PacketItem,
  StacksQueuesWorldState,
} from '../engine/types';

const PACKET_COLORS = ['#38BDF8', '#A78BFA', '#FBBF24', '#34D399', '#FB7185', '#2DD4BF'];

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
    hints: [
      'A LIFO stack always emits the most recently inserted packet first.',
      'Intake all 4 packets [A, B, C, D] into stackA so D sits on top.',
      'Loop while (api.size("stackA") > 0) and call api.emit("stackA") to output [D, C, B, A].',
    ],
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
    hints: [
      'Keep unmatched opening brackets stacked in airlock so the innermost opener is always on top.',
      'Before intaking a closing bracket, compare pairs[next] against api.peek("airlock").',
      'When they match, call api.intake("airlock") followed by two api.emit("airlock") calls to flush the pair.',
    ],
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
    hints: [
      'Reversing a sequence twice restores its original First-In, First-Out order.',
      'Push all packets into inStack, then pour every packet into outStack with api.transfer().',
      'Emit all packets from outStack so [1, 2, 3, 4] exits in exact arrival order.',
    ],
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
    hints: [
      'B and C are already in ascending order—stage them in FIFO queueB so they stay ordered.',
      'Express A through stackA and emit it immediately, then drain B and C from queueB.',
      'Finally, intake E then D into LIFO stackA and emit twice to flip them into [D, E].',
    ],
    insight:
      'Choosing the right buffer primitive matters: a FIFO Queue preserves arrival order for delayed streams while a LIFO Stack inverts out-of-order pairs—keeping peak memory at 3.',
    bigOIntuition:
      'Flushing completed packets early prevents buffer saturation and keeps auxiliary memory bounded at O(k) instead of O(n).',
  },
  {
    id: 'stacks-queues-5',
    code: '3.5',
    worldId: 'stacks-queues',
    order: 5,
    title: 'Shunting Yard',
    concept: 'Infix → Postfix (RPN) Operator Stack',
    brief: 'Convert infix expression [A, +, B, *, C] into Reverse Polish Notation [A, B, C, *, +] using an operator stack and operand lane.',
    goalSummary: 'Emit Postfix RPN [A, B, C, *, +] with 0 overflows',
    objectiveKind: 'manifest-match',
    strictNoOverflows: true,
    initialState: {
      world: 'stacks-queues',
      inputStream: makePackets(['A', '+', 'B', '*', 'C'], 'l5'),
      buffers: {
        opStack: {
          id: 'opStack',
          kind: 'stack',
          label: 'OP STACK',
          capacity: 3,
          items: [],
        },
        lane: {
          id: 'lane',
          kind: 'queue',
          label: 'OPERAND LANE',
          capacity: 2,
          items: [],
        },
      },
      outputEmitted: [],
      targetManifest: ['A', 'B', 'C', '*', '+'],
    },
    par: {
      sRankCycles: 10,
      threeStarCycles: 12,
      twoStarCycles: 16,
      maxAuxMemory: 3,
      targetBigO: 'O(n) Shunting Yard',
    },
    pseudocode: [
      'prec = { "+": 1, "-": 1, "*": 2, "/": 2 }',
      'while hasInput():',
      '  tok = peekInput()',
      '  if tok is operator:',
      '    while prec[peek(opStack)] >= prec[tok]: emit(opStack)',
      '    intake(opStack)',
      '  else: intake(lane); emit(lane)',
      'while size(opStack) > 0: emit(opStack)',
    ],
    starterCode: `// Convert infix [A, +, B, *, C] to postfix [A, B, C, *, +] via Shunting Yard!
const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };

while (api.hasInput()) {
  const tok = api.peekInput();
  if (tok && prec[tok]) {
    // TODO: emit higher-or-equal precedence ops from opStack, then intake(opStack)
    api.intake('opStack');
  } else {
    // Pass operands directly through the FIFO lane
    api.intake('lane');
    api.emit('lane');
  }
}
// TODO: drain remaining operators from opStack
`,
    referenceSolution: `const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };

while (api.hasInput()) {
  const tok = api.peekInput();
  if (tok && prec[tok]) {
    while (api.size('opStack') > 0 && (prec[api.peek('opStack')] || 0) >= prec[tok]) {
      api.emit('opStack');
    }
    api.intake('opStack');
  } else {
    api.intake('lane');
    api.emit('lane');
  }
}
while (api.size('opStack') > 0) {
  api.emit('opStack');
}
`,
    hints: [
      'Operands (A, B, C) pass straight through the operand lane to output in arrival order.',
      'Operators (+, *) wait on opStack; because * has higher precedence than +, * stacks on top of +.',
      'Once all inputs are consumed, pop opStack until empty—emitting * before + to form [A, B, C, *, +].',
    ],
    insight:
      "Dijkstra's Shunting Yard algorithm parses operator precedence in a single O(n) pass using an operator stack—eliminating parentheses completely in Reverse Polish Notation.",
    bigOIntuition:
      'Each token enters and leaves a buffer at most once, so expression parsing runs in strict linear O(n) time.',
  },
  {
    id: 'stacks-queues-6',
    code: '3.6',
    worldId: 'stacks-queues',
    order: 6,
    title: 'Dual-Stack Sort',
    concept: 'Monotonic Stack Sort (2 LIFO Chambers)',
    brief: 'Sort incoming keys [30, 10, 40, 20] into ascending [10, 20, 30, 40] by maintaining a strictly monotonic auxStack.',
    goalSummary: 'Emit sorted [10, 20, 30, 40] using mainStack & auxStack',
    objectiveKind: 'manifest-match',
    strictNoOverflows: true,
    initialState: {
      world: 'stacks-queues',
      inputStream: makePackets(['30', '10', '40', '20'], 'l6'),
      buffers: {
        mainStack: {
          id: 'mainStack',
          kind: 'stack',
          label: 'MAIN STACK',
          capacity: 4,
          items: [],
        },
        auxStack: {
          id: 'auxStack',
          kind: 'stack',
          label: 'AUX STACK',
          capacity: 4,
          items: [],
        },
      },
      outputEmitted: [],
      targetManifest: ['10', '20', '30', '40'],
    },
    par: {
      sRankCycles: 16,
      threeStarCycles: 20,
      twoStarCycles: 28,
      maxAuxMemory: 4,
      targetBigO: 'O(n^2) monotonic sort',
    },
    pseudocode: [
      'while hasInput():',
      '  val = Number(peekInput())',
      '  while size(auxStack) > 0 and Number(peek(auxStack)) < val:',
      '    transfer(auxStack, mainStack)',
      '  intake(auxStack)  // keep smallest keys on top of auxStack',
      '  while size(mainStack) > 0: transfer(mainStack, auxStack)',
      'while size(auxStack) > 0: emit(auxStack)',
    ],
    starterCode: `// Maintain auxStack in descending order (smallest on TOP) so emitting auxStack outputs [10, 20, 30, 40].
while (api.hasInput()) {
  const val = Number(api.peekInput());
  // TODO: spill any smaller items from auxStack -> mainStack, intake into auxStack, then pour mainStack back
  api.intake('auxStack');
}
while (api.size('auxStack') > 0) {
  api.emit('auxStack');
}
`,
    referenceSolution: `while (api.hasInput()) {
  const val = Number(api.peekInput());
  while (api.size('auxStack') > 0 && Number(api.peek('auxStack')) < val) {
    api.transfer('auxStack', 'mainStack');
  }
  api.intake('auxStack');
  while (api.size('mainStack') > 0) {
    api.transfer('mainStack', 'auxStack');
  }
}
while (api.size('auxStack') > 0) {
  api.emit('auxStack');
}
`,
    hints: [
      'Keep auxStack strictly monotonic with the smallest key on top so final emits come out ascending.',
      'Before intaking a new key val into auxStack, temporarily park any smaller top keys onto mainStack.',
      'After intaking val onto auxStack, transfer every parked key from mainStack back onto auxStack.',
    ],
    insight:
      'Maintaining a monotonic stack invariant lets two LIFO chambers perform insertion sort without random access—keeping the minimum element always ready at the top of auxStack.',
    bigOIntuition:
      'Each new element may displace up to k sorted items and restore them, giving O(n^2) worst-case transfers and O(n) total buffer capacity.',
  },
];
