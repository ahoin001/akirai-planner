"use client";

import { useAuthStore } from "@/app/stores/useAuthStore";
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import PushSubscriptionManager from "@/components/push-subscription-manager";
import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import { Loader2, XCircle } from "lucide-react";
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

  // const [isLoading, setIsLoading] = useState(true);

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

    return () => {
      isMounted = false;
      console.log("AppLayout unmounting, calling unsubscribe...");
      unsubscribeRealtime();
    };
  }, [fetchUser, loadInitialTaskData]);

  // ************************************
  // * OneSignal Initialization Effect
  // ************************************
  // useEffect(() => {
  //   // Ensure this runs only once and only on the client
  //   if (typeof window !== "undefined" && !oneSignalInitialized) {
  //     const initializeOneSignal = async () => {
  //       try {
  //         console.log("Initializing OneSignal...");
  //         // Check if already initialized by the service worker perhaps
  //         // (May not be needed with react-onesignal wrapper)
  //         // if (window.OneSignal?.initialized) {
  //         //     console.log("OneSignal already initialized.");
  //         //     oneSignalInitialized = true;
  //         //     return;
  //         // }

  //         await OneSignal.init({
  //           appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
  //           // IMPORTANT: Set allowLocalhostAsSecureOrigin to true for http://localhost testing
  //           allowLocalhostAsSecureOrigin:
  //             process.env.NODE_ENV === "development",
  //           // You can disable the default slide prompt if you want to trigger it manually
  //           // autoRegister: false, // Set to false to manually call OneSignal.Slidedown.promptPush()
  //           // notifyButton: { enable: false }, // Disable the bell widget if desired
  //         });
  //         console.log("OneSignal Initialized");
  //         oneSignalInitialized = true; // Mark as initialized

  //         // --- Link User ID after Init (if user is logged in) ---
  //         // It's crucial to associate the OneSignal device ID with your user ID
  //         const supabase = createSupabaseBrowserClient(); // Your client util
  //         const {
  //           data: { user },
  //         } = await supabase.auth.getUser();
  //         if (user) {
  //           console.log(`Setting OneSignal External User ID: ${user.id}`);
  //           OneSignal.login(user.id); // Use login (new method) or setExternalUserId (older)
  //           // OneSignal.setExternalUserId(user.id);
  //         }

  //         // --- Listen for subscription changes ---
  //         OneSignal.Notifications.addEventListener(
  //           "permissionChange",
  //           (permission) => {
  //             console.log("OneSignal Permission Changed:", permission);
  //             // Potentially update UI or local state based on permission
  //           }
  //         );
  //         OneSignal.Notifications.addEventListener(
  //           "subscriptionChange",
  //           (isSubscribed) => {
  //             console.log("OneSignal Subscription Changed:", isSubscribed);
  //             // Handle cases where user unsubscribes via browser settings
  //             if (!isSubscribed) {
  //               // Optional: Tell your backend the user unsubscribed
  //               // This is complex as you might not have the specific subscription ID here
  //               console.warn(
  //                 "User unsubscribed via browser/OneSignal settings."
  //               );
  //             }
  //           }
  //         );
  //       } catch (error) {
  //         console.error("OneSignal initialization failed:", error);
  //       }
  //     };
  //     initializeOneSignal();
  //   }
  // }, []);

  // ************************************
  // * Auth State Change Listener
  // ************************************
  // useEffect(() => {
  //   const supabase = createSupabaseBrowserClient();
  //   const { data: authListener } = supabase.auth.onAuthStateChange(
  //     (event, session) => {
  //       console.log("Auth State Changed:", event);
  //       if (oneSignalInitialized) {
  //         // Check if OneSignal is ready
  //         if (event === "SIGNED_IN") {
  //           console.log(
  //             `Setting OneSignal External User ID on SIGN_IN: ${session?.user?.id}`
  //           );
  //           if (session?.user?.id) {
  //             OneSignal.login(session.user.id); // Associate device with logged-in user
  //           }
  //         } else if (event === "SIGNED_OUT") {
  //           console.log("Removing OneSignal External User ID on SIGN_OUT");
  //           OneSignal.logout(); // Disassociate device from logged-out user
  //         }
  //       }
  //     }
  //   );
  //   return () => {
  //     authListener?.subscription?.unsubscribe();
  //   };
  // }, []);

  if (isInitializing) {
    return (
      <div className="w-full flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center text-center p-4">
          <Loader2 className="text-rose-400 mb-4 h-12 w-12 sm:h-16 sm:w-16 animate-spin" />
          <span className="text-gray-300 text-lg sm:text-xl font-medium">
            Initializing planner...
          </span>
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
