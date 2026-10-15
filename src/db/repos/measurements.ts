import { newEntity } from "@/domain/entity";
import { cleanName, searchKey } from "@/domain/text";
import { DomainError, type Measurement, type MeasurementType } from "@/domain/types";
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
};
