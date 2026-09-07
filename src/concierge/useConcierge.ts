'use client';

import { useSyncExternalStore } from 'react';
import { getController, type ConciergeController } from './ConciergeController';

const subscribe = () => () => {};
const getClient = () => getController();
const getServer = () => null;

/** The controller — a stable client singleton; `null` on the server and during hydration. */
export function useController(): ConciergeController | null {
  return useSyncExternalStore(subscribe, getClient, getServer);
}
