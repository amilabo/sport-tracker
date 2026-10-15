import { Suspense } from "react";
import { WorkoutRoute } from "@/components/workout/WorkoutScreen";

export default function WorkoutPage() {
  return (
    <Suspense>
      <WorkoutRoute />
    </Suspense>
  );
}
