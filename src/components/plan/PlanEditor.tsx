"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { Button } from "@/components/ui/Button";
import { Field, FormError, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { plansRepo, type PlanFull } from "@/db/repos/plans";
import {
  alignSets,
  circuitIdFor,
  cleanCircuits,
  clampRounds,
  newCircuit,
  tidyGroups,
  MAX_ROUNDS,
  WHOLE_CIRCUIT_ID,
  wholeCircuit,
} from "@/domain/circuit";
import { plural } from "@/domain/format";
import { uuid } from "@/domain/ids";
import { parseQuickInput, QUICK_INPUT_EXAMPLES } from "@/domain/quick-input";
import { EDITOR_FORMATS, FORMAT_LABELS, formatRest, hasRestSettings, ownRest, restSettings, setRestFor, usesRest, type RestSettings } from "@/domain/rest";
import { emptySet, MAX_SETS, toQuickInput } from "@/domain/sets";
import { DomainError, type Exercise, type Id, type PlanCircuit, type SetValues } from "@/domain/types";
import { PlanItemCard, type EditorRow } from "./PlanItemCard";
import { RestSheet } from "./RestSheet";
import { SetEditorSheet } from "./SetEditorSheet";
import { moveItem, useDragSort } from "./useDragSort";

/** Route wrapper: a new editor instance per plan id (e.g. after "copy" navigates to the copy). */
export function PlanEditor() {
  const id = useSearchParams().get("id");
  return <PlanEditorInner key={id ?? "new"} id={id} />;
}

interface Loaded {
  name: string;
  rows: EditorRow[];
  archived: boolean;
  rest: RestSettings;
  /** The plan record already has a type and rest settings (it was switched from «Силовая» once). */
  hadRest: boolean;
  circuits: PlanCircuit[];
}

const NEW_PLAN: Loaded = { name: "", rows: [], archived: false, rest: restSettings(null), hadRest: false, circuits: [] };

function rowsFromPlan(full: PlanFull): EditorRow[] {
  return full.items.map((i) => {
    const sets = i.sets.map(({ id, weight, reps, duration_sec, speed_kmh }) => ({ id, weight, reps, duration_sec, speed_kmh }));
    return {
      key: i.planExercise.id,
      id: i.planExercise.id,
      exercise: i.exercise,
      note: i.planExercise.note,
      sets,
      text: toQuickInput(i.exercise.log_type, sets),
      error: null,
      rest: ownRest(i.planExercise),
      circuit_id: i.planExercise.circuit_id ?? null,
    };
  });
}

/** Sets of a circuit member follow the rounds: set i is round i. A row without sets yet is left to the save check. */
function alignRow(row: EditorRow, rounds: number): EditorRow {
  if (!row.sets.length || row.sets.length === rounds) return row;
  const sets = alignSets(row.sets, rounds, emptySet);
  return { ...row, sets, text: toQuickInput(row.exercise.log_type, sets), error: null };
}

function snapshot(name: string, rows: EditorRow[], rest: RestSettings, circuits: PlanCircuit[]) {
  return JSON.stringify([name.trim(), rest, circuits, rows.map((r) => [r.exercise.id, r.note, r.sets, r.text, r.rest, r.circuit_id])]);
}

function PlanEditorInner({ id }: { id: string | null }) {
  const [loaded, setLoaded] = useState<Loaded | null | "missing">(id ? null : NEW_PLAN);

  useEffect(() => {
    if (!id) return;
    plansRepo.getFull(id).then((full) =>
      setLoaded(
        full
          ? {
              name: full.plan.name,
              rows: rowsFromPlan(full),
              archived: !!full.plan.archived_at,
              rest: restSettings(full.plan),
              hadRest: hasRestSettings(full.plan),
              circuits: cleanCircuits(full.plan.circuits),
            }
          : "missing",
      ),
    );
  }, [id]);

  if (loaded === "missing") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-[15px]">План не найден.</p>
        <Link href="/" className="underline">
          На главную
        </Link>
      </div>
    );
  }
  if (!loaded) return null;
  return <EditorForm id={id} initial={loaded} />;
}

type Picker = { kind: "add" } | { kind: "replace"; index: number } | null;
type RestEdit =
  | { kind: "set" }
  | { kind: "exercise" }
  | { kind: "row"; index: number }
  | { kind: "inside"; circuit: Id }
  | { kind: "round"; circuit: Id }
  | null;

function EditorForm({ id, initial }: { id: string | null; initial: Loaded }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [rows, setRows] = useState<EditorRow[]>(initial.rows);
  const [rest, setRest] = useState<RestSettings>(initial.rest);
  const [circuits, setCircuits] = useState<PlanCircuit[]>(initial.circuits);
  const [restEdit, setRestEdit] = useState<RestEdit>(null);
  const [saved, setSaved] = useState(() => snapshot(initial.name, initial.rows, initial.rest, initial.circuits));
  const [picker, setPicker] = useState<Picker>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [setEdit, setSetEdit] = useState<{ row: number; set: number } | null>(null);
  const [confirm, setConfirm] = useState<"leave" | "archive" | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = snapshot(name, rows, rest, circuits) !== saved;
  const withRest = usesRest(rest.format);
  // A plan that never left «Силовая» is saved without rest fields, exactly as before stage 34.
  const keepsRest =
    initial.hadRest ||
    JSON.stringify(rest) !== JSON.stringify(initial.rest) ||
    rows.some((r) => r.rest !== null || r.circuit_id !== null) ||
    circuits.length > 0;
  // A moved exercise that left its group's neighbours leaves the group (stage 36).
  const onMove = useCallback((from: number, to: number) => setRows((r) => tidyGroups(moveItem(r, from, to))), []);

  // Circuits (stage 36): «Круговая» — the whole plan; «С отдыхом» — groups of neighbours.
  const whole = wholeCircuit(circuits, rows.map((r) => r.sets.length));
  const groupOf = (row: EditorRow) => circuitIdFor(rest.format, row.circuit_id, circuits);
  const circuitById = (cid: Id) => (cid === WHOLE_CIRCUIT_ID ? whole : circuits.find((c) => c.id === cid)) ?? whole;
  const inCircuit = (row: EditorRow, cid: Id) => (cid === WHOLE_CIRCUIT_ID ? true : row.circuit_id === cid);

  function setCircuit(cid: Id, patch: Partial<PlanCircuit>) {
    setCircuits((list) =>
      list.some((c) => c.id === cid) ? list.map((c) => (c.id === cid ? { ...c, ...patch } : c)) : [...list, { ...circuitById(cid), ...patch, id: cid }],
    );
  }

  function changeRounds(cid: Id, rounds: number) {
    const n = clampRounds(rounds);
    setCircuit(cid, { rounds: n });
    setRows((list) => list.map((r) => (inCircuit(r, cid) ? alignRow(r, n) : r)));
  }

  function pickFormat(format: RestSettings["format"]) {
    setRest((r) => ({ ...r, format }));
    // «Круговая»: sets follow the rounds on save — just looking at the type changes nothing.
    if (format === "circuit" && !circuits.some((c) => c.id === WHOLE_CIRCUIT_ID)) setCircuits((list) => [...list, whole]);
  }

  /** «Объединить в круг со следующим»: joins the next exercise's group or makes a new one; sets follow the rounds. */
  function joinNext(index: number) {
    const a = rows[index];
    const b = rows[index + 1];
    if (!b) return;
    const cid = a.circuit_id ?? b.circuit_id ?? uuid();
    const existing = circuits.find((c) => c.id === cid);
    const circuit = existing ?? newCircuit(cid, a.sets.length || b.sets.length || undefined);
    const merged = b.circuit_id && a.circuit_id && b.circuit_id !== a.circuit_id ? b.circuit_id : null;
    setCircuits((list) => [...list.filter((c) => c.id !== merged && c.id !== cid), circuit]);
    setRows((list) =>
      list.map((r, i) =>
        i === index || i === index + 1 || (merged && r.circuit_id === merged) || r.circuit_id === cid
          ? alignRow({ ...r, circuit_id: cid }, circuit.rounds)
          : r,
      ),
    );
  }

  function leaveCircuit(index: number) {
    setRows((list) => tidyGroups(list.map((r, i) => (i === index ? { ...r, circuit_id: null } : r))));
  }
  const drag = useDragSort(onMove);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const updateRow = (index: number, fn: (row: EditorRow) => EditorRow) => {
    setFormError(null);
    setRows((list) => list.map((r, i) => (i === index ? fn(r) : r)));
  };

  function onText(index: number, text: string) {
    updateRow(index, (row) => {
      const parsed = parseQuickInput(text, row.exercise.log_type);
      if (!parsed.ok) return { ...row, text, error: parsed.error };
      // Keep ids of sets by position so the plan keeps its history links.
      const sets = parsed.sets.map((s, i) => ({ ...s, id: row.sets[i]?.id }));
      return { ...row, text, sets, error: null };
    });
  }

  function setSets(index: number, sets: EditorRow["sets"]) {
    updateRow(index, (row) => ({ ...row, sets, text: toQuickInput(row.exercise.log_type, sets), error: null }));
  }

  function addExercise(exercise: Exercise) {
    const key = uuid();
    setFormError(null);
    setRows((list) => [...list, { key, exercise, note: null, sets: [], text: "", error: null, rest: null, circuit_id: null }]);
    setFocusKey(key);
    setPicker(null);
  }

  function replaceExercise(index: number, exercise: Exercise) {
    updateRow(index, (row) =>
      row.exercise.log_type === exercise.log_type
        ? { ...row, exercise }
        : { ...row, exercise, sets: [], text: "", error: null },
    );
    setPicker(null);
  }

  async function save() {
    setFormError(null);
    if (!name.trim()) return setFormError("Введите название плана");
    if (rows.length === 0) return setFormError("Добавьте хотя бы одно упражнение");
    const empty = rows.map((r, i) => (r.sets.length === 0 && !r.error ? i : -1)).filter((i) => i >= 0);
    if (empty.length) {
      setRows((list) =>
        list.map((r, i) => (empty.includes(i) ? { ...r, error: `Добавьте подходы — пример: ${QUICK_INPUT_EXAMPLES[r.exercise.log_type]}` } : r)),
      );
    }
    const broken = rows.map((r, i) => (r.error || r.sets.length === 0 ? i + 1 : 0)).filter(Boolean);
    if (broken.length) return setFormError(`Проверьте подходы в упражнениях: ${broken.join(", ")}`);

    setBusy(true);
    try {
      // Circuit members get exactly as many sets as rounds; the saved plan matches the screen.
      const ready = tidyGroups(rows).map((r) => {
        const cid = groupOf(r);
        return cid ? alignRow(r, circuitById(cid).rounds) : r;
      });
      const savedCircuits = rest.format === "circuit" && !circuits.some((c) => c.id === WHOLE_CIRCUIT_ID) ? [...circuits, whole] : circuits;
      await plansRepo.save({
        id: id ?? undefined,
        name,
        items: ready.map((r) => ({ id: r.id, exercise_id: r.exercise.id, note: r.note, sets: r.sets, rest_set_sec: r.rest, circuit_id: r.circuit_id })),
        rest: keepsRest ? rest : undefined,
        circuits: keepsRest ? savedCircuits : undefined,
      });
      setRows(ready);
      setCircuits(savedCircuits);
      setSaved(snapshot(name, ready, rest, savedCircuits));
      // Back where it was opened from: the home screen or the workout before "Начать".
      router.back();
    } catch (err) {
      setFormError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
      if (!(err instanceof DomainError)) console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!id) return;
    const copyId = await plansRepo.copy(id);
    router.replace(`/plans/edit/?id=${copyId}`);
  }

  async function archive() {
    if (!id) return;
    await plansRepo.archive(id);
    router.push("/");
  }

  function back() {
    if (dirty) setConfirm("leave");
    else router.back();
  }

  // Neighbours of one group («С отдыхом») are drawn together in a frame.
  const blocks: { cid: Id | null; indices: number[] }[] = [];
  rows.forEach((row, i) => {
    const cid = rest.format === "rest" ? groupOf(row) : null;
    const last = blocks.at(-1);
    if (cid && last?.cid === cid) last.indices.push(i);
    else blocks.push({ cid, indices: [i] });
  });

  const renderCard = (i: number) => {
    const row = rows[i];
    return (
      <PlanItemCard
        key={row.key}
        ref={drag.itemRef(i)}
        row={row}
        index={i}
        compact={drag.dragging}
        lifted={drag.draggingIndex === i}
        handleProps={drag.handleProps(i)}
        style={drag.itemStyle(i)}
        autoFocus={row.key === focusKey}
        onText={(text) => onText(i, text)}
        onEditSet={(s) => setSetEdit({ row: i, set: s })}
        onAddSet={() => {
          if (row.sets.length >= MAX_SETS) return;
          const last = row.sets.at(-1);
          setSets(i, [...row.sets, last ? { ...last, id: undefined } : emptySet()]);
          if (!last) setSetEdit({ row: i, set: 0 });
        }}
        onMenu={() => setMenu(i)}
        rest={withRest && !groupOf(row) && row.sets.length > 1 ? { value: setRestFor(rest, row.rest), own: row.rest !== null } : undefined}
        onRest={() => setRestEdit({ kind: "row", index: i })}
      />
    );
  };

  function restSheetProps(edit: NonNullable<RestEdit>): { title: string; subject: string; value: number; planValue?: number } {
    const plan = "Весь план. У упражнения можно задать своё значение.";
    switch (edit.kind) {
      case "set":
        return { title: "Между подходами", subject: plan, value: rest.rest_set_sec };
      case "exercise":
        return { title: "Между упражнениями", subject: plan, value: rest.rest_exercise_sec };
      case "inside":
        return { title: "В круге", subject: "Между упражнениями одного круга.", value: circuitById(edit.circuit).rest_inside_sec };
      case "round":
        return { title: "Между кругами", subject: "После последнего упражнения круга.", value: circuitById(edit.circuit).rest_round_sec };
      case "row":
        return { title: "Между подходами", subject: rows[edit.index].exercise.name, value: setRestFor(rest, rows[edit.index].rest), planValue: rest.rest_set_sec };
    }
  }

  const menuRow = menu !== null ? rows[menu] : null;
  const editRow = setEdit ? rows[setEdit.row] : null;
  const editSet: SetValues | null = setEdit && editRow ? editRow.sets[setEdit.set] : null;

  return (
    <div className="flex flex-1 flex-col pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 bg-bg px-4 pt-5 pb-3">
        <button
          type="button"
          onClick={back}
          aria-label="Назад"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="flex-1 font-display text-[15px] font-bold tracking-[0.02em] uppercase">{id ? "План" : "Новый план"}</h1>
        <Button variant="primary" size="md" onClick={save} disabled={busy}>
          Сохранить
        </Button>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          Название
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Ноги А"
            autoFocus={!id}
            enterKeyHint="done"
            className={`${inputClass} h-13 bg-surface font-display text-[17px] font-bold`}
          />
        </label>
        {initial.archived && <p className="text-[13px] text-ink-muted">План в архиве. Вернуть можно в «Ещё → Архив».</p>}

        <div className="flex flex-col gap-1.5">
          <span id="plan-format" className="text-xs text-ink-muted">
            Тип тренировки
          </span>
          <div role="radiogroup" aria-labelledby="plan-format" className="grid grid-cols-3 gap-1 rounded-[13px] bg-surface-done p-[3px]">
            {EDITOR_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={rest.format === f}
                onClick={() => pickFormat(f)}
                className={`h-11 rounded-[10px] text-sm font-semibold transition-colors ${
                  rest.format === f ? "bg-surface-raised text-ink" : "text-ink-muted"
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {!withRest && keepsRest && (
          <p className="rounded-[14px] border-[1.5px] border-dashed border-line-strong px-3.5 py-3 text-[13px] leading-snug text-ink-muted">
            В силовой таймеров нет. Настройки отдыха и круги сохранены — вернутся, если снова выбрать «С отдыхом» или «Круговая».
          </p>
        )}

        {withRest && (
          <section aria-labelledby="rest-h" className="rounded-[18px] border-[1.5px] border-line bg-surface px-3.5 pt-3 pb-1">
            <h2 id="rest-h" className="font-display text-xs font-bold tracking-[0.04em] uppercase">
              Отдых
            </h2>
            {rest.format === "circuit" ? (
              <>
                <RoundsRow rounds={whole.rounds} onChange={(n) => changeRounds(WHOLE_CIRCUIT_ID, n)} />
                <RestRow label="В круге" value={whole.rest_inside_sec} onClick={() => setRestEdit({ kind: "inside", circuit: WHOLE_CIRCUIT_ID })} border />
                <RestRow label="Между кругами" value={whole.rest_round_sec} onClick={() => setRestEdit({ kind: "round", circuit: WHOLE_CIRCUIT_ID })} border />
              </>
            ) : (
              <>
                <RestRow label="Между подходами" value={rest.rest_set_sec} onClick={() => setRestEdit({ kind: "set" })} />
                <RestRow label="Между упражнениями" value={rest.rest_exercise_sec} onClick={() => setRestEdit({ kind: "exercise" })} border />
              </>
            )}
          </section>
        )}
        {rest.format === "circuit" && (
          <p className="text-[13px] leading-snug text-ink-muted">
            Все упражнения — один круг, подход = круг.
            {rows.some((r) => r.sets.length > 0 && r.sets.length !== whole.rounds) &&
              ` При сохранении у каждого упражнения станет ${whole.rounds} ${plural(whole.rounds, ["подход", "подхода", "подходов"])}.`}
          </p>
        )}

        <div className="flex items-baseline justify-between pt-1.5">
          <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Упражнения</h2>
          <span className="font-mono text-[13px] text-ink-muted">{rows.length}</span>
        </div>

        <div className="flex flex-col gap-3">
          {blocks.map((b) => {
            if (!b.cid) return renderCard(b.indices[0]);
            const cid = b.cid;
            const c = circuitById(cid);
            return (
              <section key={`circuit-${cid}`} aria-label={`Круг × ${c.rounds}`} className="flex flex-col gap-2.5 rounded-[22px] border-[1.5px] border-ink p-2">
                <CircuitHeader
                  circuit={c}
                  onRounds={(n) => changeRounds(cid, n)}
                  onInside={() => setRestEdit({ kind: "inside", circuit: cid })}
                  onRound={() => setRestEdit({ kind: "round", circuit: cid })}
                />
                {b.indices.map((i) => renderCard(i))}
              </section>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPicker({ kind: "add" })}
          className="flex min-h-14 items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-ink bg-surface px-4 text-left text-[15px] font-semibold"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Добавить упражнение
        </button>

        <FormError message={formError} />

        {id && (
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Button variant="outline" onClick={copy} disabled={dirty}>
              Копировать план
            </Button>
            <Button variant="quiet" onClick={() => setConfirm("archive")} disabled={initial.archived}>
              В архив
            </Button>
          </div>
        )}
        {id && dirty && <p className="text-[13px] text-ink-muted">Чтобы сделать копию, сначала сохраните изменения.</p>}
      </div>

      <ExercisePicker
        open={picker !== null}
        title={picker?.kind === "replace" ? "Заменить упражнение" : "Добавить упражнение"}
        pickLabel={picker?.kind === "replace" ? "Заменить на это" : "Добавить в план"}
        disabledIds={picker?.kind === "replace" ? [rows[picker.index]?.exercise.id] : undefined}
        onClose={() => setPicker(null)}
        onPick={(e) => (picker?.kind === "replace" ? replaceExercise(picker.index, e) : addExercise(e))}
      />

      {editRow && editSet && setEdit && (
        <SetEditorSheet
          open
          title={`${editRow.exercise.name} · подход ${setEdit.set + 1}`}
          logType={editRow.exercise.log_type}
          value={editSet}
          canDelete
          onClose={() => setSetEdit(null)}
          onSave={(v) => {
            setSets(setEdit.row, editRow.sets.map((s, j) => (j === setEdit.set ? { ...v, id: s.id } : s)));
            setSetEdit(null);
          }}
          onDelete={() => {
            setSets(setEdit.row, editRow.sets.filter((_, j) => j !== setEdit.set));
            setSetEdit(null);
          }}
        />
      )}

      {restEdit && (restEdit.kind !== "row" || rows[restEdit.index]) && (
        <RestSheet
          open
          key={JSON.stringify(restEdit)}
          {...restSheetProps(restEdit)}
          onClose={() => setRestEdit(null)}
          onSave={(v) => {
            if (restEdit.kind === "set") setRest((r) => ({ ...r, rest_set_sec: v ?? r.rest_set_sec }));
            else if (restEdit.kind === "exercise") setRest((r) => ({ ...r, rest_exercise_sec: v ?? r.rest_exercise_sec }));
            else if (restEdit.kind === "inside") setCircuit(restEdit.circuit, { rest_inside_sec: v ?? 0 });
            else if (restEdit.kind === "round") setCircuit(restEdit.circuit, { rest_round_sec: v ?? 0 });
            else updateRow(restEdit.index, (r) => ({ ...r, rest: v === null || v === rest.rest_set_sec ? null : v }));
            setRestEdit(null);
          }}
        />
      )}

      <Sheet open={menuRow !== null} onClose={() => setMenu(null)} title={menuRow?.exercise.name ?? ""}>
        {menuRow && menu !== null && (
          <ItemMenu
            key={menuRow.key}
            row={menuRow}
            isFirst={menu === 0}
            isLast={menu === rows.length - 1}
            inCircuit={rest.format === "rest" && !!groupOf(menuRow)}
            canJoin={
              rest.format === "rest" && menu < rows.length - 1 && (!groupOf(menuRow) || groupOf(rows[menu + 1]) !== groupOf(menuRow))
            }
            onJoin={() => {
              joinNext(menu);
              setMenu(null);
            }}
            onLeave={() => {
              leaveCircuit(menu);
              setMenu(null);
            }}
            onNote={(note) => updateRow(menu, (r) => ({ ...r, note }))}
            onMove={(dir) => {
              setRows((list) => moveItem(list, menu, menu + dir));
              setMenu(menu + dir);
            }}
            onReplace={() => {
              setMenu(null);
              setPicker({ kind: "replace", index: menu });
            }}
            onRemove={() => {
              setRows((list) => tidyGroups(list.filter((_, i) => i !== menu)));
              setMenu(null);
            }}
            onDone={() => setMenu(null)}
          />
        )}
      </Sheet>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "archive" ? "Убрать план в архив?" : "Выйти без сохранения?"}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {confirm === "archive" ? "Отмена" : "Остаться"}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const what = confirm;
                setConfirm(null);
                if (what === "archive") archive();
                else router.back();
              }}
            >
              {confirm === "archive" ? "В архив" : "Выйти"}
            </Button>
          </div>
        }
      >
        <p className="text-[15px]">
          {confirm === "archive"
            ? "План пропадёт с главной. Тренировки по нему останутся в истории, вернуть план можно в «Ещё → Архив»."
            : "Изменения в плане не сохранятся."}
        </p>
      </Sheet>
    </div>
  );
}

function RestRow({ label, value, onClick, border }: { label: string; value: number; onClick: () => void; border?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Отдых ${label.toLowerCase()}: ${formatRest(value)}. Изменить`}
      className={`flex min-h-12 w-full items-center gap-2.5 text-left ${border ? "border-t-[1.5px] border-line" : ""}`}
    >
      <span className="flex-1 text-[15px]">{label}</span>
      <span className="font-mono text-[17px] font-bold">{formatRest(value)}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** «Кругов: 3» with −/+ (stage 36). */
function RoundsRow({ rounds, onChange }: { rounds: number; onChange: (n: number) => void }) {
  return (
    <div className="flex min-h-12 items-center gap-2.5">
      <span className="flex-1 text-[15px]">Кругов</span>
      <Stepper value={rounds} onChange={onChange} label="кругов" />
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex h-11 items-center rounded-xl border-[1.5px] border-line bg-surface-raised">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Меньше ${label}`} className="h-full w-11 text-xl font-semibold disabled:opacity-40">
        −
      </button>
      <span aria-live="polite" className="min-w-8 text-center font-mono text-[17px] font-bold">
        {value}
      </span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_ROUNDS} aria-label={`Больше ${label}`} className="h-full w-11 text-xl font-semibold disabled:opacity-40">
        +
      </button>
    </div>
  );
}

/** The header of a group in a «С отдыхом» plan (mockup О2): «Круг × 3», rounds −/+, rest inside and between rounds. */
function CircuitHeader({ circuit, onRounds, onInside, onRound }: { circuit: PlanCircuit; onRounds: (n: number) => void; onInside: () => void; onRound: () => void }) {
  const chip = "flex min-h-11 items-center gap-1.5 rounded-[10px] bg-surface px-2.5 text-[13px]";
  return (
    <div className="flex flex-col gap-2 px-1 pt-1">
      <div className="flex items-center gap-2">
        <span className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-inverse px-2.5 font-display text-[11px] font-bold tracking-[0.04em] text-on-inverse uppercase">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.3-5.6" />
            <path d="M20 4v4.5h-4.5" />
          </svg>
          Круг × {circuit.rounds}
        </span>
        <span className="flex-1" />
        <Stepper value={circuit.rounds} onChange={onRounds} label="кругов" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onInside} aria-label={`Отдых в круге: ${formatRest(circuit.rest_inside_sec)}. Изменить`} className={chip}>
          <span className="flex-1 text-left text-ink-muted">в круге</span>
          <span className="font-mono font-bold">{formatRest(circuit.rest_inside_sec)}</span>
        </button>
        <button type="button" onClick={onRound} aria-label={`Отдых между кругами: ${formatRest(circuit.rest_round_sec)}. Изменить`} className={chip}>
          <span className="flex-1 text-left text-ink-muted">между кругами</span>
          <span className="font-mono font-bold">{formatRest(circuit.rest_round_sec)}</span>
        </button>
      </div>
    </div>
  );
}

interface ItemMenuProps {
  row: EditorRow;
  isFirst: boolean;
  isLast: boolean;
  /** «С отдыхом» only: «Убрать из круга». */
  inCircuit: boolean;
  /** «С отдыхом» only, the next exercise is not in the same circuit: «Объединить в круг со следующим». */
  canJoin: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onNote: (note: string | null) => void;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
  onDone: () => void;
}

function ItemMenu({ row, isFirst, isLast, inCircuit, canJoin, onJoin, onLeave, onNote, onMove, onReplace, onRemove, onDone }: ItemMenuProps) {
  const [note, setNote] = useState(row.note ?? "");
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onNote(note.trim() || null);
          onDone();
        }}
      >
        <div className="flex-1">
          <Field label="Заметка к упражнению" value={note} onChange={(e) => setNote(e.target.value)} placeholder="узкий хват, резинкой…" enterKeyHint="done" />
        </div>
        <Button type="submit" variant="primary" size="lg">
          OK
        </Button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={isFirst} onClick={() => onMove(-1)}>
          ↑ Выше
        </Button>
        <Button variant="outline" disabled={isLast} onClick={() => onMove(1)}>
          ↓ Ниже
        </Button>
      </div>
      {canJoin && (
        <Button variant="outline" onClick={onJoin}>
          Объединить в круг со следующим
        </Button>
      )}
      {inCircuit && (
        <Button variant="outline" onClick={onLeave}>
          Убрать из круга
        </Button>
      )}
      <Button variant="outline" onClick={onReplace}>
        Заменить упражнение
      </Button>
      <Button variant="quiet" onClick={onRemove}>
        Убрать из плана
      </Button>
    </div>
  );
}
