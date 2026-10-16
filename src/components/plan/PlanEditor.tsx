"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { Button } from "@/components/ui/Button";
import { Field, FormError, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { plansRepo, type PlanFull } from "@/db/repos/plans";
import { uuid } from "@/domain/ids";
import { parseQuickInput, QUICK_INPUT_EXAMPLES } from "@/domain/quick-input";
import { emptySet, MAX_SETS, toQuickInput } from "@/domain/sets";
import { DomainError, type Exercise, type SetValues } from "@/domain/types";
import { PlanItemCard, type EditorRow } from "./PlanItemCard";
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
}

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
    };
  });
}

function snapshot(name: string, rows: EditorRow[]) {
  return JSON.stringify([name.trim(), rows.map((r) => [r.exercise.id, r.note, r.sets, r.text])]);
}

function PlanEditorInner({ id }: { id: string | null }) {
  const [loaded, setLoaded] = useState<Loaded | null | "missing">(id ? null : { name: "", rows: [], archived: false });

  useEffect(() => {
    if (!id) return;
    plansRepo.getFull(id).then((full) =>
      setLoaded(full ? { name: full.plan.name, rows: rowsFromPlan(full), archived: !!full.plan.archived_at } : "missing"),
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

function EditorForm({ id, initial }: { id: string | null; initial: Loaded }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [rows, setRows] = useState<EditorRow[]>(initial.rows);
  const [saved, setSaved] = useState(() => snapshot(initial.name, initial.rows));
  const [picker, setPicker] = useState<Picker>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [setEdit, setSetEdit] = useState<{ row: number; set: number } | null>(null);
  const [confirm, setConfirm] = useState<"leave" | "archive" | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = snapshot(name, rows) !== saved;
  const onMove = useCallback((from: number, to: number) => setRows((r) => moveItem(r, from, to)), []);
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
    setRows((list) => [...list, { key, exercise, note: null, sets: [], text: "", error: null }]);
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
      await plansRepo.save({
        id: id ?? undefined,
        name,
        items: rows.map((r) => ({ id: r.id, exercise_id: r.exercise.id, note: r.note, sets: r.sets })),
      });
      setSaved(snapshot(name, rows));
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

        <div className="flex items-baseline justify-between pt-1.5">
          <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Упражнения</h2>
          <span className="font-mono text-[13px] text-ink-muted">{rows.length}</span>
        </div>

        <div className="flex flex-col gap-3">
          {rows.map((row, i) => (
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
            />
          ))}
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

      <Sheet open={menuRow !== null} onClose={() => setMenu(null)} title={menuRow?.exercise.name ?? ""}>
        {menuRow && menu !== null && (
          <ItemMenu
            key={menuRow.key}
            row={menuRow}
            isFirst={menu === 0}
            isLast={menu === rows.length - 1}
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
              setRows((list) => list.filter((_, i) => i !== menu));
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

interface ItemMenuProps {
  row: EditorRow;
  isFirst: boolean;
  isLast: boolean;
  onNote: (note: string | null) => void;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
  onDone: () => void;
}

function ItemMenu({ row, isFirst, isLast, onNote, onMove, onReplace, onRemove, onDone }: ItemMenuProps) {
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
      <Button variant="outline" onClick={onReplace}>
        Заменить упражнение
      </Button>
      <Button variant="quiet" onClick={onRemove}>
        Убрать из плана
      </Button>
    </div>
  );
}
