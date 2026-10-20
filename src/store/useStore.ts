import { useSyncExternalStore } from 'react';
import type { AppState } from '../types';
import { getState, subscribe } from './store';

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}
