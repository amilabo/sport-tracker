import { MUSCLE_GROUP_ON } from "@/domain/labels";
import { lastTimeText, markText, relationText, substituteSections, type SubstituteInput } from "@/domain/substitutes";
import type { Id } from "@/domain/types";
import type { BrowserSection } from "./ExerciseBrowser";

/**
 * «Заменить на сегодня» without a search: «Как в плане» (when the slot is already replaced) → «Ваша замена» →
 * «Похожие» → «Ещё на <группу>». Exercises of today's workout are left out.
 */
export function replaceSections(ctx: SubstituteInput, excludeIds: Id[], planned: boolean): BrowserSection[] {
  const s = substituteSections({ ...ctx, excludeIds });
  const target = ctx.target;
  const sections: BrowserSection[] = [];
  if (planned) {
    const last = ctx.last.get(target.id);
    sections.push({ title: "Как в плане", rows: [{ exercise: target, mark: last ? lastTimeText({ exercise: target, mark: { kind: "done", ...last } }) : null }] });
  }
  if (s.mine) sections.push({ title: "Ваша замена", inverse: true, rows: [{ exercise: s.mine.exercise, line: relationText(s.mine), mark: lastTimeText(s.mine) }] });
  sections.push({ title: "Похожие", rows: s.similar.map((r) => ({ exercise: r.exercise, line: relationText(r), mark: markText(r) })) });
  sections.push({ title: `Ещё на ${MUSCLE_GROUP_ON[target.muscle_group]}`, rows: s.more.map((r) => ({ exercise: r.exercise, mark: markText(r) })) });
  return sections;
}
