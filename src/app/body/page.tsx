import { PageHeader } from "@/components/ui/PageHeader";

export default function BodyPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 pb-5">
      <PageHeader title="Тело" />
      <p className="px-5 text-[15px] text-ink-muted">Замеры появятся на этапе 10.</p>
    </div>
  );
}
