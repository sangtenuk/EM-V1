import { create } from 'zustand';

// Online-only application mode. Ignore legacy offline values stored in localStorage.
export type HybridMode = 'offline' | 'online' | 'hybrid';

interface GlobalModeState {
  mode: HybridMode;
  setMode: (mode: HybridMode) => void;
}

export const useGlobalModeStore = create<GlobalModeState>((set) => ({
  mode: 'online',
  setMode: (_mode) => set({ mode: 'online' }),
}));
