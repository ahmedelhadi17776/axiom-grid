import type {
  LevelDefinition,
  TreeInteractionMode,
  TreeNode,
  TreesWorldState,
} from '../engine/types';
import { recomputeTreeLayoutAndMetrics } from '../engine/worlds/treesEngine';

interface TreeNodeSpec {
  id: string;
  value: number;
  leftId: string | null;
  rightId: string | null;
  corrupted?: boolean;
}

function buildTreeState(opts: {
  mode: TreeInteractionMode;
  rootId: string | null;
  specs: TreeNodeSpec[];
  pendingQueue?: number[];
  targetSequence?: number[];
  searchTarget?: number;
  expectedValues?: number[];
  showBalanceFactors?: boolean;
  selectedNodeId?: string | null;
}): TreesWorldState {
  const nodes: Record<string, TreeNode> = {};
  for (const s of opts.specs) {
    nodes[s.id] = {
      id: s.id,
      value: s.value,
      leftId: s.leftId,
      rightId: s.rightId,
      pos: [0, 0, 0],
      corrupted: s.corrupted,
    };
  }
  const state: TreesWorldState = {
    world: 'trees',
    mode: opts.mode,
    nodes,
    rootId: opts.rootId,
    selectedNodeId: opts.selectedNodeId ?? opts.rootId,
    pendingQueue: opts.pendingQueue ? [...opts.pendingQueue] : [],
    visitedSequence: [],
    targetSequence: opts.targetSequence ? [...opts.targetSequence] : undefined,
    searchTarget: opts.searchTarget,
    foundNodeId: null,
    expectedValues: opts.expectedValues ? [...opts.expectedValues] : undefined,
    showBalanceFactors: opts.showBalanceFactors ?? false,
    invariantViolations: 0,
  };
  recomputeTreeLayoutAndMetrics(state);
  return state;
}

export const TREES_LEVELS: LevelDefinition<TreesWorldState>[] = [
  {
    id: 'trees-1',
    code: '5.1',
    worldId: 'trees',
    order: 1,
    title: 'BST Compass',
    concept: 'Binary Search Tree — O(log n) Search',
    brief: 'Navigate the 7-node crystal canopy by branching left (<) or right (>) to lock onto target key 62 in at most 3 probes.',
    goalSummary: 'Probe & lock key 62 in <= 3 probes (O(log n))',
    objectiveKind: 'bst-search',
    maxCyclesBudget: 4,
    initialState: buildTreeState({
      mode: 'search',
      rootId: 't1',
      searchTarget: 62,
      specs: [
        { id: 't1', value: 50, leftId: 't2', rightId: 't3' },
        { id: 't2', value: 25, leftId: 't4', rightId: 't5' },
        { id: 't3', value: 75, leftId: 't6', rightId: 't7' },
        { id: 't4', value: 12, leftId: null, rightId: null },
        { id: 't5', value: 37, leftId: null, rightId: null },
        { id: 't6', value: 62, leftId: null, rightId: null },
        { id: 't7', value: 88, leftId: null, rightId: null },
      ],
    }),
    par: {
      sRankCycles: 3,
      threeStarCycles: 3,
      twoStarCycles: 4,
      maxAuxMemory: 0,
      targetBigO: 'O(log n) probes',
    },
    pseudocode: [
      'curr = root()',
      'while curr != null:',
      '  cmp = probe(curr)',
      '  if cmp == 0: break  // target locked!',
      '  curr = cmp > 0 ? node.leftId : node.rightId',
    ],
    starterCode: `// Follow BST ordering (< left, > right) using api.probe(id) to locate key 62!
// API: api.root(), api.getNode(id), api.probe(id)
let curr = api.root();

while (curr) {
  const cmp = api.probe(curr);
  if (cmp === 0) break;
  const node = api.getNode(curr);
  // TODO: branch left if node.value > target (cmp > 0), else branch right
  break;
}
`,
    referenceSolution: `let curr = api.root();

while (curr) {
  const cmp = api.probe(curr);
  if (cmp === 0) break;
  const node = api.getNode(curr);
  if (!node) break;
  curr = cmp > 0 ? node.leftId : node.rightId;
}
`,
    hints: [
      'Every BST node splits the canopy: all smaller keys live in its left subtree, all larger keys in its right.',
      'Start at the root (50). Because 62 > 50, discard the entire left subtree and step right to 75.',
      'From 75, 62 < 75—branch left to lock onto t6(62) in exactly 3 probes.',
    ],
    insight:
      'A balanced Binary Search Tree halves the remaining search space at every branch—locating any key in O(height) = O(log n) probes.',
    bigOIntuition:
      'Each comparison eliminates an entire subtree of keys, mirroring Binary Search on a dynamic pointer structure.',
  },
  {
    id: 'trees-2',
    code: '5.2',
    worldId: 'trees',
    order: 2,
    title: 'Canopy Insertion',
    concept: 'BST Construction & Invariant Bounds',
    brief: 'Dock queued keys [35, 15, 65, 90] into their exact BST child sockets with zero invariant violations.',
    goalSummary: 'Insert [35, 15, 65, 90] into valid BST sockets (0 faults)',
    objectiveKind: 'bst-insert',
    initialState: buildTreeState({
      mode: 'insert',
      rootId: 't1',
      pendingQueue: [35, 15, 65, 90],
      expectedValues: [15, 25, 35, 50, 65, 75, 90],
      specs: [
        { id: 't1', value: 50, leftId: 't2', rightId: 't3' },
        { id: 't2', value: 25, leftId: null, rightId: null },
        { id: 't3', value: 75, leftId: null, rightId: null },
      ],
    }),
    par: {
      sRankCycles: 4,
      threeStarCycles: 5,
      twoStarCycles: 7,
      maxAuxMemory: 0,
      targetBigO: 'O(h) per insert',
    },
    pseudocode: [
      'while pendingQueue() is not empty:',
      '  key = pendingQueue()[0]',
      '  walk from root (< left, > right) to open leaf socket',
      '  insert(key)  // preserves min < key < max bounds',
    ],
    starterCode: `// Insert every queued key [35, 15, 65, 90] while preserving the BST invariant!
// API: api.pendingQueue(), api.insert(value), api.insertAt(parentId, 'left' | 'right', value?)

while (api.pendingQueue().length > 0) {
  const nextKey = api.pendingQueue()[0];
  // TODO: call api.insert(nextKey)
  break;
}
`,
    referenceSolution: `while (api.pendingQueue().length > 0) {
  const nextKey = api.pendingQueue()[0];
  api.insert(nextKey);
}
`,
    hints: [
      'Every empty L/R socket inherits strict min/max bounds from all ancestors above it.',
      'Route 35 -> right of 25 (25 < 35 < 50), and 15 -> left of 25 (15 < 25).',
      'Route 65 -> left of 75 (50 < 65 < 75), and 90 -> right of 75 (90 > 75), or call api.insert(nextKey).',
    ],
    insight:
      'BST insertion always docks a new key at a unique empty leaf socket determined by walking down from the root in O(h) time without moving existing nodes.',
    bigOIntuition:
      'Unlike sorted arrays (which require O(n) shifts to insert), BST insertion attaches a single leaf pointer in O(log n) average time.',
  },
  {
    id: 'trees-3',
    code: '5.3',
    worldId: 'trees',
    order: 3,
    title: 'In-Order Harvest',
    concept: 'In-Order DFS Traversal (Left → Node → Right)',
    brief: 'Harvest all 7 crystal nodes in strictly ascending sorted order [10, 20, 30, 40, 50, 60, 70] using In-Order DFS.',
    goalSummary: 'Emit sorted sequence [10, 20, 30, 40, 50, 60, 70]',
    objectiveKind: 'tree-traversal',
    initialState: buildTreeState({
      mode: 'traverse',
      rootId: 't1',
      targetSequence: [10, 20, 30, 40, 50, 60, 70],
      specs: [
        { id: 't1', value: 40, leftId: 't2', rightId: 't3' },
        { id: 't2', value: 20, leftId: 't4', rightId: 't5' },
        { id: 't3', value: 60, leftId: 't6', rightId: 't7' },
        { id: 't4', value: 10, leftId: null, rightId: null },
        { id: 't5', value: 30, leftId: null, rightId: null },
        { id: 't6', value: 50, leftId: null, rightId: null },
        { id: 't7', value: 70, leftId: null, rightId: null },
      ],
    }),
    par: {
      sRankCycles: 7,
      threeStarCycles: 8,
      twoStarCycles: 10,
      maxAuxMemory: 3,
      targetBigO: 'O(n) time / O(h) stack',
    },
    pseudocode: [
      'function inorder(node):',
      '  if node == null: return',
      '  inorder(node.left)',
      '  visit(node)          // yields sorted ascending keys!',
      '  inorder(node.right)',
    ],
    starterCode: `// Traverse the BST in strictly ascending order: [10, 20, 30, 40, 50, 60, 70].
// API: api.runTraversal('preorder' | 'inorder' | 'postorder' | 'levelorder') or api.visitNode(id)

api.runTraversal('preorder'); // TODO: choose the traversal that yields sorted BST order
`,
    referenceSolution: `api.runTraversal('inorder');
`,
    hints: [
      'To visit keys from smallest to largest, you must exhaust a node’s entire left subtree before visiting the node itself.',
      'Left → Node → Right is In-Order DFS, which always reads any valid BST in sorted ascending order.',
      'Click the IN pulse button (or run api.runTraversal("inorder")), or click nodes 10 → 20 → 30 → 40 → 50 → 60 → 70.',
    ],
    insight:
      'In-Order DFS (Left → Node → Right) is the signature traversal of Binary Search Trees: it emits every key in exact ascending order in O(n) time and O(h) call-stack space.',
    bigOIntuition:
      'Every node is visited once (O(n) time) while recursion depth peaks at tree height h (O(log n) for balanced trees).',
  },
  {
    id: 'trees-4',
    code: '5.4',
    worldId: 'trees',
    order: 4,
    title: 'Canopy Sweep',
    concept: 'Level-Order BFS Traversal (FIFO Queue)',
    brief: 'Sweep the canopy tier by tier from root to leaves to emit [50, 30, 70, 20, 40, 60, 80].',
    goalSummary: 'Emit level-order tiers: [50, 30, 70, 20, 40, 60, 80]',
    objectiveKind: 'tree-traversal',
    initialState: buildTreeState({
      mode: 'traverse',
      rootId: 't1',
      targetSequence: [50, 30, 70, 20, 40, 60, 80],
      specs: [
        { id: 't1', value: 50, leftId: 't2', rightId: 't3' },
        { id: 't2', value: 30, leftId: 't4', rightId: 't5' },
        { id: 't3', value: 70, leftId: 't6', rightId: 't7' },
        { id: 't4', value: 20, leftId: null, rightId: null },
        { id: 't5', value: 40, leftId: null, rightId: null },
        { id: 't6', value: 60, leftId: null, rightId: null },
        { id: 't7', value: 80, leftId: null, rightId: null },
      ],
    }),
    par: {
      sRankCycles: 7,
      threeStarCycles: 8,
      twoStarCycles: 10,
      maxAuxMemory: 4,
      targetBigO: 'O(n) time / O(w) queue',
    },
    pseudocode: [
      'queue = [root]',
      'while queue is not empty:',
      '  node = queue.dequeue()',
      '  visit(node)',
      '  if node.left: queue.enqueue(node.left)',
      '  if node.right: queue.enqueue(node.right)',
    ],
    starterCode: `// Sweep the tree breadth-first, tier by tier: [50, 30, 70, 20, 40, 60, 80].
// API: api.runTraversal('preorder' | 'inorder' | 'postorder' | 'levelorder')

api.runTraversal('inorder'); // TODO: switch to level-order BFS
`,
    referenceSolution: `api.runTraversal('levelorder');
`,
    hints: [
      'Unlike DFS (which dives deep down one branch), Breadth-First traversal finishes each depth tier left-to-right.',
      'A FIFO queue naturally processes Depth 0 (50), then Depth 1 (30, 70), then Depth 2 (20, 40, 60, 80).',
      'Click the LEVEL pulse button (or run api.runTraversal("levelorder")).',
    ],
    insight:
      'Level-Order BFS uses a FIFO queue to visit nodes by increasing depth—ideal for finding minimum tree depth, serializing complete binary heaps, and broadcasting across hierarchies.',
    bigOIntuition:
      'BFS visits all n nodes in O(n) time, while peak queue memory scales with the tree’s maximum width w (up to n/2 at the leaf tier).',
  },
  {
    id: 'trees-5',
    code: '5.5',
    worldId: 'trees',
    order: 5,
    title: 'Successor Surgery',
    concept: '2-Child BST Deletion (In-Order Successor)',
    brief: 'Excise the corrupted root node 50—which has two full subtrees—by promoting its in-order successor (62) while preserving the BST invariant.',
    goalSummary: 'Delete corrupted 50 -> valid BST of [12, 25, 37, 62, 75, 88]',
    objectiveKind: 'bst-delete',
    meta: {
      deleteValue: 50,
    },
    initialState: buildTreeState({
      mode: 'delete',
      rootId: 't1',
      selectedNodeId: 't1',
      expectedValues: [12, 25, 37, 62, 75, 88],
      specs: [
        { id: 't1', value: 50, leftId: 't2', rightId: 't3', corrupted: true },
        { id: 't2', value: 25, leftId: 't4', rightId: 't5' },
        { id: 't3', value: 75, leftId: 't6', rightId: 't7' },
        { id: 't4', value: 12, leftId: null, rightId: null },
        { id: 't5', value: 37, leftId: null, rightId: null },
        { id: 't6', value: 62, leftId: null, rightId: null },
        { id: 't7', value: 88, leftId: null, rightId: null },
      ],
    }),
    par: {
      sRankCycles: 1,
      threeStarCycles: 2,
      twoStarCycles: 4,
      maxAuxMemory: 0,
      targetBigO: 'O(h) successor swap',
    },
    pseudocode: [
      '// Deleting a 2-child node requires promoting its in-order successor:',
      'succ = leftmost(target.right)   // smallest key > target (62)',
      'detach succ from its parent',
      'promote succ into target position',
      'deleteNode(targetId)',
    ],
    starterCode: `// Excise the corrupted 2-child root node (50) via in-order successor promotion!
// API: api.root(), api.getNode(id), api.deleteNode(id)

const rootId = api.root();
// TODO: call api.deleteNode(rootId) to promote its in-order successor (62)
`,
    referenceSolution: `const rootId = api.root();
if (rootId) {
  api.deleteNode(rootId);
}
`,
    hints: [
      'A 2-child node cannot simply be bypassed—something must take its place that is > all left keys and < all right keys.',
      'The leftmost node in the right subtree (62) is the in-order successor—guaranteed to satisfy both bounds.',
      'Select corrupted node t1(50) and click DELETE NODE (or call api.deleteNode(api.root())).',
    ],
    insight:
      'Deleting a 2-child BST node promotes its in-order successor (the leftmost node of its right subtree), preserving the global BST ordering in O(h) time.',
    bigOIntuition:
      'Finding the in-order successor walks down at most h edges, keeping BST deletion O(log n) on balanced trees.',
  },
  {
    id: 'trees-6',
    code: '5.6',
    worldId: 'trees',
    order: 6,
    title: 'AVL Equilibrium',
    concept: 'Self-Balancing AVL Tree Rotations',
    brief: 'This degenerate right-skewed chain has collapsed to O(n) height (|BF| > 1). Apply left rotations until every node satisfies |BF| <= 1.',
    goalSummary: 'Rebalance all nodes to |BF| <= 1 via rotations (preserve BST)',
    objectiveKind: 'avl-balance',
    initialState: buildTreeState({
      mode: 'balance',
      rootId: 't1',
      selectedNodeId: 't1',
      showBalanceFactors: true,
      expectedValues: [10, 20, 30, 40, 50],
      specs: [
        { id: 't1', value: 10, leftId: null, rightId: 't2' },
        { id: 't2', value: 20, leftId: null, rightId: 't3' },
        { id: 't3', value: 30, leftId: null, rightId: 't4' },
        { id: 't4', value: 40, leftId: null, rightId: 't5' },
        { id: 't5', value: 50, leftId: null, rightId: null },
      ],
    }),
    par: {
      sRankCycles: 2,
      threeStarCycles: 3,
      twoStarCycles: 5,
      maxAuxMemory: 0,
      targetBigO: 'O(1) per rotation',
    },
    pseudocode: [
      '// Balance Factor BF = height(left) - height(right)',
      '// Right-heavy imbalance (BF < -1) -> rotateLeft(node)',
      'rotateLeft(t1)   // lifts 20 to root, height drops from 5 -> 4',
      'rotateLeft(t3)   // lifts 40 above 30 & 50, all |BF| <= 1!',
    ],
    starterCode: `// Rebalance the right-skewed BST so every node satisfies |balanceFactor| <= 1!
// API: api.rotateLeft(id), api.rotateRight(id), api.getBalanceFactor(id)

api.rotateLeft('t1');
// TODO: rotate the remaining right-heavy subtree so all |BF| <= 1
`,
    referenceSolution: `api.rotateLeft('t1');
api.rotateLeft('t3');
`,
    hints: [
      'A negative balance factor (BF < -1) means the right subtree is too tall—fix it with a Left Rotation.',
      'First rotateLeft("t1") to lift 20 to the root, reducing the tree height from 5 down to 4.',
      'Node t3(30) still has BF = -2—apply rotateLeft("t3") to lift 40 and bring every node into |BF| <= 1!',
    ],
    insight:
      'AVL rotations rewire just 3 pointers in O(1) time to restore height balance without ever breaking the in-order BST sequence—guaranteeing O(log n) worst-case search.',
    bigOIntuition:
      'Keeping |BF| <= 1 at every node caps tree height at ~1.44 log2(n), preventing sorted insertions from degrading into an O(n) linked list.',
  },
];
