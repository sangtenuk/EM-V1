import Dexie, { Table } from 'dexie';
import { supabase } from './supabase';
import { useGlobalModeStore, HybridMode } from './globalModeStore';
import { create } from 'zustand';

export interface Event {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  date?: string | null;
  location?: string | null;
  max_attendees?: number | null;
  registration_qr?: string | null;
  offline_qr?: string | null;
  created_at?: string;
  mode?: 'offline' | 'online' | 'hybrid';
  lastSynced?: string; // ISO timestamp for conflict resolution
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSync: string | null;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: string) => void;
}

export const useSyncStatusStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSync: null,
  setSyncStatus: (status) => set({ status }),
  setLastSyncTime: (time) => set({ lastSync: time }),
}));

class HybridDB extends Dexie {
  events!: Table<Event, string>;
  company_logos!: Table<{ id: string, base64: string }, string>;
  constructor() {
    super('HybridDB');
    this.version(3).stores({
      events: 'id, company_id, name, date, mode, lastSynced',
      company_logos: 'id',
    });
  }
}

export const hybridDB = new HybridDB();

// Helper: fetch events from Supabase
const fetchEventsFromSupabase = async (): Promise<Event[]> => {
  const { data, error } = await supabase.from('events').select('*');
  if (error) throw error;
  return data || [];
};

// Helper: push local events to Supabase if not present or updated
const pushLocalEventsToSupabase = async () => {
  const localEvents = await hybridDB.events.toArray();
  const remoteEvents = await fetchEventsFromSupabase();
  const remoteMap = new Map(remoteEvents.map(e => [e.id, e]));
  for (const local of localEvents) {
    const remote = remoteMap.get(local.id);
    // If not in Supabase, or local is newer, push
    if (!remote || (local.lastSynced && (!remote.lastSynced || local.lastSynced > remote.lastSynced))) {
      await supabase.from('events').upsert([{ ...local }]);
      await hybridDB.events.update(local.id, { lastSynced: new Date().toISOString() });
    }
  }
};

// Helper: pull new/updated events from Supabase and update local
const pullRemoteEventsToLocal = async () => {
  const remoteEvents = await fetchEventsFromSupabase();
  for (const remote of remoteEvents) {
    const local = await hybridDB.events.get(remote.id);
    // If not in local, or remote is newer, update local
    if (!local || (remote.lastSynced && (!local.lastSynced || remote.lastSynced > local.lastSynced))) {
      await hybridDB.events.put({ ...remote });
    }
  }
};

// Two-way sync: push local changes, then pull remote changes
const syncEvents = async () => {
  const { setSyncStatus, setLastSyncTime } = useSyncStatusStore.getState();
  setSyncStatus('syncing');
  try {
    await pushLocalEventsToSupabase();
    await pullRemoteEventsToLocal();
    setSyncStatus('success');
    setLastSyncTime(new Date().toISOString());
  } catch (e) {
    setSyncStatus('error');
  }
};

// Abstracted data access layer
export const useHybridDB = () => {
  const { mode: globalMode } = useGlobalModeStore();

  // Update getEvents to accept companyId and prioritize Supabase
  const getEvents = async (companyId?: string): Promise<Event[]> => {
    if (globalMode === 'offline') {
      // Only use local DB
      const all = await hybridDB.events.toArray();
      return companyId ? all.filter(e => e.company_id === companyId) : all;
    }
    if (globalMode === 'online') {
      // Only use Supabase
      try {
        const all = await fetchEventsFromSupabase();
        return companyId ? all.filter(e => e.company_id === companyId) : all;
      } catch (error) {
        console.warn('Supabase unavailable, falling back to local DB');
        const all = await hybridDB.events.toArray();
        return companyId ? all.filter(e => e.company_id === companyId) : all;
      }
    }
    // Hybrid: try Supabase first, fall back to local DB if unavailable
    try {
      // Try to sync with Supabase first
      await syncEvents();
      const all = await hybridDB.events.toArray();
      return companyId ? all.filter(e => e.company_id === companyId) : all;
    } catch (error) {
      console.warn('Supabase unavailable in hybrid mode, using local DB only');
      const all = await hybridDB.events.toArray();
      return companyId ? all.filter(e => e.company_id === companyId) : all;
    }
  };

  // Add more methods as needed (create, update, delete, sync)

  return {
    getEvents,
    syncEvents, // expose for manual sync if needed
  };
}; 