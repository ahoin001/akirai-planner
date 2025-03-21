"use client";

import { useAuthStore } from "@/app/stores/useAuthStore";
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";

export default function AppLayout({ children }) {
  const { fetchUser } = useAuthStore();
  const hydrateAndSubscribe = useTaskStore(
    (state) => state.hydrateAndSubscribe
  );

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await fetchUser();
      await hydrateAndSubscribe();
      setIsLoading(false);
    };

    loadData();
  }, [fetchUser, hydrateAndSubscribe]);

  if (isLoading) {
    return <div className="text-white p-4">Initializing planner...</div>;
  }

  return <div className="w-full">{children}</div>;
}
