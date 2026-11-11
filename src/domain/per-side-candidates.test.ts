import { describe, expect, it } from "vitest";
import { seedId } from "./ids";
import { perSideCandidates, perSideWhy, type PlanLine } from "./per-side-candidates";
import type { Exercise } from "./types";

const ex = (name: string, over: Partial<Exercise> = {}): Exercise =>
  ({ id: name, name, log_type: "weight_reps", equipment: "machine", is_builtin: false, ...over }) as Exercise;
const line = (exercise: Exercise, reps: number[], note: string | null = null): PlanLine => ({ exercise, note, reps });

describe("«На каждую сторону?» candidates (stage 53, Р6)", () => {
  it("checked: already set, a note, the catalog; listed unchecked: 20+ reps; nothing else", () => {
    const bulgarian = ex("Болгарские сплит-приседания", { id: seedId("exercise:bulgarian_split_squat"), is_builtin: true });
    const list = perSideCandidates([
      line(ex("Фрогги", { log_type: "reps" }), [20, 20]),
      line(ex("Наклон корпуса на балансе"), [20], "на каждую ногу по 10 раз"),
      line(bulgarian, [10]),
      line(ex("Разгибание ног"), [14, 14]),
      line(ex("Отведение назад", { per_side: true }), [24]),
      line(ex("Планка", { log_type: "time" }), [30]),
    ]);
    expect(list.map((c) => `${c.exercise.name}: ${perSideWhy(c)}${c.checked ? " ✓" : ""}`)).toEqual([
      "Отведение назад: уже отмечено ✓",
      "Наклон корпуса на балансе: в заметке: «на каждую ногу по 10 раз» ✓",
      "Болгарские сплит-приседания: в каталоге — на каждую сторону ✓",
      "Фрогги: в плане 20 раз — возможно, сумма?",
    ]);
  });

  it("an exercise in two plans — once, by the stronger reason", () => {
    const e = ex("Мост на одной ноге");
    const list = perSideCandidates([line(e, [24]), line(e, [12], "по 12 на ногу")]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ reason: "note", checked: true });
  });
});
