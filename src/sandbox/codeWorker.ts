import type { AnyWorldState, LevelDefinition } from '../engine/types';
import { runPlayerCodeSync } from './codeRunner';

interface WorkerRunRequest<T extends AnyWorldState = AnyWorldState> {
  level: LevelDefinition<T>;
  code: string;
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<WorkerRunRequest>) => {
  const { level, code } = event.data;
  const result = runPlayerCodeSync(level, code);
  workerScope.postMessage(result);
};
