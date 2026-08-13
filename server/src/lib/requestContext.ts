import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  userId: string | null;
  mineId: string | null;
}

// Populated once per request by requireAuth (see middleware/auth.ts) and read from deep
// inside the Prisma audit extension, which has no direct access to the Express `req`
// object. AsyncLocalStorage propagates through every subsequent await/promise chain within
// the same request without needing to thread context through every function signature.
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
