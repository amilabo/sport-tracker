import { PageHeader } from "@/components/ui/PageHeader";

export default function HistoryPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 pb-5">
      <PageHeader title="История" />
      <p className="px-5 text-[15px] text-ink-muted">Лента тренировок появится на этапе 7.</p>
    </div>
  );
}
