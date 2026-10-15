import { Suspense } from "react";
import { HistoryWorkoutRoute } from "@/components/history/HistoryWorkout";

export default function HistoryWorkoutPage() {
  return (
    <Suspense>
      <HistoryWorkoutRoute />
    </Suspense>
  );
}
