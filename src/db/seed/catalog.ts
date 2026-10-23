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
  ex("cable_triceps_extension", "Разгибание рук на верхнем блоке (канат или рукоять)", "arms", "cable", "weight_reps"),
  ex("seated_lateral_raise", "Разведение гантелей через стороны сидя (махи в стороны)", "shoulders", "dumbbells", "weight_reps"),  ex("lying_leg_curl", "Сгибание ног лёжа", "legs", "machine", "weight_reps"),
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
  ex("dumbbell_lunges", "Выпады с гантелями", "legs", "dumbbells_kettlebell", "weight_reps"),
  // Basics
  ex("bench_press", "Жим лёжа", "chest", "barbell", "weight_reps"),
  ex("dumbbell_bench_press", "Жим гантелей лёжа", "chest", "dumbbells", "weight_reps"),
  ex("knee_push_ups", "Отжимания с колен", "chest", "bodyweight", "reps"),
  ex("dips", "Отжимания на брусьях", "arms", "bodyweight", "bodyweight_plus"),
  ex("pull_ups", "Подтягивания", "back", "bodyweight", "bodyweight_plus"),
  ex("assisted_pull_ups", "Гравитрон", "back", "machine", "bodyweight_plus"),
  ex("lat_pulldown", "Тяга верхнего блока", "back", "cable", "weight_reps"),
  ex("dumbbell_row", "Тяга гантели в наклоне", "back", "dumbbells_kettlebell", "weight_reps"),
  ex("deadlift", "Становая тяга", "back", "barbell", "weight_reps"),
  ex("back_extension", "Гиперэкстензия", "back", "bodyweight", "bodyweight_plus"),
  ex("barbell_squat", "Приседания со штангой", "legs", "barbell", "weight_reps"),
  ex("goblet_squat", "Гоблет-приседания", "legs", "dumbbells_kettlebell", "weight_reps"),
  ex("leg_press", "Жим ногами", "legs", "machine", "weight_reps"),
  ex("leg_extension", "Разгибание ног сидя", "legs", "machine", "weight_reps"),
  ex("hip_thrust", "Ягодичный мост со штангой", "glutes", "barbell", "weight_reps"),
  ex("glute_bridge", "Ягодичный мост", "glutes", "bodyweight", "reps"),
  ex("cable_kickback", "Отведение ноги назад в кроссовере", "glutes", "cable", "weight_reps"),
  ex("dumbbell_shoulder_press", "Жим гантелей сидя", "shoulders", "dumbbells_kettlebell", "weight_reps"),
  ex("barbell_curl", "Подъём штанги на бицепс", "arms", "barbell", "weight_reps"),
  ex("dumbbell_curl", "Сгибание рук с гантелями", "arms", "dumbbells", "weight_reps"),
  ex("french_press", "Французский жим", "arms", "barbell", "weight_reps"),
  ex("crunches", "Скручивания", "abs", "bodyweight", "reps"),
  ex("hanging_leg_raise", "Подъём ног в висе", "abs", "bodyweight", "reps"),
  ex("side_plank", "Боковая планка", "abs", "bodyweight", "time"),
  ex("exercise_bike", "Велотренажёр", "cardio", "cardio_machine", "cardio"),
  ex("elliptical", "Эллипс", "cardio", "cardio_machine", "cardio"),

  // Stage 26 (docs/catalog-proposal.md). Names carry gym synonyms in brackets: search finds «махи вперёд».
  // Shoulders: presses, side raises (middle delt), front raises, rear delt.
  ex("barbell_overhead_press", "Жим штанги стоя (армейский жим)", "shoulders", "barbell", "weight_reps"),
  ex("machine_shoulder_press", "Жим в тренажёре на плечи", "shoulders", "machine", "weight_reps"),
  ex("arnold_press", "Жим Арнольда", "shoulders", "dumbbells", "weight_reps"),
  ex("standing_lateral_raise", "Махи гантелями в стороны стоя", "shoulders", "dumbbells", "weight_reps"),
  ex("cable_lateral_raise", "Махи в сторону на нижнем блоке одной рукой", "shoulders", "cable", "weight_reps"),
  ex("machine_lateral_raise", "Махи в стороны в тренажёре", "shoulders", "machine", "weight_reps"),
  ex("upright_row", "Тяга штанги к подбородку", "shoulders", "barbell", "weight_reps"),
  ex("dumbbell_front_raise", "Подъём гантелей перед собой (махи вперёд)", "shoulders", "dumbbells", "weight_reps"),
  ex("plate_front_raise", "Подъём блина перед собой", "shoulders", "other", "weight_reps"),
  ex("cable_front_raise", "Подъём руки перед собой на нижнем блоке", "shoulders", "cable", "weight_reps"),
  ex("bent_over_reverse_fly", "Разведение гантелей в наклоне (махи на заднюю дельту)", "shoulders", "dumbbells", "weight_reps"),
  ex("incline_reverse_fly", "Разведение гантелей лёжа на наклонной скамье (задняя дельта)", "shoulders", "dumbbells", "weight_reps"),
  ex("reverse_pec_deck", "Обратная бабочка (Пек-дек на заднюю дельту)", "shoulders", "machine", "weight_reps"),
  ex("cable_reverse_fly", "Разведение рук в кроссовере на заднюю дельту", "shoulders", "cable", "weight_reps"),
  ex("face_pull", "Тяга каната к лицу", "shoulders", "cable", "weight_reps"),
  ex("band_pull_apart", "Разведение резинки перед грудью", "shoulders", "band", "reps"),
  // Chest
  ex("incline_bench_press", "Жим штанги на наклонной скамье", "chest", "barbell", "weight_reps"),
  ex("incline_dumbbell_press", "Жим гантелей на наклонной скамье", "chest", "dumbbells", "weight_reps"),
  ex("machine_chest_press", "Жим в тренажёре сидя", "chest", "machine", "weight_reps"),
  ex("dumbbell_fly", "Разводка гантелей лёжа", "chest", "dumbbells", "weight_reps"),
  ex("cable_crossover", "Сведение рук в кроссовере", "chest", "cable", "weight_reps"),
  ex("dumbbell_pullover", "Пуловер с гантелью лёжа", "chest", "dumbbells", "weight_reps"),
  // Back
  ex("barbell_row", "Тяга штанги в наклоне", "back", "barbell", "weight_reps"),
  ex("t_bar_row", "Тяга Т-грифа", "back", "barbell", "weight_reps"),
  ex("hammer_row", "Рычажная тяга сидя (Хаммер)", "back", "machine", "weight_reps"),
  ex("close_grip_pulldown", "Тяга верхнего блока узким хватом", "back", "cable", "weight_reps"),
  ex("dumbbell_shrug", "Шраги с гантелями", "back", "dumbbells_kettlebell", "weight_reps"),
  // Legs
  ex("bulgarian_split_squat", "Болгарские сплит-приседания", "legs", "dumbbells_kettlebell", "weight_reps"),
  ex("step_up", "Зашагивания на платформу", "legs", "dumbbells_kettlebell", "weight_reps"),
  ex("smith_squat", "Приседания в Смите", "legs", "machine", "weight_reps"),
  ex("smith_lunge", "Выпады в Смите", "legs", "machine", "weight_reps"),
  ex("hack_squat", "Гакк-приседания", "legs", "machine", "weight_reps"),
  ex("seated_leg_curl", "Сгибание ног сидя", "legs", "machine", "weight_reps"),
  ex("reverse_lunge", "Выпады назад", "legs", "dumbbells_kettlebell", "weight_reps"),
  // Glutes
  ex("machine_hip_thrust", "Ягодичный мост в тренажёре", "glutes", "machine", "weight_reps"),
  ex("smith_hip_thrust", "Ягодичный мост в Смите", "glutes", "machine", "weight_reps"),
  ex("single_leg_glute_bridge", "Ягодичный мост на одной ноге", "glutes", "bodyweight", "reps"),
  ex("cable_hip_abduction", "Отведение ноги в сторону в кроссовере", "glutes", "cable", "weight_reps"),
  ex("reverse_hyperextension", "Обратная гиперэкстензия", "glutes", "machine", "reps"),
  ex("plie_squat", "Приседания плие", "glutes", "dumbbells_kettlebell", "weight_reps"),
  ex("kettlebell_swing", "Махи гирей", "glutes", "dumbbells_kettlebell", "weight_reps"),
  // Arms
  ex("cable_curl", "Сгибание рук на нижнем блоке", "arms", "cable", "weight_reps"),
  ex("hammer_curl", "Молотки с гантелями", "arms", "dumbbells", "weight_reps"),
  ex("preacher_curl", "Сгибание рук на скамье Скотта", "arms", "barbell", "weight_reps"),
  ex("concentration_curl", "Концентрированное сгибание", "arms", "dumbbells", "weight_reps"),
  ex("overhead_triceps_extension", "Разгибание руки с гантелью из-за головы", "arms", "dumbbells", "weight_reps"),
  ex("bench_dips", "Обратные отжимания от скамьи", "arms", "bodyweight", "reps"),
  // Abs
  ex("bicycle_crunch", "Велосипед", "abs", "bodyweight", "reps"),
  ex("reverse_crunch", "Обратные скручивания", "abs", "bodyweight", "reps"),
  ex("cable_crunch", "Скручивания на блоке («молитва»)", "abs", "cable", "weight_reps"),
  ex("dead_bug", "Мёртвый жук", "abs", "bodyweight", "reps"),
  ex("stomach_vacuum", "Вакуум", "abs", "bodyweight", "time"),
  // Cardio: a stepper, a rower and a rope have no km/h — time only.
  ex("treadmill_run", "Бег на дорожке", "cardio", "cardio_machine", "cardio"),
  ex("stair_stepper", "Степпер (лестница)", "cardio", "cardio_machine", "time"),
  ex("rowing_machine", "Гребной тренажёр", "cardio", "cardio_machine", "time"),
  ex("jump_rope", "Скакалка", "cardio", "other", "time"),
  // Full body
  ex("burpee", "Бёрпи", "full_body", "bodyweight", "reps"),
  ex("mountain_climber", "Скалолаз", "full_body", "bodyweight", "time"),
];

/**
 * Changes of starter exercises after the first release. A phone that already has the exercise gets the change
 * only while the field still holds the old value (the person has not edited it), and a log type only while the
 * exercise has no history — the same rule as for a person's own edit.
 */
export const CATALOG_CHANGES: { key: string; field: "name" | "equipment" | "log_type"; from: string; to: string }[] = [
  { key: "cable_triceps_extension", field: "name", from: "Разгибание рук на верхнем блоке", to: "Разгибание рук на верхнем блоке (канат или рукоять)" },
  { key: "back_extension", field: "log_type", from: "reps", to: "bodyweight_plus" },
  { key: "dumbbell_lunges", field: "equipment", from: "dumbbells", to: "dumbbells_kettlebell" },
  { key: "dumbbell_row", field: "equipment", from: "dumbbells", to: "dumbbells_kettlebell" },
  { key: "goblet_squat", field: "equipment", from: "dumbbells", to: "dumbbells_kettlebell" },
  { key: "dumbbell_shoulder_press", field: "equipment", from: "dumbbells", to: "dumbbells_kettlebell" },
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
