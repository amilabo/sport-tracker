import { Suspense } from "react";
import { ExerciseView } from "@/components/exercises/ExerciseView";

export default function ExercisePage() {
  return (
    <Suspense>
      <ExerciseView />
    </Suspense>
  );
}
