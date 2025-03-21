import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import VerticalGanttChart from "@/components/vertical-gantt-chart";
export default async function ProtectedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <main className="flex flex-col w-full h-screen text-white overflow-hidden">
      <VerticalGanttChart />
    </main>
  );
}
