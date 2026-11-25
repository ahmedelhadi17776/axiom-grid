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
    hints: [
      'Never overwrite n2.next until n4 is safely anchored from another node.',
      'Connect the standby node n3 to the downstream tail (n4) first.',
      'Call api.link("n3", "n4") first, then api.link("n2", "n3").',
    ],
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
    hints: [
      'Deleting a node from a singly linked list only requires rewiring its predecessor.',
      'Read n2.nextId (which points to n3) so the downstream chain stays connected.',
      'Execute a single rewire: api.link("n1", "n3") to bypass corrupted n2 cleanly.',
    ],
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
    hints: [
      'Save curr.next in a local variable before flipping curr.next backward to prev.',
      'Step through n1 -> null, n2 -> n1, n3 -> n2, n4 -> n3 while advancing prev and curr.',
      'Once curr becomes null, call api.setHead(prev) so HEAD points to n4.',
    ],
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
    hints: [
      'Step slow (1x) and fast (2x) via api.stepProbe() until they collide inside the loop.',
      'Walk one pointer from HEAD and another from meetingNodeId at 1x speed to find the loop entry (n2).',
      'Follow the cycle to the tail node whose nextId points back to n2 (n5), then call api.link("n5", null).',
    ],
    insight:
      "Floyd's Tortoise (1x) and Hare (2x) are mathematically guaranteed to collide inside any cycle in O(n) steps using O(1) memory—no visited hash set required.",
    bigOIntuition:
      'A hash set of visited nodes detects cycles in O(n) space. Moving two probes at speeds 1 and 2 closes the gap by 1 node per step in O(1) space.',
  },
  {
    id: 'linked-lists-5',
    code: '2.5',
    worldId: 'linked-lists',
    order: 5,
    title: 'Pairwise Phase-Flip',
    concept: 'Swap Adjacent Nodes in Pairs',
    brief: 'Swap every adjacent pair of nodes in-place by rewiring tethers so [10, 20, 30, 40] becomes [20, 10, 40, 30].',
    goalSummary: 'Swap adjacent pairs & set HEAD = n2 -> [20, 10, 40, 30]',
    objectiveKind: 'sequence-match',
    strictNoLeaks: false,
    initialState: {
      world: 'linked-lists',
      headId: 'n1',
      cursors: { first: 'n1', second: 'n2' },
      targetSequence: [20, 10, 40, 30],
      nodes: {
        n1: { id: 'n1', value: 10, nextId: 'n2', pos: [-5.25, 0, 0] },
        n2: { id: 'n2', value: 20, nextId: 'n3', pos: [-1.75, 0, 0] },
        n3: { id: 'n3', value: 30, nextId: 'n4', pos: [1.75, 0, 0] },
        n4: { id: 'n4', value: 40, nextId: null, pos: [5.25, 0, 0] },
      },
    },
    par: {
      sRankCycles: 8,
      threeStarCycles: 12,
      twoStarCycles: 18,
      maxAuxMemory: 0,
      targetBigO: 'O(n) rewires / O(1) space',
    },
    pseudocode: [
      'prev = null; curr = head',
      'while curr and curr.next:',
      '  first = curr; second = curr.next; nextPair = second.next',
      '  first.next = nextPair; second.next = first',
      '  if prev: prev.next = second else head = second',
      '  prev = first; curr = nextPair',
    ],
    starterCode: `// Swap adjacent node pairs (n1 <-> n2) and (n3 <-> n4) in-place!
let prev = null;
let curr = api.head();

while (curr) {
  const firstNode = api.getNode(curr);
  const second = firstNode ? firstNode.nextId : null;
  if (!second) break;
  const secondNode = api.getNode(second);
  const nextPair = secondNode ? secondNode.nextId : null;
  // TODO: flip (curr, second), connect prev (or setHead), and advance
  break;
}
`,
    referenceSolution: `let prev = null;
let curr = api.head();

while (curr) {
  const firstNode = api.getNode(curr);
  const second = firstNode ? firstNode.nextId : null;
  if (!second) break;
  const secondNode = api.getNode(second);
  const nextPair = secondNode ? secondNode.nextId : null;

  api.link(curr, nextPair);
  api.link(second, curr);
  if (prev) {
    api.link(prev, second);
  } else {
    api.setHead(second);
  }
  prev = curr;
  curr = nextPair;
}
`,
    hints: [
      'Process two nodes at a time (first, second) and save nextPair = second.next before rewiring.',
      'Rewire first -> nextPair and second -> first; update HEAD to n2 on the first pair.',
      'Remember to connect the tail of pair 1 (n1) to the new head of pair 2 (n4) via api.link("n1", "n4").',
    ],
    insight:
      'Pairwise node swapping mutates links rather than copying values—requiring 3 pointer updates per pair (first, second, and the previous pair tail) in O(n) time and O(1) space.',
    bigOIntuition:
      'Each node is touched once while advancing two hops at a time, yielding O(n) time with constant pointer overhead.',
  },
  {
    id: 'linked-lists-6',
    code: '2.6',
    worldId: 'linked-lists',
    order: 6,
    title: 'Dual-Chain Fusion',
    concept: 'Merge Two Sorted Lists — O(n + m)',
    brief: 'Splice two parallel sorted chains [10, 30, 50] and [20, 40, 60] into one fused sequence with zero memory leaks.',
    goalSummary: 'Merge parallel chains -> [10, 20, 30, 40, 50, 60] (0 leaks)',
    objectiveKind: 'sequence-match',
    strictNoLeaks: true,
    initialState: {
      world: 'linked-lists',
      headId: 'a1',
      cursors: { chainA: 'a1', chainB: 'b1' },
      targetSequence: [10, 20, 30, 40, 50, 60],
      nodes: {
        a1: { id: 'a1', value: 10, nextId: 'a2', pos: [-4.5, 0, 1.4] },
        a2: { id: 'a2', value: 30, nextId: 'a3', pos: [0, 0, 1.4] },
        a3: { id: 'a3', value: 50, nextId: null, pos: [4.5, 0, 1.4] },
        b1: { id: 'b1', value: 20, nextId: 'b2', pos: [-2.25, 0, -1.8] },
        b2: { id: 'b2', value: 40, nextId: 'b3', pos: [2.25, 0, -1.8] },
        b3: { id: 'b3', value: 60, nextId: null, pos: [6.5, 0, -1.8] },
      },
    },
    par: {
      sRankCycles: 8,
      threeStarCycles: 12,
      twoStarCycles: 18,
      maxAuxMemory: 0,
      targetBigO: 'O(n + m) / 0 leaks',
    },
    pseudocode: [
      'currA = head (a1); currB = b1',
      'while currA and currB:',
      '  nextA = currA.next; nextB = currB.next',
      '  if nextA != null: currB.next = nextA  // anchor downstream first!',
      '  currA.next = currB',
      '  currA = nextA; currB = nextB',
    ],
    starterCode: `// Fuse sorted Chain A (a1->a2->a3) and standby Chain B (b1->b2->b3) with ZERO memory leaks!
// Remember: anchor b_i -> nextA BEFORE rewiring a_i -> b_i!
let currA = api.head();
let currB = 'b1';

while (currA && currB) {
  const nodeA = api.getNode(currA);
  const nodeB = api.getNode(currB);
  // TODO: save nextA & nextB, anchor currB -> nextA (if nextA), then link currA -> currB
  break;
}
`,
    referenceSolution: `let currA = api.head();
let currB = 'b1';

while (currA && currB) {
  const nodeA = api.getNode(currA);
  const nodeB = api.getNode(currB);
  if (!nodeA || !nodeB) break;
  const nextA = nodeA.nextId;
  const nextB = nodeB.nextId;

  if (nextA) {
    api.link(currB, nextA);
  }
  api.link(currA, currB);

  currA = nextA;
  currB = nextB;
}
`,
    hints: [
      'Zero-leak splicing applies to every insertion: anchor the incoming B-node to nextA before breaking currA.next.',
      'Save both nextA and nextB before modifying either link so you never lose track of the remaining tails.',
      'Wire b1 -> a2 then a1 -> b1; b2 -> a3 then a2 -> b2; finally a3 -> b3.',
    ],
    insight:
      'Merging two sorted linked lists requires zero extra node allocation—weaving existing pointers in-place runs in O(n + m) time and O(1) space, forming the backbone of Linked List Merge Sort.',
    bigOIntuition:
      'Unlike merging arrays (which requires an O(n + m) scratch buffer), linked list merge splices pointers directly in O(1) auxiliary space.',
  },
];
