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
  custom_background?: string | null;
  custom_logo?: string | null;
  max_gallery_uploads?: number | null;
  created_at?: string;
  mode?: 'offline' | 'online' | 'hybrid';
  lastSynced?: string; // ISO timestamp for conflict resolution
  syncStatus?: 'pending' | 'synced' | 'error';
  isLocal?: boolean; // Flag to identify locally created records
}

export interface Attendee {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company?: string;
  identification_number: string;
  staff_id: string | null;
  table_assignment: string | null;
  table_type: string;
  checked_in: boolean;
  check_in_time: string | null;
  table_number?: number;
  seat_number?: number;
  created_at: string;
  lastSynced?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  isLocal?: boolean;
}

export interface LuckyDrawWinner {
  id: string;
  event_id: string;
  attendee_id?: string;
  winner_name: string;
  winner_company?: string;
  table_number?: number;
  is_table_winner: boolean;
  table_type?: string;
  prize_id?: string;
  prize_title?: string;
  prize_description?: string;
  prize_position?: number;
  draw_type: 'regular' | 'table' | 'custom';
  draw_session_id: string;
  created_at: string;
  lastSynced?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  isLocal?: boolean;
}

export interface Company {
  id: string;
  name: string;
  person_in_charge?: string;
  contact_number?: string;
  email?: string;
  logo?: string;
  created_at?: string;
  lastSynced?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  isLocal?: boolean;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSync: string | null;
  isOnline: boolean;
  pendingChanges: number;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: string) => void;
  setIsOnline: (online: boolean) => void;
  setPendingChanges: (count: number) => void;
}

export const useSyncStatusStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSync: null,
  isOnline: true,
  pendingChanges: 0,
  setSyncStatus: (status) => set({ status }),
  setLastSyncTime: (time) => set({ lastSync: time }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
}));

class HybridDB extends Dexie {
  events!: Table<Event, string>;
  attendees!: Table<Attendee, string>;
  luckyDrawWinners!: Table<LuckyDrawWinner, string>;
  companies!: Table<Company, string>;
  company_logos!: Table<{ id: string, base64: string }, string>;
  uploaded_files!: Table<{ id: string, fileName: string, base64: string, type: string, created_at: string, size: number, mimeType: string }, string>;
  file_metadata!: Table<{ id: string, fileName: string, filePath: string, url: string, type: string, eventId?: string, companyId?: string, created_at: string, size: number, mimeType: string }, string>;
  syncQueue!: Table<{ id: string, table: string, action: 'create' | 'update' | 'delete', data: any, timestamp: string }, string>;

  constructor() {
    super('HybridDB');
    this.version(6).stores({
      events: 'id, company_id, name, date, mode, lastSynced, syncStatus',
      attendees: 'id, event_id, name, email, checked_in, lastSynced, syncStatus',
      luckyDrawWinners: 'id, event_id, winner_name, lastSynced, syncStatus',
      companies: 'id, name, lastSynced, syncStatus',
      company_logos: 'id',
      uploaded_files: 'id, fileName, type',
      file_metadata: 'id, fileName, filePath, eventId, companyId, type',
      syncQueue: 'id, table, action, timestamp',
    });
  }
}

export const hybridDB = new HybridDB();

// Internet connectivity detection
export class NetworkManager {
  private static instance: NetworkManager;
  private onlineStatus: boolean | null = null;
  private listeners: ((online: boolean) => void)[] = [];

  private constructor() {
    this.setupListeners();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private setupListeners() {
    // Browser online/offline events
    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));

    // Periodic connectivity check
    setInterval(() => {
      this.checkConnectivity();
    }, 60000); // Check every 60 seconds

    // Initial check with delay to allow app to fully load
    setTimeout(() => {
      this.checkConnectivity();
    }, 2000);
  }

  private async checkConnectivity() {
    try {
      // Try to fetch a small resource from Supabase with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .limit(1);
      
      clearTimeout(timeoutId);
      
      // Only set offline if we get a clear error
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is not a connection error
        this.setOnlineStatus(false);
      } else {
        this.setOnlineStatus(true);
      }
    } catch (error) {
      // Only set offline for network errors, not other types of errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this.setOnlineStatus(false);
      }
      // For other errors, don't change the status - keep current state
    }
  }

  private setOnlineStatus(online: boolean) {
    if (this.onlineStatus !== online) {
      this.onlineStatus = online;
      this.notifyListeners(online);
    }
  }

  public isOnline(): boolean {
    // Quick check using browser's navigator.onLine
    if (!navigator.onLine) {
      // If browser says offline, immediately update internal status and return false
      if (this.onlineStatus !== false) {
        this.setOnlineStatus(false);
      }
      return false;
    }
    
    // If browser says online, we should trust it initially
    // Only return false if we've explicitly determined we're offline
    if (this.onlineStatus === null) {
      // If we haven't done a health check yet, assume online if browser says so
      return true;
    }
    
    // Otherwise, rely on our more robust check's result
    return this.onlineStatus;
  }

  public addListener(listener: (online: boolean) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (online: boolean) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online));
  }

  // Debug method to force online status (for testing)
  public forceOnline() {
    this.setOnlineStatus(true);
  }

  // Debug method to force offline status (for testing)
  public forceOffline() {
    this.setOnlineStatus(false);
  }
}

// Expose NetworkManager for debugging
export const networkManager = NetworkManager.getInstance();

// Sync queue management
class SyncQueue {
  static async addToQueue(table: string, action: 'create' | 'update' | 'delete', data: any) {
    const queueItem = {
      id: crypto.randomUUID(),
      table,
      action,
      data,
      timestamp: new Date().toISOString()
    };
    await hybridDB.syncQueue.add(queueItem);
    useSyncStatusStore.getState().setPendingChanges(
      await hybridDB.syncQueue.count()
    );
  }

  static async processQueue() {
    const queue = await hybridDB.syncQueue.toArray();
    const { setSyncStatus, setLastSyncTime } = useSyncStatusStore.getState();

    if (queue.length === 0) return;

    setSyncStatus('syncing');

    try {
      for (const item of queue) {
        try {
          switch (item.action) {
            case 'create':
              await supabase.from(item.table).insert([item.data]);
              break;
            case 'update':
              await supabase.from(item.table).update(item.data).eq('id', item.data.id);
              break;
            case 'delete':
              await supabase.from(item.table).delete().eq('id', item.data.id);
              break;
          }
          // Remove from queue after successful sync
          await hybridDB.syncQueue.delete(item.id);
        } catch (error) {
          console.error(`Failed to sync ${item.action} on ${item.table}:`, error);
          // Keep in queue for retry
        }
      }

      setSyncStatus('success');
      setLastSyncTime(new Date().toISOString());
      useSyncStatusStore.getState().setPendingChanges(await hybridDB.syncQueue.count());
    } catch (error) {
      setSyncStatus('error');
      console.error('Sync queue processing failed:', error);
    }
  }
}

// Enhanced hybrid database operations
export const useHybridDB = () => {
  const { mode: globalMode, setMode } = useGlobalModeStore();
  const networkManager = NetworkManager.getInstance();

  // Initialize network status - moved to useHybridInit to avoid circular dependency
  // Network status is now handled in useHybridInit hook

  // Generic sync function for any table
  const syncTable = async (tableName: string, localTable: Table<any, any>) => {
    const isOnline = networkManager.isOnline();
    if (!isOnline) return;

    try {
      // Get local records that need syncing
      const localRecords = await localTable
        .where('syncStatus')
        .anyOf(['pending', 'error'])
        .toArray();

      // Push local changes to remote
      for (const record of localRecords) {
        try {
          const { error } = await supabase
            .from(tableName)
            .upsert([record], { onConflict: 'id' });

          if (!error) {
            await localTable.update(record.id, {
              syncStatus: 'synced',
              lastSynced: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`Failed to sync ${tableName} record:`, error);
        }
      }

      // Pull remote changes to local
      const { data: remoteRecords, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && remoteRecords) {
        for (const remoteRecord of remoteRecords) {
          const localRecord = await localTable.get(remoteRecord.id);
          
          // Update local if remote is newer or doesn't exist locally
          if (!localRecord || 
              (remoteRecord.lastSynced && 
               (!localRecord.lastSynced || remoteRecord.lastSynced > localRecord.lastSynced))) {
            await localTable.put({
              ...remoteRecord,
              syncStatus: 'synced',
              lastSynced: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error syncing ${tableName}:`, error);
    }
  };

  // Sync all data
  const syncAllData = async () => {
    const { setSyncStatus, setLastSyncTime } = useSyncStatusStore.getState();
    
    if (!networkManager.isOnline()) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');

    try {
      // Process sync queue first
      await SyncQueue.processQueue();

      // Sync all tables
      await Promise.all([
        syncTable('events', hybridDB.events),
        syncTable('attendees', hybridDB.attendees),
        syncTable('lucky_draw_winners', hybridDB.luckyDrawWinners),
        syncTable('companies', hybridDB.companies)
      ]);

      setSyncStatus('success');
      setLastSyncTime(new Date().toISOString());
    } catch (error) {
      setSyncStatus('error');
      console.error('Sync failed:', error);
    }
  };

  // Generic CRUD operations with hybrid support
  const createRecord = async (tableName: string, data: any) => {
    const isOnline = networkManager.isOnline();
    const record = {
      ...data,
      id: data.id || crypto.randomUUID(),
      created_at: data.created_at || new Date().toISOString(),
      syncStatus: isOnline ? 'synced' : 'pending',
      lastSynced: isOnline ? new Date().toISOString() : null,
      isLocal: !isOnline
    };

    // Add to local database
    const localTable = hybridDB.table(tableName);
    await localTable.add(record);

    // If online, sync immediately; if offline, add to queue
    if (isOnline) {
      try {
        await supabase.from(tableName).insert([record]);
        await localTable.update(record.id, { syncStatus: 'synced' });
      } catch (error) {
        await localTable.update(record.id, { syncStatus: 'error' });
        await SyncQueue.addToQueue(tableName, 'create', record);
      }
    } else {
      await SyncQueue.addToQueue(tableName, 'create', record);
    }

    return record;
  };

  const updateRecord = async (tableName: string, id: string, data: any) => {
    const isOnline = networkManager.isOnline();
    const updateData = {
      ...data,
      lastSynced: isOnline ? new Date().toISOString() : null,
      syncStatus: isOnline ? 'synced' : 'pending'
    };

    // Update local database
    const localTable = hybridDB.table(tableName);
    await localTable.update(id, updateData);

    // If online, sync immediately; if offline, add to queue
    if (isOnline) {
      try {
        await supabase.from(tableName).update(updateData).eq('id', id);
        await localTable.update(id, { syncStatus: 'synced' });
      } catch (error) {
        await localTable.update(id, { syncStatus: 'error' });
        await SyncQueue.addToQueue(tableName, 'update', { id, ...updateData });
      }
    } else {
      await SyncQueue.addToQueue(tableName, 'update', { id, ...updateData });
    }

    return updateData;
  };

  const deleteRecord = async (tableName: string, id: string) => {
    const isOnline = networkManager.isOnline();

    // Delete from local database
    const localTable = hybridDB.table(tableName);
    await localTable.delete(id);

    // If online, sync immediately; if offline, add to queue
    if (isOnline) {
      try {
        await supabase.from(tableName).delete().eq('id', id);
      } catch (error) {
        await SyncQueue.addToQueue(tableName, 'delete', { id });
      }
    } else {
      await SyncQueue.addToQueue(tableName, 'delete', { id });
    }
  };

  // Event-specific operations
  const getEvents = async (companyId?: string): Promise<Event[]> => {
    try {
      if (globalMode === 'online' && networkManager.isOnline()) {
        // Try online first
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          // Cache the data locally
          for (const event of data) {
            await hybridDB.events.put({
              ...event,
              syncStatus: 'synced',
              lastSynced: new Date().toISOString()
            });
          }
          return companyId ? data.filter(e => e.company_id === companyId) : data;
        }
      }

      // Fall back to local database
      const all = await hybridDB.events.toArray();
      return companyId ? all.filter(e => e.company_id === companyId) : all;
    } catch (error) {
      console.warn('Error fetching events, using local data:', error);
      const all = await hybridDB.events.toArray();
      return companyId ? all.filter(e => e.company_id === companyId) : all;
    }
  };

  const createEvent = async (eventData: Partial<Event>): Promise<Event> => {
    const result = await createRecord('events', eventData);
    return result as Event;
  };

  const updateEvent = async (id: string, eventData: Partial<Event>): Promise<Event> => {
    const result = await updateRecord('events', id, eventData);
    return result as Event;
  };

  const deleteEvent = async (id: string): Promise<void> => {
    return deleteRecord('events', id);
  };

  // Attendee-specific operations
  const getAttendees = async (eventId?: string): Promise<Attendee[]> => {
    try {
      if (globalMode === 'online' && networkManager.isOnline()) {
        const { data, error } = await supabase
          .from('attendees')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const attendee of data) {
            await hybridDB.attendees.put({
              ...attendee,
              syncStatus: 'synced',
              lastSynced: new Date().toISOString()
            });
          }
          return eventId ? data.filter(a => a.event_id === eventId) : data;
        }
      }

      const all = await hybridDB.attendees.toArray();
      return eventId ? all.filter(a => a.event_id === eventId) : all;
    } catch (error) {
      console.warn('Error fetching attendees, using local data:', error);
      const all = await hybridDB.attendees.toArray();
      return eventId ? all.filter(a => a.event_id === eventId) : all;
    }
  };

  const createAttendee = async (attendeeData: Partial<Attendee>): Promise<Attendee> => {
    const result = await createRecord('attendees', attendeeData);
    return result as Attendee;
  };

  const updateAttendee = async (id: string, attendeeData: Partial<Attendee>): Promise<Attendee> => {
    const result = await updateRecord('attendees', id, attendeeData);
    return result as Attendee;
  };

  const deleteAttendee = async (id: string): Promise<void> => {
    return deleteRecord('attendees', id);
  };

  // Lucky draw winner operations
  const getLuckyDrawWinners = async (eventId?: string): Promise<LuckyDrawWinner[]> => {
    try {
      if (globalMode === 'online' && networkManager.isOnline()) {
        const { data, error } = await supabase
          .from('lucky_draw_winners')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const winner of data) {
            await hybridDB.luckyDrawWinners.put({
              ...winner,
              syncStatus: 'synced',
              lastSynced: new Date().toISOString()
            });
          }
          return eventId ? data.filter(w => w.event_id === eventId) : data;
        }
      }

      const all = await hybridDB.luckyDrawWinners.toArray();
      return eventId ? all.filter(w => w.event_id === eventId) : all;
    } catch (error) {
      console.warn('Error fetching lucky draw winners, using local data:', error);
      const all = await hybridDB.luckyDrawWinners.toArray();
      return eventId ? all.filter(w => w.event_id === eventId) : all;
    }
  };

  const createLuckyDrawWinner = async (winnerData: Partial<LuckyDrawWinner>): Promise<LuckyDrawWinner> => {
    const result = await createRecord('lucky_draw_winners', winnerData);
    return result as LuckyDrawWinner;
  };

  // Company-specific operations
  const getCompanies = async (): Promise<Company[]> => {
    try {
      if (globalMode === 'online' && networkManager.isOnline()) {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const company of data) {
            await hybridDB.companies.put({
              ...company,
              syncStatus: 'synced',
              lastSynced: new Date().toISOString()
            });
          }
          return data;
        }
      }

      const all = await hybridDB.companies.toArray();
      return all;
    } catch (error) {
      console.warn('Error fetching companies, using local data:', error);
      const all = await hybridDB.companies.toArray();
      return all;
    }
  };

  const createCompany = async (companyData: Partial<Company>): Promise<Company> => {
    const result = await createRecord('companies', companyData);
    return result as Company;
  };

  const updateCompany = async (id: string, companyData: Partial<Company>): Promise<Company> => {
    const result = await updateRecord('companies', id, companyData);
    return result as Company;
  };

  const deleteCompany = async (id: string): Promise<void> => {
    return deleteRecord('companies', id);
  };

  return {
    // Network and sync
    syncAllData,
    isOnline: () => networkManager.isOnline(),
    
    // Events
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    
    // Attendees
    getAttendees,
    createAttendee,
    updateAttendee,
    deleteAttendee,
    
    // Lucky draw winners
    getLuckyDrawWinners,
    createLuckyDrawWinner,
    
    // Companies
    getCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    
    // Generic operations
    createRecord,
    updateRecord,
    deleteRecord
  };
}; 