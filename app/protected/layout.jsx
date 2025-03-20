"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import dayjs from "dayjs";

export default function AppLayout({ children }) {
  const hydrateAndSubscribe = useTaskStore(
    (state) => state.hydrateAndSubscribe
  );

  useEffect(() => {
    const startDate = dayjs().startOf("week");
    // Hydrate the store and set up realtime subscriptions
    const unsubscribe = hydrateAndSubscribe(startDate);

    return () => unsubscribe();
  }, [hydrateAndSubscribe]);

  return <div className="w-full">{children}</div>;
}
