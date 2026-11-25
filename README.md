# AXIOM // GRID

A 3D isometric neon-grid puzzle game and interactive sandbox for mastering **Data Structures & Algorithms (DSA)**. Manipulate live 3D memory structures directly or write JavaScript algorithms executed inside a deterministic Web Worker sandbox, scored against **Big-O S-Rank Par** targets.

---

## Features

### 4 Worlds · 16 Escalating Levels

| World | Theme | Big-O Focus | Levels |
| --- | --- | --- | --- |
| **1. Arrays** — *Memory Bus* | Contiguous memory rails & pointers | `O(1)` Access · `O(n)` Scans | 1. Contiguous Index · 2. Dual-Pointer Mirror · 3. Zero-Compaction · 4. Thermal Window |
| **2. Linked Lists** — *Tether Matrix* | Pointer rewiring & cycle probes | `O(1)` Rewires · `O(1)` Space | 1. Zero-Leak Splice · 2. Surgical Bypass · 3. Polarity Inversion · 4. Cycle Containment |
| **3. Stacks & Queues** — *Pipeline Core* | Pressurized LIFO/FIFO chambers | `O(1)` Push/Pop · Bounded Cap | 1. LIFO Inverter · 2. Bracket Airlock · 3. Two-Stack Conveyor · 4. Pressure Valve |
| **4. Pathfinding** — *Signal Grid* | Graph wavefronts & weighted grids | `O(V + E)` → A* Guided | 1. Wavefront Broadcast · 2. Elevation Toll · 3. Heuristic Beacon · 4. Firewall Breach |

### Hybrid Direct 3D + Sandboxed JS Code Mode
- **Direct 3D Manipulation**: Click, swap, rewire pointers, route packets, or step algorithms directly on the isometric 3D board with procedural Web Audio pentatonic feedback.
- **Sandboxed Code Drawer**: Open the integrated CodeMirror 6 JavaScript editor to script solutions against a clean world API. User code executes in an isolated **Web Worker** (`src/sandbox/codeWorker.ts`) with strict wall-clock timeouts and operation caps, emitting deterministic simulation frames for timeline scrubbing and replay.

### Big-O S-Rank Par Scoring
Every level defines operation-count and space-overhead par budgets (`S`, `A`, `B`, `C`) alongside a live Big-O complexity tier indicator and synchronized pseudocode trace.

### Unified Sandbox Studio
Experiment freely across all 4 data-structure worlds with **8 built-in presets** (*Random Unsorted Bus*, *Almost Sorted Rail*, *Linear 5-Node Chain*, *Cyclic Tether Matrix*, *Stack + Queue Pipeline*, *Dual-Buffer Stress Test*, *Weighted Canyon Maze*, and *Spiral Labyrinth*), custom state builders, and timeline playback controls.

---

## Tech Stack

- **UI & State**: React 18, TypeScript 5.7, Tailwind CSS v4, Zustand 5, Framer Motion, Lucide Icons
- **3D Engine**: Three.js, React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`), Postprocessing (`@react-three/postprocessing` bloom & neon shaders)
- **Code Sandbox**: CodeMirror 6 (`@uiw/react-codemirror`), isolated Web Worker execution
- **Audio**: Procedural Web Audio API pentatonic synthesizer
- **Build & Test**: Vite 6, Vitest 2

---

## Architecture

```text
src/
├── audio/           # Procedural Web Audio API pentatonic synthesizer
├── engine/
│   ├── types.ts     # Core simulation contracts, frames, and level schemas
│   ├── scorer.ts    # Big-O S-Rank par & complexity evaluation
│   ├── timeline.ts  # Deterministic frame scrubber & playback controller
│   ├── worlds/      # Pure deterministic engines (arrays, linked lists, stacks/queues, pathfinding)
│   └── __tests__/   # Vitest suite covering scorer, timeline, all 4 engines, and 16 S-Rank levels
├── levels/          # 16 campaign levels + 8 built-in Sandbox Studio presets
├── sandbox/         # Web Worker JS runner with timeout & operation-cap guards
├── scene/           # R3F isometric viewport, camera rig, bloom environment, particles & 4 3D worlds
├── store/           # Zustand global game, progress, timeline & sandbox store
└── ui/              # Title Screen, World Hub, Game HUD, Code Drawer, Pseudocode Panel & Sandbox Studio
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the local development server
npm run dev

# Run the Vitest suite
npx vitest run

# Typecheck and build for production
npm run build
```
