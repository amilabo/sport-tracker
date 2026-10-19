import { Suspense } from "react";
import { MetricView } from "@/components/body/MetricView";

export default function BodyMetricPage() {
  return (
    <Suspense>
      <MetricView />
    </Suspense>
  );
}
