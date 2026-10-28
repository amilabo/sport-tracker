import { describe, expect, it } from "vitest";
import type { CatalogSub } from "@/content/substitutes";
import { lastTimeText, markText, relationText, substituteSections, type SubstituteInput } from "./substitutes";
import type { Exercise, MuscleGroup } from "./types";

function ex(id: string, name: string, muscle_group: MuscleGroup = "back", extra: Partial<Exercise> = {}): Exercise {
  return {
    id, name, muscle_group, equipment: "machine", log_type: "weight_reps", is_builtin: true, archived_at: null,
    progression_id: null, progression_level: null, created_at: "", updated_at: "", is_demo: false, ...extra,
  };
}

const ROW = ex("row", "Тяга нижнего блока");
const HAMMER = ex("hammer", "Хаммер");
const DB_ROW = ex("db", "Тяга гантели");
const TBAR = ex("tbar", "Тяга Т-грифа");
const LAT = ex("lat", "Тяга верхнего блока");
const SHRUG = ex("shrug", "Шраги");
const BACKEXT = ex("ext", "Гиперэкстензия");
const PEC = ex("pec", "Пек-дек", "chest");
const sets = (w: number) => [{ weight: w, reps: 12, duration_sec: null, speed_kmh: null }];
const catalog: CatalogSub[] = [
  { id: "hammer", relation: "same", note: "тренажёр, упор груди" },
  { id: "db", relation: "same", note: "гантели, по одной руке" },
  { id: "tbar", relation: "same", note: "штанга" },
];

function input(over: Partial<SubstituteInput> = {}): SubstituteInput {
  return {
    target: ROW,
    exercises: [ROW, HAMMER, DB_ROW, TBAR, LAT, SHRUG, BACKEXT, PEC],
    catalog,
    chain: null,
    replaced: [],
    last: new Map(),
    ...over,
  };
}
const names = (rows: { exercise: Exercise }[]) => rows.map((r) => r.exercise.name);

describe("substituteSections", () => {
  it("offers the reference first, then the rest of the muscle group; never the exercise itself", () => {
    const s = substituteSections(input());
    expect(s.mine).toBeNull();
    expect(names(s.similar)).toEqual(["Хаммер", "Тяга гантели", "Тяга Т-грифа"]);
    expect(names(s.more)).toEqual(["Гиперэкстензия", "Тяга верхнего блока", "Шраги"]);
  });

  it("puts «Ваша замена» first and shows it once", () => {
    const s = substituteSections(input({ target: { ...ROW, substitute_id: "db" } }));
    expect(s.mine?.exercise.name).toBe("Тяга гантели");
    expect(s.mine?.relation).toBe("same");
    expect(names(s.similar)).toEqual(["Хаммер", "Тяга Т-грифа"]);
  });

  it("leaves out today's exercises and archived ones, «Ваша замена» included", () => {
    const s = substituteSections(
      input({
        target: { ...ROW, substitute_id: "db" },
        exercises: [ROW, HAMMER, DB_ROW, { ...TBAR, archived_at: "2026-10-01T00:00:00.000Z" }, LAT, SHRUG, BACKEXT],
        excludeIds: ["db", "lat"],
      }),
    );
    expect(s.mine).toBeNull();
    expect(names(s.similar)).toEqual(["Хаммер"]);
    expect(names(s.more)).toEqual(["Гиперэкстензия", "Шраги"]);
  });

  it("marks past replacements and adds the ones outside the reference to «Похожие»", () => {
    const s = substituteSections(
      input({
        replaced: [
          { exerciseId: "shrug", at: "2026-10-10T07:00:00.000Z", sets: sets(20) },
          { exerciseId: "hammer", at: "2026-10-02T07:00:00.000Z", sets: sets(25) },
        ],
        last: new Map([["lat", { at: "2026-10-19T07:00:00.000Z", sets: sets(40) }]]),
      }),
    );
    expect(names(s.similar)).toEqual(["Хаммер", "Тяга гантели", "Тяга Т-грифа", "Шраги"]);
    expect(s.similar[0].mark?.kind).toBe("replaced");
    expect(s.similar[3].relation).toBeNull();
    // Done ones first in the group.
    expect(names(s.more)).toEqual(["Тяга верхнего блока", "Гиперэкстензия"]);
    expect(s.more[0].mark?.kind).toBe("done");
  });

  it("adds progression neighbours as «легче» and «сложнее»", () => {
    const s = substituteSections(
      input({ catalog: [], chain: { name: "Тяги", members: [BACKEXT, ROW, LAT] } }),
    );
    expect(s.similar.map((r) => [r.exercise.name, r.relation, r.note])).toEqual([
      ["Гиперэкстензия", "easier", "прогрессия «Тяги»"],
      ["Тяга верхнего блока", "harder", "прогрессия «Тяги»"],
    ]);
  });

  it("an own exercise has no reference: «Ваша замена», past replacements and the group", () => {
    const own = ex("own", "Моя тяга", "back", { is_builtin: false, substitute_id: "hammer" });
    const s = substituteSections(input({ target: own, catalog: [], exercises: [own, HAMMER, LAT, PEC] }));
    expect(s.mine?.exercise.name).toBe("Хаммер");
    expect(s.mine?.relation).toBeNull();
    expect(s.similar).toEqual([]);
    expect(names(s.more)).toEqual(["Тяга верхнего блока"]);
  });
});

describe("row texts", () => {
  it("joins the relation and the note, prints marks with a short date", () => {
    expect(relationText({ relation: "angle", note: "верх груди" })).toBe("Смещает акцент · верх груди");
    expect(relationText({ relation: null, note: null })).toBeNull();
    const mark = { kind: "replaced" as const, at: "2026-10-02T07:00:00.000Z", sets: [...sets(25), ...sets(25), ...sets(25)] };
    expect(markText({ exercise: HAMMER, mark })).toBe("Меняли 2 окт · 3 × 12 × 25 кг");
    expect(markText({ exercise: HAMMER, mark: { ...mark, kind: "done" } })).toBe("Делали 2 окт · 3 × 12 × 25 кг");
    expect(lastTimeText({ exercise: HAMMER, mark })).toBe("В прошлый раз: 3 × 12 × 25 кг");
    expect(markText({ exercise: HAMMER, mark: null })).toBeNull();
  });
});
