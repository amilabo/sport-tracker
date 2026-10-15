import type { Equipment, LogType, MeasurementComputed, MuscleGroup, SetValues } from "@/domain/types";

export interface SeedExercise {
  key: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  log_type: LogType;
}

const ex = (key: string, name: string, muscle_group: MuscleGroup, equipment: Equipment, log_type: LogType): SeedExercise => ({
  key, name, muscle_group, equipment, log_type,
});

// Exercises of the two starter programs plus common basics. PRD §3.1, §10.2.
export const SEED_EXERCISES: SeedExercise[] = [
  // Program "legs / chest / arms"
  ex("treadmill_walk", "Ходьба на дорожке", "cardio", "cardio_machine", "cardio"),
  ex("push_ups", "Отжимания от пола", "chest", "bodyweight", "reps"),
  ex("pec_deck", "Сведение рук в тренажёре (Пек-дек)", "chest", "machine", "weight_reps"),
  ex("cable_curl_reverse", "Сгибание рук на нижнем блоке (обратный хват)", "arms", "cable", "weight_reps"),
  ex("cable_triceps_extension", "Разгибание рук на верхнем блоке", "arms", "cable", "weight_reps"),
  ex("seated_lateral_raise", "Разведение гантелей через стороны сидя (махи в стороны)", "shoulders", "dumbbells", "weight_reps"),
  ex("lying_leg_curl", "Сгибание ног лёжа", "legs", "machine", "weight_reps"),
  ex("seated_hip_adduction", "Приведение ног в тренажёре сидя", "legs", "machine", "weight_reps"),
  ex("romanian_deadlift", "Румынская становая тяга", "legs", "barbell", "weight_reps"),
  ex("forearm_plank", "Планка на предплечьях", "abs", "bodyweight", "time"),
  ex("froggy", "Фрогги", "glutes", "bodyweight", "reps"),
  // Program "glutes / back"
  ex("band_pull_ups", "Подтягивания с резинкой", "back", "band", "reps"),
  ex("superman_scapula", "Лодочка со сведением лопаток", "back", "bodyweight", "reps"),
  ex("seated_cable_row", "Тяга нижнего блока", "back", "cable", "weight_reps"),
  ex("cable_pullover", "Пуловер в кроссовере с верхнего блока", "back", "cable", "weight_reps"),
  ex("seated_hip_abduction", "Отведение ног сидя в тренажёре", "glutes", "machine", "weight_reps"),
  ex("single_leg_balance_hinge", "Наклон корпуса на балансе", "glutes", "bodyweight", "reps"),
  ex("dumbbell_lunges", "Выпады с гантелями", "legs", "dumbbells", "weight_reps"),
  // Basics
  ex("bench_press", "Жим лёжа", "chest", "barbell", "weight_reps"),
  ex("dumbbell_bench_press", "Жим гантелей лёжа", "chest", "dumbbells", "weight_reps"),
  ex("knee_push_ups", "Отжимания с колен", "chest", "bodyweight", "reps"),
  ex("dips", "Отжимания на брусьях", "arms", "bodyweight", "bodyweight_plus"),
  ex("pull_ups", "Подтягивания", "back", "bodyweight", "bodyweight_plus"),
  ex("assisted_pull_ups", "Гравитрон", "back", "machine", "bodyweight_plus"),
  ex("lat_pulldown", "Тяга верхнего блока", "back", "cable", "weight_reps"),
  ex("dumbbell_row", "Тяга гантели в наклоне", "back", "dumbbells", "weight_reps"),
  ex("deadlift", "Становая тяга", "back", "barbell", "weight_reps"),
  ex("back_extension", "Гиперэкстензия", "back", "bodyweight", "reps"),
  ex("barbell_squat", "Приседания со штангой", "legs", "barbell", "weight_reps"),
  ex("goblet_squat", "Гоблет-приседания", "legs", "dumbbells", "weight_reps"),
  ex("leg_press", "Жим ногами", "legs", "machine", "weight_reps"),
  ex("leg_extension", "Разгибание ног сидя", "legs", "machine", "weight_reps"),
  ex("hip_thrust", "Ягодичный мост со штангой", "glutes", "barbell", "weight_reps"),
  ex("glute_bridge", "Ягодичный мост", "glutes", "bodyweight", "reps"),
  ex("cable_kickback", "Отведение ноги назад в кроссовере", "glutes", "cable", "weight_reps"),
  ex("dumbbell_shoulder_press", "Жим гантелей сидя", "shoulders", "dumbbells", "weight_reps"),
  ex("barbell_curl", "Подъём штанги на бицепс", "arms", "barbell", "weight_reps"),
  ex("dumbbell_curl", "Сгибание рук с гантелями", "arms", "dumbbells", "weight_reps"),
  ex("french_press", "Французский жим", "arms", "barbell", "weight_reps"),
  ex("crunches", "Скручивания", "abs", "bodyweight", "reps"),
  ex("hanging_leg_raise", "Подъём ног в висе", "abs", "bodyweight", "reps"),
  ex("side_plank", "Боковая планка", "abs", "bodyweight", "time"),
  ex("exercise_bike", "Велотренажёр", "cardio", "cardio_machine", "cardio"),
  ex("elliptical", "Эллипс", "cardio", "cardio_machine", "cardio"),
];

type V = Partial<SetValues>;
export interface SeedPlanItem {
  exercise: string;
  sets: V[];
  note?: string;
}
export interface SeedPlan {
  key: string;
  name: string;
  items: SeedPlanItem[];
}

const times = (n: number, v: V): V[] => Array.from({ length: n }, () => ({ ...v }));

// Starter plans (PRD §3.12).
export const SEED_PLANS: SeedPlan[] = [
  {
    key: "plan_legs_chest_arms",
    name: "Ноги / грудь / руки",
    items: [
      { exercise: "treadmill_walk", sets: [{ duration_sec: 15 * 60, speed_kmh: 10 }] },
      { exercise: "push_ups", sets: times(4, { reps: 12 }) },
      { exercise: "pec_deck", sets: times(3, { reps: 15, weight: 15 }) },
      { exercise: "cable_curl_reverse", sets: times(4, { reps: 10, weight: 15 }) },
      { exercise: "cable_triceps_extension", sets: times(3, { reps: 12, weight: 10 }) },
      { exercise: "seated_lateral_raise", sets: times(4, { reps: 12, weight: 3 }) },
      { exercise: "lying_leg_curl", sets: times(4, { reps: 12, weight: 20 }) },
      { exercise: "seated_hip_adduction", sets: times(3, { reps: 16, weight: 25 }) },
      { exercise: "romanian_deadlift", sets: times(4, { reps: 12, weight: 20 }) },
      { exercise: "forearm_plank", sets: times(3, { duration_sec: 30 }) },
    ],
  },
  {
    key: "plan_glutes_back",
    name: "Ягодицы / спина",
    items: [
      { exercise: "treadmill_walk", sets: [{ duration_sec: 15 * 60, speed_kmh: 10 }] },
      { exercise: "band_pull_ups", sets: times(5, { reps: 12 }) },
      { exercise: "superman_scapula", sets: times(4, { reps: 20 }) },
      { exercise: "seated_cable_row", sets: times(3, { reps: 12, weight: 10 }) },
      { exercise: "cable_pullover", sets: times(3, { reps: 12, weight: 20 }) },
      { exercise: "seated_hip_abduction", sets: times(4, { reps: 15, weight: 47 }) },
      { exercise: "single_leg_balance_hinge", sets: times(4, { reps: 20 }), note: "на каждую ногу по 10 раз" },
      // The program gives no weight for lunges: the weight stays empty until the first workout.
      { exercise: "dumbbell_lunges", sets: times(4, { reps: 20 }) },
    ],
  },
];

export interface SeedMeasurementType {
  key: string;
  name: string;
  unit: string;
  computed: MeasurementComputed | null;
  base?: string;
}

// The "Body" screen set (PRD §3.10) + chest, belly, thigh. Order = position.
export const SEED_MEASUREMENT_TYPES: SeedMeasurementType[] = [
  { key: "weight", name: "Вес", unit: "кг", computed: null },
  { key: "bmi", name: "ИМТ", unit: "", computed: "bmi" },
  { key: "fat_kg", name: "Жир", unit: "кг", computed: null },
  { key: "fat_pct", name: "Жир", unit: "%", computed: "percent_of_weight", base: "fat_kg" },
  { key: "muscle_kg", name: "Мышцы", unit: "кг", computed: null },
  { key: "muscle_pct", name: "Мышцы", unit: "%", computed: "percent_of_weight", base: "muscle_kg" },
  { key: "waist", name: "Талия", unit: "см", computed: null },
  { key: "hips", name: "Бёдра", unit: "см", computed: null },
  { key: "chest", name: "Грудь", unit: "см", computed: null },
  { key: "belly", name: "Живот", unit: "см", computed: null },
  { key: "thigh", name: "Бедро", unit: "см", computed: null },
];
