import { Suspense } from "react";
import { FinishRoute } from "@/components/workout/FinishScreen";

export default function FinishPage() {
  return (
    <Suspense>
      <FinishRoute />
    </Suspense>
  );
}
