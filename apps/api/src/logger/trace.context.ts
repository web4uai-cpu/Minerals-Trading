import { AsyncLocalStorage } from 'async_hooks';

export interface TraceStore {
  traceId: string;
}

export const traceStorage = new AsyncLocalStorage<TraceStore>();
