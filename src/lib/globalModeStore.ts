import { create } from 'zustand';

export type HybridMode = 'offline' | 'online' | 'hybrid';

interface GlobalModeState {
  mode: HybridMode;
  setMode: (mode: HybridMode) => void;
}

const getInitialMode = (): HybridMode => {
  const stored = localStorage.getItem('hybridMode');
  if (stored === 'offline' || stored === 'online' || stored === 'hybrid') return stored;
  return 'online'; // default
};

export const useGlobalModeStore = create<GlobalModeState>((set) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    localStorage.setItem('hybridMode', mode);
    set({ mode });
  },
})); 