import { Suspense } from "react";
import { MonthSummaryView } from "@/components/rhythm/MonthSummaryView";

export default function MonthSummaryPage() {
  return (
    <Suspense>
      <MonthSummaryView />
    </Suspense>
  );
}
