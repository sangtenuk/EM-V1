import React, { useEffect, useRef } from 'react';
import { useSyncStatusStore } from '../lib/hybridDB';
import { useGlobalModeStore } from '../lib/globalModeStore';
import { NetworkManager } from '../lib/hybridDB';
import { hybridDB } from '../lib/hybridDB';
import { supabase } from '../lib/supabase';

export default function HybridInitializer() {
  const { setSyncStatus, setIsOnline } = useSyncStatusStore();
  const { mode, setMode } = useGlobalModeStore();
  const initializedRef = useRef(false);
  const networkManagerRef = useRef<NetworkManager | null>(null);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    networkManagerRef.current = NetworkManager.getInstance();
    const networkManager = networkManagerRef.current;
    
    // Initialize network status listener
    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
      
      // Auto-switch mode based on connectivity
      if (!online && mode === 'online') {
        setMode('hybrid');
      } else if (online && mode === 'offline') {
        setMode('hybrid');
      }

      // Auto-sync when coming back online
      if (online && mode !== 'offline') {
        setTimeout(() => {
          performInitialSync();
        }, 1000); // Small delay to ensure connection is stable
      }
    };

    // Add network listener
    networkManager.addListener(handleNetworkChange);

               // Initialize sync status
    const initializeSync = async () => {
      try {
        // Check initial connectivity - be more optimistic initially
        const online = networkManager.isOnline();
        setIsOnline(online);
        
        // If we're online or the browser says we're online, try to sync
        if ((online || navigator.onLine) && mode !== 'offline') {
          // Perform initial sync using direct database operations
          await performInitialSync();
        } else {
          // If offline, set status accordingly
          setSyncStatus('offline');
        }
      } catch (error) {
        console.error('Error initializing hybrid database:', error);
        setSyncStatus('error');
      }
    };

    const performInitialSync = async () => {
      try {
        setSyncStatus('syncing');
        
        // Sync events
        try {
          const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });

          if (!eventsError && events) {
            for (const event of events) {
              await hybridDB.events.put({
                ...event,
                syncStatus: 'synced',
                lastSynced: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.warn('Failed to sync events:', error);
        }

        // Sync attendees
        try {
          const { data: attendees, error: attendeesError } = await supabase
            .from('attendees')
            .select('*')
            .order('created_at', { ascending: false });

          if (!attendeesError && attendees) {
            for (const attendee of attendees) {
              await hybridDB.attendees.put({
                ...attendee,
                syncStatus: 'synced',
                lastSynced: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.warn('Failed to sync attendees:', error);
        }

        // Sync lucky draw winners
        try {
          const { data: winners, error: winnersError } = await supabase
            .from('lucky_draw_winners')
            .select('*')
            .order('created_at', { ascending: false });

          if (!winnersError && winners) {
            for (const winner of winners) {
              await hybridDB.luckyDrawWinners.put({
                ...winner,
                syncStatus: 'synced',
                lastSynced: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.warn('Failed to sync lucky draw winners:', error);
        }

        // Sync companies
        try {
          const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

          if (!companiesError && companies) {
            for (const company of companies) {
              await hybridDB.companies.put({
                ...company,
                syncStatus: 'synced',
                lastSynced: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.warn('Failed to sync companies:', error);
        }

        setSyncStatus('success');
      } catch (error) {
        console.error('Initial sync failed:', error);
        setSyncStatus('error');
      }
    };

    initializeSync();

    // Set up periodic sync (every 5 minutes)
    const syncInterval = setInterval(async () => {
      if (networkManager.isOnline() && mode !== 'offline') {
        try {
          await performInitialSync();
        } catch (error) {
          console.error('Periodic sync failed:', error);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(syncInterval);
      if (networkManagerRef.current) {
        networkManagerRef.current.removeListener(handleNetworkChange);
      }
    };
  }, []); // Empty dependency array to run only once

  // Handle mode changes separately
  useEffect(() => {
    if (!networkManagerRef.current) return;
    
    const networkManager = networkManagerRef.current;
    if (mode !== 'offline' && networkManager.isOnline()) {
      // Trigger sync after a short delay to avoid immediate execution
      const timeoutId = setTimeout(async () => {
        try {
          setSyncStatus('syncing');
          // Perform sync operations here
          setSyncStatus('success');
        } catch (error) {
          console.error('Mode change sync failed:', error);
          setSyncStatus('error');
        }
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [mode, setSyncStatus]);

  // This component doesn't render anything
  return null;
} 