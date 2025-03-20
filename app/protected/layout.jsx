"use client";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";

export default function AppLayout({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const hydrateAndSubscribe = useTaskStore(
    (state) => state.hydrateAndSubscribe
  );

  useEffect(() => {
    const startDate = dayjs().startOf("week");

    const loadData = async () => {
      await hydrateAndSubscribe(startDate);
      setIsLoading(false);
    };

    loadData();
  }, [hydrateAndSubscribe]);

  if (isLoading) {
    return <div className="text-white p-4">Initializing planner...</div>;
  }

  return <div className="w-full">{children}</div>;
}
