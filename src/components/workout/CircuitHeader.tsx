import type { WorkoutItem } from "@/db/repos/workouts";
import { circuitProgress } from "@/domain/circuit";
import { formatRest } from "@/domain/rest";
import type { PlanCircuit } from "@/domain/types";

/** «Круг 2 из 3» over the exercises of a circuit in the gym (mockup О6): round dots and the circuit's rest. */
export function CircuitHeader({ circuitId, circuit, items }: { circuitId: string; circuit: PlanCircuit | undefined; items: WorkoutItem[] }) {
  const { round, rounds, done } = circuitProgress(items, circuitId);
  // By time (Т2): «0:40 / 0:20» — work and rest in the circuit — in the same row.
  const timed = circuit?.mode === "timed" && !!circuit.work_sec;
  return (
    <div data-circuit-header className="flex flex-col gap-1.5 px-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-inverse px-2.5 whitespace-nowrap font-display text-[11px] font-bold tracking-[0.04em] text-on-inverse uppercase">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.3-5.6" />
            <path d="M20 4v4.5h-4.5" />
          </svg>
          {done ? `Все ${rounds} ${rounds === 1 ? "круг" : rounds < 5 ? "круга" : "кругов"} сделаны` : `Круг ${round} из ${rounds}`}
        </span>
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: rounds }, (_, r) => (
            <span
              key={r}
              className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${done || r < round - 1 ? "border-accent bg-accent" : r === round - 1 ? "border-ink" : "border-line-strong"}`}
            />
          ))}
        </span>
        {timed && (
          <span className="ml-auto font-mono text-xs whitespace-nowrap text-ink-muted">
            {formatRest(circuit?.work_sec ?? 0)} / {formatRest(circuit?.rest_inside_sec ?? 0)}
          </span>
        )}
      </div>
      {circuit && !timed && (
        <p className="font-mono text-xs text-ink-muted">
          в круге {formatRest(circuit.rest_inside_sec)} · между кругами {formatRest(circuit.rest_round_sec)}
        </p>
      )}
    </div>
  );
}
