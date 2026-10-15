"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseBrowser } from "@/components/exercises/ExerciseBrowser";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";

export default function CatalogPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data: exercises } = useLive(() => exercisesRepo.list(), [], ["exercises"]);

  return (
    <div className="flex flex-1 flex-col pb-8">
      <PageHeader
        title="Каталог"
        backHref="/more/"
        action={
          <Button variant="primary" size="md" onClick={() => setCreating(true)}>
            + Новое
          </Button>
        }
      />
      <div className="px-4">
        {exercises && (
          <>
            <p className="mb-3 font-mono text-[13px] text-ink-muted">{exercises.length} в каталоге</p>
            <ExerciseBrowser
              exercises={exercises}
              onSelect={(e) => router.push(`/exercises/view/?id=${e.id}`)}
            />
          </>
        )}
      </div>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Новое упражнение"
        footer={
          <Button variant="primary" type="submit" form="catalog-new-exercise" className="w-full">
            Создать
          </Button>
        }
      >
        <ExerciseForm
          id="catalog-new-exercise"
          onSubmit={async (input) => {
            await exercisesRepo.create(input);
            setCreating(false);
          }}
        />
      </Sheet>
    </div>
  );
}
