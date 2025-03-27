"use client";

import { useAuthStore } from "@/app/stores/useAuthStore";
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import { Loader2 } from "lucide-react";

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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="text-accent mb-4 h-[10em] w-[10em] animate-spin" />
          <span className="text-white">Initializing planner...</span>
        </div>
      </div>
    );
  }

  return <div className="w-full">{children}</div>;
}
