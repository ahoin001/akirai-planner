// components/PushSubscriptionManager.jsx (or integrate into AppLayout/Settings)
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { BellRing, BellOff } from "lucide-react";
import { toast } from "react-hot-toast";

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushSubscriptionManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Check existing status on load
  const [permissionStatus, setPermissionStatus] = useState("default"); // 'granted', 'denied', 'default'
  const supabase = createClient(); // Initialize client

  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Check initial state on mount
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      console.warn(
        "Push notifications not supported by this browser or VAPID key missing."
      );
      setIsLoading(false);
      return;
    }

    setPermissionStatus(Notification.permission); // Check initial permission

    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        if (sub) {
          console.log("Found existing subscription:", sub);
          setSubscription(sub);
          setIsSubscribed(true);
        }
        setIsLoading(false);
      });
    });
  }, [VAPID_PUBLIC_KEY]);

  // --- Subscription Logic ---
  const subscribeUser = async () => {
    if (!VAPID_PUBLIC_KEY) {
      toast.error("VAPID Key configuration missing.");
      return;
    }

    try {
      // 1. Request Permission if not granted
      if (Notification.permission === "default") {
        const permissionResult = await Notification.requestPermission();
        setPermissionStatus(permissionResult);
        if (permissionResult !== "granted") {
          toast.error("Notification permission denied.");
          return;
        }
      } else if (Notification.permission === "denied") {
        toast.error("Notification permission was previously denied.");
        // Optionally guide user to browser settings
        return;
      }

      // 2. Get Service Worker Registration
      const registration = await navigator.serviceWorker.ready;
      console.log("Service Worker ready for subscription.");

      // 3. Subscribe with PushManager
      console.log("Subscribing to Push Manager...");
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("Push Subscription successful:", sub);

      // 4. Send Subscription to Backend
      console.log("Sending subscription to server...");
      const {
        data: { user },
      } = await supabase.auth.getUser(); // Ensure user is logged in
      if (!user) {
        toast.error("You must be logged in to enable notifications.");
        // Attempt to unsubscribe if subscription happened before auth check
        await sub.unsubscribe();
        return;
      }

      const { error: insertError } = await supabase
        .from("push_subscriptions")
        .insert({
          user_id: user.id,
          subscription_object: sub.toJSON(), // Store the subscription JSON
        });

      if (insertError) {
        console.error("Error saving subscription:", insertError);
        toast.error(`Failed to save subscription: ${insertError.message}`);
        // Attempt to unsubscribe the user since saving failed
        await sub.unsubscribe();
        throw insertError; // Re-throw to indicate failure
      }

      setSubscription(sub);
      setIsSubscribed(true);
      toast.success("Notifications Enabled!");
    } catch (error) {
      console.error("Failed to subscribe user:", error);
      setIsSubscribed(false);
      setSubscription(null);
      if (error.name === "NotAllowedError") {
        toast.error("Notification permission denied.");
      } else {
        toast.error("Failed to enable notifications. Check console.");
      }
    }
  };

  // --- Unsubscription Logic ---
  const unsubscribeUser = async () => {
    if (!subscription) return;

    console.log("Unsubscribing user...");
    try {
      // 1. Remove subscription from backend FIRST
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        // Match using the unique endpoint stored in the subscription object
        .eq("subscription_object->>endpoint", subscription.endpoint); // ->> extracts text

      if (deleteError) {
        // Log error but proceed to unsubscribe from browser anyway
        console.error("Error deleting subscription from DB:", deleteError);
        toast.error(
          "Could not remove subscription from server, but unsubscribing locally."
        );
      } else {
        console.log("Subscription removed from server.");
      }

      // 2. Unsubscribe from browser PushManager
      const unsubscribed = await subscription.unsubscribe();
      if (unsubscribed) {
        console.log("Successfully unsubscribed from PushManager.");
        setSubscription(null);
        setIsSubscribed(false);
        toast.success("Notifications Disabled.");
      } else {
        console.error("Failed to unsubscribe from PushManager.");
        toast.error("Failed to fully disable notifications locally.");
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable notifications.");
    }
  };

  // Render Button based on state
  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        Checking Notifications...
      </Button>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <Button variant="destructive" disabled>
        Permissions Denied
      </Button>
    );
  }

  if (isSubscribed) {
    return (
      <Button variant="outline" onClick={unsubscribeUser}>
        <BellOff className="mr-2 h-4 w-4" /> Disable Notifications
      </Button>
    );
  } else {
    return (
      <Button onClick={subscribeUser}>
        <BellRing className="mr-2 h-4 w-4" /> Enable Notifications
      </Button>
    );
  }
}
