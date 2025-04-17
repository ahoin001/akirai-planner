"use client";

import { useAuthStore } from "@/app/stores/useAuthStore";
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import PushSubscriptionManager from "@/components/push-subscription-manager";
import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";

import OneSignal from "react-onesignal";
// Store OneSignal initialization status to prevent multiple runs
let oneSignalInitialized = false;

import {
  LoadingIndicator,
  LoadingBanner,
} from "@/components/loading-indicator";

export default function AppLayout({ children }) {
  const { fetchUser } = useAuthStore();
  const loadInitialTaskData = useTaskStore((state) => state.loadInitialData);
  const isTaskDataLoading = useTaskStore((state) => state.isLoading);
  const setIsLoading = useTaskStore((state) => state.setIsLoading);
  // Local state for initial overall loading (including auth)
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  // ************************************
  // * Realtime setup
  // ************************************
  useEffect(() => {
    let isMounted = true;
    let unsubscribeRealtime = () => {};

    const loadData = async () => {
      setInitError(null);
      setIsInitializing(true); // Start overall initialization indicator
      try {
        await fetchUser(); // Fetch user first
        // loadInitialTaskData now sets its own isLoading state in the store
        unsubscribeRealtime = await loadInitialTaskData();
        // Initial data load attempt finished (success or handled error)
      } catch (err) {
        console.error("Error during initial data load:", err);
        if (isMounted) {
          setInitError(err.message || "Failed to initialize application data.");
          toast.error(err.message || "Failed to load planner data.");
        }
      } finally {
        // Regardless of success/error of loadInitialTaskData,
        // stop the *initial page* loading indicator
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    loadData();

    // Cleanup function: This runs when the component unmounts
    return () => {
      isMounted = false;
      console.log("AppLayout unmounting, calling unsubscribe...");
      // ****** CHANGE: Call the unsubscribe function returned by loadInitialData ******
      unsubscribeRealtime();
    };
  }, [fetchUser, loadInitialTaskData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="text-accent mb-4 h-[10em] w-[10em] animate-spin" />
          <span className="text-white">Initializing planner...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* <PushSubscriptionManager /> */}
      <Toaster richColors position="top-right" />
      {/* Option A: Overlay Spinner */}
      <LoadingIndicator show={isTaskDataLoading} text="Syncing tasks..." />
      {children}
    </div>
  );
}
