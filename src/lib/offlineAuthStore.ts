import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OfflineUserType = 'admin' | 'guest' | 'superadmin';

interface OfflineUser {
  id: string;
  type: OfflineUserType;
  name: string;
  email: string;
  eventId?: string; // For guest users
  companyId?: string; // For admin users
}

interface OfflineAuthState {
  isOfflineMode: boolean;
  currentUser: OfflineUser | null;
  offlineUsers: OfflineUser[];
  setIsOfflineMode: (mode: boolean) => void;
  setCurrentUser: (user: OfflineUser | null) => void;
  addOfflineUser: (user: OfflineUser) => void;
  removeOfflineUser: (userId: string) => void;
  loginOffline: (email: string, password: string) => OfflineUser | null;
  logoutOffline: () => void;
}

// Default offline users
const DEFAULT_OFFLINE_USERS: OfflineUser[] = [
  {
    id: 'superadmin-offline',
    type: 'superadmin',
    name: 'Super Admin',
    email: 'admin@offline',
    companyId: 'offline-company'
  },
  {
    id: 'admin-offline',
    type: 'admin',
    name: 'Admin User',
    email: 'admin@offline.com',
    companyId: 'offline-company'
  },
  {
    id: 'guest-offline',
    type: 'guest',
    name: 'Guest User',
    email: 'guest@offline.com',
    eventId: 'offline-event'
  }
];

export const useOfflineAuthStore = create<OfflineAuthState>()(
  persist(
    (set, get) => ({
      isOfflineMode: false,
      currentUser: null,
      offlineUsers: DEFAULT_OFFLINE_USERS,

      setIsOfflineMode: (mode) => set({ isOfflineMode: mode }),

      setCurrentUser: (user) => set({ currentUser: user }),

      addOfflineUser: (user) => set((state) => ({
        offlineUsers: [...state.offlineUsers, user]
      })),

      removeOfflineUser: (userId) => set((state) => ({
        offlineUsers: state.offlineUsers.filter(u => u.id !== userId)
      })),

      loginOffline: (email, password) => {
        const { offlineUsers } = get();
        const user = offlineUsers.find(u => u.email === email);
        
        if (user) {
          // No password required for offline mode
          set({ currentUser: user });
          return user;
        }
        
        return null;
      },

      logoutOffline: () => set({ currentUser: null })
    }),
    {
      name: 'offline-auth-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        offlineUsers: state.offlineUsers,
        isOfflineMode: state.isOfflineMode
      })
    }
  )
); 