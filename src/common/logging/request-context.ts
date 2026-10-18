import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestStore {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function getRequestUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

export function setRequestUserId(userId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
}
