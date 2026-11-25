import type { LevelDefinition, LinkedListWorldState } from '../engine/types';

export const LINKED_LIST_LEVELS: LevelDefinition<LinkedListWorldState>[] = [
  {
    id: 'linked-lists-1',
    code: '2.1',
    worldId: 'linked-lists',
    order: 1,
    title: 'Zero-Leak Splice',
    concept: 'O(1) Pointer Insertion Order',
    brief: 'Splice standby node n3 (30) between n2 and n4 without ever stranding n4 as a memory leak.',
    goalSummary: 'Link n3 -> n4 first, then n2 -> n3 -> [10, 20, 30, 40] (0 leaks)',
    objectiveKind: 'sequence-match',
    strictNoLeaks: true,
    initialState: {
      world: 'linked-lists',
      headId: 'n1',
      cursors: { curr: 'n2' },
      targetSequence: [10, 20, 30, 40],
      nodes: {
        n1: { id: 'n1', value: 10, nextId: 'n2', pos: [-5, 0, 0] },
        n2: { id: 'n2', value: 20, nextId: 'n4', pos: [-1.5, 0, 0] },
        n3: { id: 'n3', value: 30, nextId: null, pos: [1.5, 0, -2.5] },
        n4: { id: 'n4', value: 40, nextId: null, pos: [5, 0, 0] },
      },
    },
    par: {
      sRankCycles: 4,
      threeStarCycles: 6,
      twoStarCycles: 10,
      maxAuxMemory: 0,
      targetBigO: 'O(1) rewires / 0 leaks',
    },
    pseudocode: [
      '// Anchor the downstream tail BEFORE breaking n2.next',
      'n3.next = n2.next   // n3 -> n4',
      'n2.next = n3        // n2 -> n3',
    ],
    starterCode: `// Insert standby node 'n3' between 'n2' and 'n4' with ZERO memory leaks.
// API: api.head(), api.getNode(id), api.link(fromId, toId), api.setHead(id)

// Tip: Wire n3 -> n4 BEFORE redirecting n2 -> n3!
api.link('n3', 'n4');
`,
    referenceSolution: `const prev = api.getNode('n2');
if (prev) {
  api.link('n3', prev.nextId);
  api.link('n2', 'n3');
}
`,
    insight:
      'In a singly linked list, pointer assignment order is sacred: always tether the new node to the downstream chain before redirecting the predecessor.',
    bigOIntuition:
      'Unlike arrays (which must shift O(n) elements to insert in the middle), linked list insertion takes just two O(1) pointer rewires once positioned.',
  },
  {
    id: 'linked-lists-2',
    code: '2.2',
    worldId: 'linked-lists',
    order: 2,
    title: 'Surgical Bypass',
    concept: 'O(1) Safe Node Deletion',
    brief: 'Excise the corrupted node n2 (99) by bridging its predecessor directly to n3 without losing downstream nodes.',
    goalSummary: 'Bypass corrupted n2: [15, 30, 45] (0 leaks)',
    objectiveKind: 'sequence-match',
    strictNoLeaks: true,
    initialState: {
      world: 'linked-lists',
      headId: 'n1',
      cursors: { prev: 'n1', curr: 'n2' },
      targetSequence: [15, 30, 45],
      nodes: {
        n1: { id: 'n1', value: 15, nextId: 'n2', pos: [-5.25, 0, 0] },
        n2: { id: 'n2', value: 99, nextId: 'n3', pos: [-1.75, 0, 1.5], corrupted: true },
        n3: { id: 'n3', value: 30, nextId: 'n4', pos: [1.75, 0, 0] },
        n4: { id: 'n4', value: 45, nextId: null, pos: [5.25, 0, 0] },
      },
    },
    par: {
      sRankCycles: 3,
      threeStarCycles: 5,
      twoStarCycles: 8,
      maxAuxMemory: 0,
      targetBigO: 'O(1) rewires / 0 leaks',
    },
    pseudocode: [
      'target = prev.next       // corrupted n2',
      'prev.next = target.next  // n1 -> n3',
    ],
    starterCode: `// Bypass corrupted node 'n2' by linking 'n1' directly to n2's successor.
const corrupted = api.getNode('n2');
// TODO: link 'n1' to corrupted.nextId
`,
    referenceSolution: `const corrupted = api.getNode('n2');
if (corrupted) {
  api.link('n1', corrupted.nextId);
}
`,
    insight:
      'Deleting a node requires only updating its predecessor to skip over it—one O(1) pointer update keeps the entire remaining chain intact.',
    bigOIntuition:
      'Once you hold a reference to the predecessor, bypassing a node is O(1) with zero element shifting.',
  },
  {
    id: 'linked-lists-3',
    code: '2.3',
    worldId: 'linked-lists',
    order: 3,
    title: 'Polarity Inversion',
    concept: 'In-Place List Reversal',
    brief: 'Reverse every tether conduit in-place and relocate HEAD to n4 so the sequence reads [4, 3, 2, 1].',
    goalSummary: 'Reverse all pointers & set HEAD = n4 -> [4, 3, 2, 1]',
    objectiveKind: 'sequence-match',
    strictNoLeaks: false,
    initialState: {
      world: 'linked-lists',
      headId: 'n1',
      cursors: { prev: null, curr: 'n1' },
      targetSequence: [4, 3, 2, 1],
      nodes: {
        n1: { id: 'n1', value: 1, nextId: 'n2', pos: [-5.25, 0, 0] },
        n2: { id: 'n2', value: 2, nextId: 'n3', pos: [-1.75, 0, 0] },
        n3: { id: 'n3', value: 3, nextId: 'n4', pos: [1.75, 0, 0] },
        n4: { id: 'n4', value: 4, nextId: null, pos: [5.25, 0, 0] },
      },
    },
    par: {
      sRankCycles: 14,
      threeStarCycles: 18,
      twoStarCycles: 26,
      maxAuxMemory: 0,
      targetBigO: 'O(n) time / O(1) space',
    },
    pseudocode: [
      'prev = null; curr = head',
      'while curr != null:',
      '  next = curr.next',
      '  curr.next = prev',
      '  prev = curr; curr = next',
      'head = prev',
    ],
    starterCode: `// Reverse the linked list in-place using prev, curr, and next.
let prev = null;
let curr = api.head();

while (curr !== null) {
  const node = api.getNode(curr);
  const next = node ? node.nextId : null;
  // TODO: link curr -> prev, then advance prev and curr
  break;
}
// TODO: api.setHead(prev)
`,
    referenceSolution: `let prev = null;
let curr = api.head();

while (curr !== null) {
  api.setCursor('prev', prev);
  api.setCursor('curr', curr);
  const node = api.getNode(curr);
  const next = node ? node.nextId : null;
  api.link(curr, prev);
  prev = curr;
  curr = next;
}
api.setHead(prev);
`,
    insight:
      'Saving `next` before flipping `curr.next = prev` lets you invert an entire linked list in a single O(n) sweep with O(1) extra pointers.',
    bigOIntuition:
      'Reversing with a stack or recursion uses O(n) memory. Three iterative pointers (`prev`, `curr`, `next`) achieve optimal O(1) auxiliary space.',
  },
  {
    id: 'linked-lists-4',
    code: '2.4',
    worldId: 'linked-lists',
    order: 4,
    title: 'Cycle Containment',
    concept: "Floyd's Tortoise & Hare",
    brief: 'Run slow (1x) and fast (2x) probes to expose the hidden tether loop, then sever the back-edge cleanly.',
    goalSummary: 'Detect cycle & sever n5 -> null -> [10, 20, 30, 40, 50]',
    objectiveKind: 'sever-cycle',
    strictNoLeaks: true,
    initialState: {
      world: 'linked-lists',
      headId: 'n1',
      cursors: { slow: 'n1', fast: 'n1' },
      targetSequence: [10, 20, 30, 40, 50],
      hasCycle: true,
      cycleSevered: false,
      nodes: {
        n1: { id: 'n1', value: 10, nextId: 'n2', pos: [-5.5, 0, 0] },
        n2: { id: 'n2', value: 20, nextId: 'n3', pos: [-2, 0, 0] },
        n3: { id: 'n3', value: 30, nextId: 'n4', pos: [1.5, 0, -2.2] },
        n4: { id: 'n4', value: 40, nextId: 'n5', pos: [4.5, 0, 0] },
        n5: { id: 'n5', value: 50, nextId: 'n2', pos: [1.5, 0, 2.2] },
      },
    },
    par: {
      sRankCycles: 12,
      threeStarCycles: 16,
      twoStarCycles: 24,
      maxAuxMemory: 0,
      targetBigO: 'O(n) time / O(1) space',
    },
    pseudocode: [
      'slow = head; fast = head',
      'repeat stepProbe(slow, fast) until slow == fast',
      'p1 = head; p2 = meetingNode',
      'while p1 != p2: p1 = p1.next; p2 = p2.next',
      'walk tail until tail.next == p1',
      'tail.next = null  // cycle severed',
    ],
    starterCode: `// Use Floyd's Tortoise & Hare probe to detect the loop, then sever the back-edge.
// API: api.stepProbe('slow', 'fast'), api.detectCycle(), api.getNode(id), api.link(from, to)

for (let i = 0; i < 10; i++) {
  if (api.stepProbe('slow', 'fast')) {
    break;
  }
}
// TODO: locate the node looping back into the chain and unlink it to null
`,
    referenceSolution: `let met = false;
for (let step = 0; step < 10; step++) {
  if (api.stepProbe('slow', 'fast')) {
    met = true;
    break;
  }
}

if (met) {
  const info = api.detectCycle();
  if (info.hasCycle && info.meetingNodeId) {
    let p1 = api.head();
    let p2 = info.meetingNodeId;
    while (p1 !== p2) {
      const n1 = api.getNode(p1);
      const n2 = api.getNode(p2);
      p1 = n1 ? n1.nextId : null;
      p2 = n2 ? n2.nextId : null;
    }
    let tail = p1;
    while (tail) {
      const tNode = api.getNode(tail);
      if (!tNode || tNode.nextId === p1) break;
      tail = tNode.nextId;
    }
    if (tail) {
      api.link(tail, null);
    }
  }
}
`,
    insight:
      "Floyd's Tortoise (1x) and Hare (2x) are mathematically guaranteed to collide inside any cycle in O(n) steps using O(1) memory—no visited hash set required.",
    bigOIntuition:
      'A hash set of visited nodes detects cycles in O(n) space. Moving two probes at speeds 1 and 2 closes the gap by 1 node per step in O(1) space.',
  },
];
