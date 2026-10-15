import { newEntity, touch } from "@/domain/entity";
import { toLocalDate } from "@/domain/time";
import { cleanName, searchKey } from "@/domain/text";
import { DomainError, type Id, type LocalDate, type Measurement, type MeasurementType } from "@/domain/types";
import { getDb, withTx } from "../client";

export const measurementsRepo = {
  async listTypes({ includeArchived = false } = {}): Promise<MeasurementType[]> {
    const all = await (await getDb()).getAll("measurement_types");
    return all.filter((t) => includeArchived || !t.archived_at).sort((a, b) => a.position - b.position);
  },

  /** A user type: name and unit. Goes to the end of the list. */
  async createType(input: { name: string; unit: string }): Promise<MeasurementType> {
    const name = cleanName(input.name);
    const unit = cleanName(input.unit);
    if (!name) throw new DomainError("Введите название замера");
    return withTx(["measurement_types"], "readwrite", async (tx) => {
      const store = tx.objectStore("measurement_types");
      const all = await store.getAll();
      const key = searchKey(`${name} ${unit}`);
      if (all.some((t) => !t.archived_at && searchKey(`${t.name} ${t.unit}`) === key)) {
        throw new DomainError(`Замер «${name}» уже есть`);
      }
      const type: MeasurementType = newEntity({
        name,
        unit,
        key: null,
        is_builtin: false,
        archived_at: null,
        computed: null,
        base_type_id: null,
        position: Math.max(-1, ...all.map((t) => t.position)) + 1,
      });
      await store.put(type);
      return type;
    });
  },

  async list(): Promise<Measurement[]> {
    const all = await (await getDb()).getAllFromIndex("measurements", "date");
    return all.reverse();
  },

  /**
   * Saves one measurement session (a date): typed values are written, an emptied field removes its value.
   * Moving to another date moves the whole session. All in one transaction.
   */
  async saveSession(date: LocalDate, values: Map<Id, number | null>, previousDate?: LocalDate): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DomainError("Выберите дату замера");
    if (date > toLocalDate()) throw new DomainError("Дата замера в будущем — проверьте дату");
    if (![...values.values()].some((v) => v !== null)) throw new DomainError("Введите хотя бы одно значение");
    await withTx(["measurements"], "readwrite", async (tx) => {
      const store = tx.objectStore("measurements");
      const existing = await store.index("date").getAll(date);
      if (previousDate && previousDate !== date) {
        if (existing.length) throw new DomainError("На эту дату уже есть замер — выберите её в таблице, чтобы изменить");
        for (const old of await store.index("date").getAll(previousDate)) await store.delete(old.id);
      }
      for (const [typeId, value] of values) {
        const current = existing.find((m) => m.measurement_type_id === typeId);
        if (value === null) {
          if (current) await store.delete(current.id);
        } else if (!current) {
          await store.put(newEntity({ date, measurement_type_id: typeId, value }));
        } else if (current.value !== value) {
          await store.put(touch(current, { value }));
        }
      }
    });
  },

  async deleteSession(date: LocalDate): Promise<void> {
    await withTx(["measurements"], "readwrite", async (tx) => {
      const store = tx.objectStore("measurements");
      for (const m of await store.index("date").getAll(date)) await store.delete(m.id);
    });
  },

  /** Own types can be hidden; their values stay in the table history. Built-in types stay. */
  async setTypeArchived(id: Id, archived: boolean): Promise<void> {
    await withTx(["measurement_types"], "readwrite", async (tx) => {
      const t = await tx.objectStore("measurement_types").get(id);
      if (!t || t.is_builtin) return;
      await tx.objectStore("measurement_types").put(touch(t, { archived_at: archived ? new Date().toISOString() : null }));
    });
  },
};
