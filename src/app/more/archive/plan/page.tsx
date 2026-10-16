import { Suspense } from "react";
import { ArchivedPlanView } from "@/components/plan/ArchivedPlanView";

export default function ArchivedPlanPage() {
  return (
    <Suspense>
      <ArchivedPlanView />
    </Suspense>
  );
}
