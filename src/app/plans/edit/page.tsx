import { Suspense } from "react";
import { PlanEditor } from "@/components/plan/PlanEditor";

export default function PlanEditPage() {
  return (
    <Suspense>
      <PlanEditor />
    </Suspense>
  );
}
