"use client";

import { useAuthStore } from "@/app/stores/useAuthStore";
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import PushSubscriptionManager from "@/components/push-subscription-manager";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";

export default function AppLayout({ children }) {
  const { fetchUser } = useAuthStore();
  const loadInitialTaskData = useTaskStore((state) => state.loadInitialData);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    let unsubscribeRealtime = () => {}; // Initialize unsubscribe function

    const loadData = async () => {
      try {
        // Ensure fetchUser completes before loading tasks (if task loading depends on user)
        await fetchUser();

        // It fetches initial tasks/exceptions AND sets up subscriptions
        // It returns the unsubscribe function
        unsubscribeRealtime = await loadInitialTaskData();

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error during initial data load:", err);
        if (isMounted) {
          setIsLoading(false); // Stop loading even on error
          // toast.error(err.message || "Failed to load planner data.");
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
      {children}
    </div>
  );
}
