// Generated from docs/exercise-substitutes.md (the draft, to be checked with a coach). Do not edit by hand:
// change the document and run npm run gen:substitutes. Keys are SEED_EXERCISES keys.

export const RELATIONS = ["same", "angle", "muscle", "easier", "harder", "load"] as const;
/** How a substitute relates to the exercise: the first half of its line, «То же движение · гантели». */
export type Relation = (typeof RELATIONS)[number];

export const PATTERNS = ["horizontal_push", "incline_push", "chest_fly", "pullover", "vertical_pull", "horizontal_pull", "scapular", "shrug", "vertical_push", "lateral_raise", "front_raise", "rear_delt", "hinge", "squat", "lunge", "knee_extension", "knee_flexion", "hip_adduction", "hip_abduction", "bridge", "kickback", "curl", "triceps_extension", "dip", "trunk_flexion", "trunk_rotation", "core_hold", "cardio", "conditioning"] as const;
export type Pattern = (typeof PATTERNS)[number];

export const MUSCLES = ["chest", "chest_upper", "lats", "mid_back", "traps", "erectors", "front_delt", "side_delt", "rear_delt", "rotator_cuff", "biceps", "brachialis", "triceps", "triceps_long", "forearms", "quads", "hamstrings", "adductors", "calves", "glute_max", "glute_med", "abs", "abs_lower", "obliques", "transverse", "core", "cardio", "shoulders", "legs", "arms", "back", "full_body"] as const;
export type Muscle = (typeof MUSCLES)[number];

export interface CatalogSubstitute {
  key: string;
  relation: Relation;
  /** What differs, ≤ 40 characters: «гантели, по одной руке». */
  note: string;
}

export interface CatalogSubstitutes {
  /** Not shown yet: for a fallback choice and future filters. */
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  /** In order of priority, 1–5. */
  subs: CatalogSubstitute[];
}

export const CATALOG_SUBSTITUTES: Record<string, CatalogSubstitutes> = {
  treadmill_walk: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["legs", "glute_max"],
    subs: [
      { key: "elliptical", relation: "load", note: "без ударной нагрузки" },
      { key: "exercise_bike", relation: "load", note: "сидя" },
      { key: "stair_stepper", relation: "harder", note: "пульс выше" },
      { key: "treadmill_run", relation: "harder", note: "бег" },
    ],
  },
  push_ups: {
    pattern: "horizontal_push",
    primary: ["chest"],
    secondary: ["front_delt", "triceps", "core"],
    subs: [
      { key: "knee_push_ups", relation: "easier", note: "меньше вес тела" },
      { key: "dumbbell_bench_press", relation: "same", note: "гантели" },
      { key: "machine_chest_press", relation: "same", note: "тренажёр" },
      { key: "dips", relation: "harder", note: "больше низ груди и трицепс" },
    ],
  },
  pec_deck: {
    pattern: "chest_fly",
    primary: ["chest"],
    secondary: ["front_delt"],
    subs: [
      { key: "cable_crossover", relation: "same", note: "блок" },
      { key: "dumbbell_fly", relation: "same", note: "гантели, больше растяжение" },
      { key: "machine_chest_press", relation: "muscle", note: "жим, с трицепсом" },
      { key: "push_ups", relation: "muscle", note: "свой вес, с трицепсом" },
    ],
  },
  cable_curl_reverse: {
    pattern: "curl",
    primary: ["brachialis", "forearms"],
    secondary: ["biceps"],
    subs: [
      { key: "hammer_curl", relation: "same", note: "гантели, ладони друг к другу" },
      { key: "cable_curl", relation: "angle", note: "бицепс, хват снизу" },
      { key: "barbell_curl", relation: "angle", note: "бицепс" },
    ],
  },
  cable_triceps_extension: {
    pattern: "triceps_extension",
    primary: ["triceps"],
    secondary: [],
    subs: [
      { key: "french_press", relation: "same", note: "штанга, лёжа" },
      { key: "overhead_triceps_extension", relation: "angle", note: "длинная головка" },
      { key: "bench_dips", relation: "muscle", note: "свой вес" },
      { key: "dips", relation: "harder", note: "свой вес, с грудью" },
    ],
  },
  seated_lateral_raise: {
    pattern: "lateral_raise",
    primary: ["side_delt"],
    secondary: [],
    subs: [
      { key: "standing_lateral_raise", relation: "same", note: "стоя, вес чуть больше" },
      { key: "machine_lateral_raise", relation: "same", note: "тренажёр" },
      { key: "cable_lateral_raise", relation: "same", note: "блок, нагрузка и внизу" },
      { key: "upright_row", relation: "muscle", note: "с трапецией" },
    ],
  },
  lying_leg_curl: {
    pattern: "knee_flexion",
    primary: ["hamstrings"],
    secondary: ["calves"],
    subs: [
      { key: "seated_leg_curl", relation: "same", note: "сидя, больше растяжение" },
      { key: "romanian_deadlift", relation: "muscle", note: "наклон, без тренажёра" },
      { key: "single_leg_balance_hinge", relation: "muscle", note: "свой вес" },
    ],
  },
  seated_hip_adduction: {
    pattern: "hip_adduction",
    primary: ["adductors"],
    secondary: [],
    subs: [
      { key: "plie_squat", relation: "muscle", note: "гантель / гиря, с ягодицами" },
    ],
  },
  romanian_deadlift: {
    pattern: "hinge",
    primary: ["hamstrings", "glute_max"],
    secondary: ["erectors"],
    subs: [
      { key: "single_leg_balance_hinge", relation: "same", note: "свой вес, одна нога" },
      { key: "back_extension", relation: "same", note: "тренажёр" },
      { key: "kettlebell_swing", relation: "same", note: "гиря, взрывно" },
      { key: "lying_leg_curl", relation: "muscle", note: "тренажёр, спина без нагрузки" },
    ],
  },
  forearm_plank: {
    pattern: "core_hold",
    primary: ["core", "abs"],
    secondary: ["transverse", "shoulders"],
    subs: [
      { key: "dead_bug", relation: "same", note: "лёжа, бережнее к пояснице" },
      { key: "side_plank", relation: "angle", note: "косые" },
      { key: "mountain_climber", relation: "harder", note: "в движении" },
    ],
  },
  froggy: {
    pattern: "bridge",
    primary: ["glute_max"],
    secondary: [],
    subs: [
      { key: "glute_bridge", relation: "same", note: "стопы на ширине таза" },
      { key: "single_leg_glute_bridge", relation: "harder", note: "одна нога" },
      { key: "machine_hip_thrust", relation: "harder", note: "с весом" },
    ],
  },
  band_pull_ups: {
    pattern: "vertical_pull",
    primary: ["lats"],
    secondary: ["biceps", "mid_back", "core"],
    subs: [
      { key: "assisted_pull_ups", relation: "same", note: "помощь точнее, по весу" },
      { key: "lat_pulldown", relation: "same", note: "блок" },
      { key: "close_grip_pulldown", relation: "angle", note: "низ широчайших" },
      { key: "pull_ups", relation: "harder", note: "без резинки" },
    ],
  },
  superman_scapula: {
    pattern: "scapular",
    primary: ["mid_back", "erectors"],
    secondary: ["rear_delt"],
    subs: [
      { key: "band_pull_apart", relation: "muscle", note: "стоя, резинка" },
      { key: "face_pull", relation: "muscle", note: "блок, с весом" },
      { key: "incline_reverse_fly", relation: "muscle", note: "гантели, упор груди" },
      { key: "back_extension", relation: "angle", note: "разгибатели спины" },
    ],
  },
  seated_cable_row: {
    pattern: "horizontal_pull",
    primary: ["mid_back", "lats"],
    secondary: ["biceps", "rear_delt"],
    subs: [
      { key: "hammer_row", relation: "same", note: "тренажёр, упор груди" },
      { key: "dumbbell_row", relation: "same", note: "гантели, по одной руке" },
      { key: "t_bar_row", relation: "same", note: "штанга" },
      { key: "barbell_row", relation: "harder", note: "держать наклон без упора" },
    ],
  },
  cable_pullover: {
    pattern: "pullover",
    primary: ["lats"],
    secondary: ["triceps_long", "chest"],
    subs: [
      { key: "dumbbell_pullover", relation: "same", note: "гантели, лёжа" },
      { key: "lat_pulldown", relation: "muscle", note: "с бицепсом" },
      { key: "close_grip_pulldown", relation: "muscle", note: "с бицепсом, низ широчайших" },
    ],
  },
  seated_hip_abduction: {
    pattern: "hip_abduction",
    primary: ["glute_med"],
    secondary: [],
    subs: [
      { key: "cable_hip_abduction", relation: "same", note: "блок, по одной ноге" },
    ],
  },
  single_leg_balance_hinge: {
    pattern: "hinge",
    primary: ["hamstrings", "glute_max"],
    secondary: ["glute_med", "core"],
    subs: [
      { key: "romanian_deadlift", relation: "same", note: "две ноги, с весом" },
      { key: "back_extension", relation: "same", note: "тренажёр" },
      { key: "single_leg_glute_bridge", relation: "muscle", note: "лёжа, без баланса" },
    ],
  },
  dumbbell_lunges: {
    pattern: "lunge",
    primary: ["quads", "glute_max"],
    secondary: ["adductors", "glute_med"],
    subs: [
      { key: "reverse_lunge", relation: "same", note: "бережнее к коленям" },
      { key: "bulgarian_split_squat", relation: "same", note: "задняя нога на скамье" },
      { key: "smith_lunge", relation: "same", note: "Смит, проще баланс" },
      { key: "step_up", relation: "same", note: "платформа" },
    ],
  },
  bench_press: {
    pattern: "horizontal_push",
    primary: ["chest"],
    secondary: ["front_delt", "triceps"],
    subs: [
      { key: "dumbbell_bench_press", relation: "same", note: "гантели, амплитуда больше" },
      { key: "machine_chest_press", relation: "same", note: "тренажёр, без страховки" },
      { key: "push_ups", relation: "same", note: "свой вес" },
      { key: "incline_bench_press", relation: "angle", note: "верх груди" },
    ],
  },
  dumbbell_bench_press: {
    pattern: "horizontal_push",
    primary: ["chest"],
    secondary: ["front_delt", "triceps"],
    subs: [
      { key: "bench_press", relation: "same", note: "штанга, вес больше" },
      { key: "machine_chest_press", relation: "same", note: "тренажёр" },
      { key: "push_ups", relation: "same", note: "свой вес" },
      { key: "incline_dumbbell_press", relation: "angle", note: "верх груди" },
    ],
  },
  knee_push_ups: {
    pattern: "horizontal_push",
    primary: ["chest"],
    secondary: ["front_delt", "triceps"],
    subs: [
      { key: "machine_chest_press", relation: "same", note: "вес подбирается точно" },
      { key: "dumbbell_bench_press", relation: "same", note: "гантели" },
      { key: "push_ups", relation: "harder", note: "полный вес тела" },
    ],
  },
  dips: {
    pattern: "dip",
    primary: ["triceps", "chest"],
    secondary: ["front_delt"],
    subs: [
      { key: "bench_dips", relation: "easier", note: "ноги на полу" },
      { key: "cable_triceps_extension", relation: "muscle", note: "только трицепс" },
      { key: "french_press", relation: "muscle", note: "штанга, только трицепс" },
      { key: "push_ups", relation: "angle", note: "больше грудь" },
    ],
  },
  pull_ups: {
    pattern: "vertical_pull",
    primary: ["lats"],
    secondary: ["biceps", "mid_back", "core"],
    subs: [
      { key: "assisted_pull_ups", relation: "easier", note: "противовес помогает" },
      { key: "band_pull_ups", relation: "easier", note: "резинка помогает" },
      { key: "lat_pulldown", relation: "same", note: "блок, вес подбирается" },
      { key: "close_grip_pulldown", relation: "angle", note: "низ широчайших" },
    ],
  },
  assisted_pull_ups: {
    pattern: "vertical_pull",
    primary: ["lats"],
    secondary: ["biceps", "mid_back"],
    subs: [
      { key: "band_pull_ups", relation: "same", note: "без тренажёра" },
      { key: "lat_pulldown", relation: "same", note: "блок" },
      { key: "close_grip_pulldown", relation: "angle", note: "низ широчайших" },
      { key: "pull_ups", relation: "harder", note: "без помощи" },
    ],
  },
  lat_pulldown: {
    pattern: "vertical_pull",
    primary: ["lats"],
    secondary: ["biceps", "rear_delt", "mid_back"],
    subs: [
      { key: "assisted_pull_ups", relation: "same", note: "тренажёр" },
      { key: "band_pull_ups", relation: "same", note: "без тренажёра" },
      { key: "close_grip_pulldown", relation: "angle", note: "низ широчайших, плечам легче" },
      { key: "cable_pullover", relation: "muscle", note: "без бицепса" },
      { key: "dumbbell_row", relation: "muscle", note: "тяга к поясу, гантели" },
    ],
  },
  dumbbell_row: {
    pattern: "horizontal_pull",
    primary: ["lats", "mid_back"],
    secondary: ["biceps", "rear_delt"],
    subs: [
      { key: "seated_cable_row", relation: "same", note: "блок" },
      { key: "hammer_row", relation: "same", note: "тренажёр" },
      { key: "t_bar_row", relation: "same", note: "штанга" },
      { key: "barbell_row", relation: "harder", note: "без упора, нагрузка на поясницу" },
    ],
  },
  deadlift: {
    pattern: "hinge",
    primary: ["erectors", "glute_max", "hamstrings"],
    secondary: ["quads", "traps", "forearms"],
    subs: [
      { key: "romanian_deadlift", relation: "angle", note: "задняя поверхность бедра" },
      { key: "kettlebell_swing", relation: "same", note: "гиря, вес меньше" },
      { key: "back_extension", relation: "easier", note: "без штанги" },
    ],
  },
  back_extension: {
    pattern: "hinge",
    primary: ["erectors"],
    secondary: ["glute_max", "hamstrings"],
    subs: [
      { key: "superman_scapula", relation: "easier", note: "на полу, без тренажёра" },
      { key: "single_leg_balance_hinge", relation: "same", note: "свой вес, одна нога" },
      { key: "reverse_hyperextension", relation: "angle", note: "ягодицы" },
      { key: "romanian_deadlift", relation: "harder", note: "штанга" },
    ],
  },
  barbell_squat: {
    pattern: "squat",
    primary: ["quads", "glute_max"],
    secondary: ["adductors", "erectors", "core"],
    subs: [
      { key: "smith_squat", relation: "same", note: "гриф по направляющим" },
      { key: "hack_squat", relation: "same", note: "тренажёр, упор спины" },
      { key: "leg_press", relation: "same", note: "без нагрузки на спину" },
      { key: "goblet_squat", relation: "easier", note: "гантель / гиря" },
    ],
  },
  goblet_squat: {
    pattern: "squat",
    primary: ["quads", "glute_max"],
    secondary: ["adductors", "core"],
    subs: [
      { key: "smith_squat", relation: "same", note: "Смит, вес больше" },
      { key: "leg_press", relation: "same", note: "тренажёр" },
      { key: "plie_squat", relation: "angle", note: "приводящие и ягодицы" },
      { key: "barbell_squat", relation: "harder", note: "штанга" },
    ],
  },
  leg_press: {
    pattern: "squat",
    primary: ["quads", "glute_max"],
    secondary: ["adductors"],
    subs: [
      { key: "hack_squat", relation: "same", note: "тренажёр" },
      { key: "smith_squat", relation: "same", note: "Смит" },
      { key: "goblet_squat", relation: "same", note: "гантель / гиря, вес меньше" },
      { key: "bulgarian_split_squat", relation: "muscle", note: "одна нога, гантели" },
    ],
  },
  leg_extension: {
    pattern: "knee_extension",
    primary: ["quads"],
    secondary: [],
    subs: [
      { key: "leg_press", relation: "muscle", note: "с ягодицами" },
      { key: "hack_squat", relation: "muscle", note: "с ягодицами" },
      { key: "goblet_squat", relation: "muscle", note: "без тренажёра" },
    ],
  },
  hip_thrust: {
    pattern: "bridge",
    primary: ["glute_max"],
    secondary: ["hamstrings"],
    subs: [
      { key: "machine_hip_thrust", relation: "same", note: "тренажёр, быстрее настроить" },
      { key: "smith_hip_thrust", relation: "same", note: "Смит" },
      { key: "single_leg_glute_bridge", relation: "same", note: "свой вес, одна нога" },
      { key: "glute_bridge", relation: "easier", note: "свой вес, на полу" },
    ],
  },
  glute_bridge: {
    pattern: "bridge",
    primary: ["glute_max"],
    secondary: ["hamstrings"],
    subs: [
      { key: "froggy", relation: "same", note: "колени врозь, темп быстрее" },
      { key: "single_leg_glute_bridge", relation: "harder", note: "одна нога" },
      { key: "machine_hip_thrust", relation: "harder", note: "с весом" },
      { key: "hip_thrust", relation: "harder", note: "штанга" },
    ],
  },
  cable_kickback: {
    pattern: "kickback",
    primary: ["glute_max"],
    secondary: ["hamstrings"],
    subs: [
      { key: "reverse_hyperextension", relation: "same", note: "обе ноги, тренажёр" },
      { key: "single_leg_glute_bridge", relation: "muscle", note: "одна нога, без блока" },
      { key: "machine_hip_thrust", relation: "muscle", note: "тренажёр, с весом" },
    ],
  },
  dumbbell_shoulder_press: {
    pattern: "vertical_push",
    primary: ["front_delt", "side_delt"],
    secondary: ["triceps"],
    subs: [
      { key: "machine_shoulder_press", relation: "same", note: "тренажёр" },
      { key: "arnold_press", relation: "same", note: "больше передняя дельта" },
      { key: "barbell_overhead_press", relation: "harder", note: "стоя, держать корпус" },
    ],
  },
  barbell_curl: {
    pattern: "curl",
    primary: ["biceps"],
    secondary: ["brachialis", "forearms"],
    subs: [
      { key: "dumbbell_curl", relation: "same", note: "гантели" },
      { key: "cable_curl", relation: "same", note: "блок" },
      { key: "preacher_curl", relation: "same", note: "упор локтей, без раскачки" },
      { key: "hammer_curl", relation: "angle", note: "брахиалис и предплечье" },
    ],
  },
  dumbbell_curl: {
    pattern: "curl",
    primary: ["biceps"],
    secondary: ["brachialis", "forearms"],
    subs: [
      { key: "barbell_curl", relation: "same", note: "штанга" },
      { key: "cable_curl", relation: "same", note: "блок" },
      { key: "concentration_curl", relation: "same", note: "одна рука, упор локтя" },
      { key: "hammer_curl", relation: "angle", note: "брахиалис и предплечье" },
    ],
  },
  french_press: {
    pattern: "triceps_extension",
    primary: ["triceps_long"],
    secondary: [],
    subs: [
      { key: "overhead_triceps_extension", relation: "same", note: "гантель, сидя" },
      { key: "cable_triceps_extension", relation: "same", note: "блок, локтям легче" },
      { key: "bench_dips", relation: "muscle", note: "свой вес" },
    ],
  },
  crunches: {
    pattern: "trunk_flexion",
    primary: ["abs"],
    secondary: [],
    subs: [
      { key: "cable_crunch", relation: "same", note: "с весом" },
      { key: "reverse_crunch", relation: "angle", note: "низ пресса" },
      { key: "bicycle_crunch", relation: "angle", note: "косые" },
      { key: "dead_bug", relation: "muscle", note: "без нагрузки на шею" },
    ],
  },
  hanging_leg_raise: {
    pattern: "trunk_flexion",
    primary: ["abs_lower"],
    secondary: ["abs", "forearms"],
    subs: [
      { key: "reverse_crunch", relation: "easier", note: "лёжа на полу" },
      { key: "cable_crunch", relation: "muscle", note: "с весом, на коленях" },
      { key: "dead_bug", relation: "easier", note: "лёжа, удержание" },
    ],
  },
  side_plank: {
    pattern: "core_hold",
    primary: ["obliques"],
    secondary: ["glute_med", "shoulders"],
    subs: [
      { key: "bicycle_crunch", relation: "muscle", note: "в движении" },
      { key: "forearm_plank", relation: "angle", note: "прямая мышца" },
    ],
  },
  exercise_bike: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["quads"],
    subs: [
      { key: "elliptical", relation: "load", note: "стоя, без ударной нагрузки" },
      { key: "treadmill_walk", relation: "load", note: "ходьба с наклоном" },
      { key: "rowing_machine", relation: "load", note: "всё тело" },
    ],
  },
  elliptical: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["legs", "arms"],
    subs: [
      { key: "exercise_bike", relation: "load", note: "сидя" },
      { key: "treadmill_walk", relation: "load", note: "ходьба с наклоном" },
      { key: "rowing_machine", relation: "load", note: "руки и ноги" },
      { key: "stair_stepper", relation: "harder", note: "пульс выше" },
    ],
  },
  barbell_overhead_press: {
    pattern: "vertical_push",
    primary: ["front_delt", "side_delt"],
    secondary: ["triceps", "core"],
    subs: [
      { key: "dumbbell_shoulder_press", relation: "same", note: "гантели, со спинкой" },
      { key: "machine_shoulder_press", relation: "same", note: "тренажёр, бережёт поясницу" },
      { key: "arnold_press", relation: "same", note: "гантели, сидя" },
    ],
  },
  machine_shoulder_press: {
    pattern: "vertical_push",
    primary: ["front_delt", "side_delt"],
    secondary: ["triceps"],
    subs: [
      { key: "dumbbell_shoulder_press", relation: "same", note: "гантели" },
      { key: "arnold_press", relation: "same", note: "гантели, больше передняя дельта" },
      { key: "barbell_overhead_press", relation: "harder", note: "стоя" },
    ],
  },
  arnold_press: {
    pattern: "vertical_push",
    primary: ["front_delt"],
    secondary: ["side_delt", "triceps"],
    subs: [
      { key: "dumbbell_shoulder_press", relation: "same", note: "без разворота кистей" },
      { key: "machine_shoulder_press", relation: "same", note: "тренажёр" },
      { key: "dumbbell_front_raise", relation: "muscle", note: "без трицепса" },
      { key: "barbell_overhead_press", relation: "harder", note: "стоя" },
    ],
  },
  standing_lateral_raise: {
    pattern: "lateral_raise",
    primary: ["side_delt"],
    secondary: [],
    subs: [
      { key: "seated_lateral_raise", relation: "same", note: "сидя, без раскачки" },
      { key: "machine_lateral_raise", relation: "same", note: "тренажёр" },
      { key: "cable_lateral_raise", relation: "same", note: "блок" },
      { key: "upright_row", relation: "muscle", note: "с трапецией" },
    ],
  },
  cable_lateral_raise: {
    pattern: "lateral_raise",
    primary: ["side_delt"],
    secondary: [],
    subs: [
      { key: "standing_lateral_raise", relation: "same", note: "гантели" },
      { key: "machine_lateral_raise", relation: "same", note: "тренажёр" },
      { key: "seated_lateral_raise", relation: "same", note: "сидя, гантели" },
    ],
  },
  machine_lateral_raise: {
    pattern: "lateral_raise",
    primary: ["side_delt"],
    secondary: [],
    subs: [
      { key: "standing_lateral_raise", relation: "same", note: "гантели" },
      { key: "seated_lateral_raise", relation: "same", note: "сидя, гантели" },
      { key: "cable_lateral_raise", relation: "same", note: "блок" },
    ],
  },
  upright_row: {
    pattern: "lateral_raise",
    primary: ["side_delt", "traps"],
    secondary: ["front_delt"],
    subs: [
      { key: "standing_lateral_raise", relation: "muscle", note: "бережнее к плечу" },
      { key: "machine_lateral_raise", relation: "muscle", note: "тренажёр" },
      { key: "dumbbell_shrug", relation: "angle", note: "трапеция" },
    ],
  },
  dumbbell_front_raise: {
    pattern: "front_raise",
    primary: ["front_delt"],
    secondary: [],
    subs: [
      { key: "plate_front_raise", relation: "same", note: "блин" },
      { key: "cable_front_raise", relation: "same", note: "блок" },
      { key: "dumbbell_shoulder_press", relation: "muscle", note: "жим, с трицепсом" },
    ],
  },
  plate_front_raise: {
    pattern: "front_raise",
    primary: ["front_delt"],
    secondary: [],
    subs: [
      { key: "dumbbell_front_raise", relation: "same", note: "гантели" },
      { key: "cable_front_raise", relation: "same", note: "блок" },
      { key: "dumbbell_shoulder_press", relation: "muscle", note: "жим, с трицепсом" },
    ],
  },
  cable_front_raise: {
    pattern: "front_raise",
    primary: ["front_delt"],
    secondary: [],
    subs: [
      { key: "dumbbell_front_raise", relation: "same", note: "гантели" },
      { key: "plate_front_raise", relation: "same", note: "блин" },
      { key: "machine_shoulder_press", relation: "muscle", note: "жим, с трицепсом" },
    ],
  },
  bent_over_reverse_fly: {
    pattern: "rear_delt",
    primary: ["rear_delt"],
    secondary: ["mid_back"],
    subs: [
      { key: "incline_reverse_fly", relation: "same", note: "упор груди, без наклона" },
      { key: "reverse_pec_deck", relation: "same", note: "тренажёр" },
      { key: "cable_reverse_fly", relation: "same", note: "блок" },
      { key: "face_pull", relation: "muscle", note: "с вращателями плеча" },
    ],
  },
  incline_reverse_fly: {
    pattern: "rear_delt",
    primary: ["rear_delt"],
    secondary: ["mid_back"],
    subs: [
      { key: "bent_over_reverse_fly", relation: "same", note: "стоя в наклоне" },
      { key: "reverse_pec_deck", relation: "same", note: "тренажёр" },
      { key: "cable_reverse_fly", relation: "same", note: "блок" },
      { key: "band_pull_apart", relation: "easier", note: "резинка" },
    ],
  },
  reverse_pec_deck: {
    pattern: "rear_delt",
    primary: ["rear_delt"],
    secondary: ["mid_back"],
    subs: [
      { key: "cable_reverse_fly", relation: "same", note: "блок" },
      { key: "incline_reverse_fly", relation: "same", note: "гантели, упор груди" },
      { key: "bent_over_reverse_fly", relation: "same", note: "гантели, стоя" },
      { key: "face_pull", relation: "muscle", note: "блок, с вращателями" },
    ],
  },
  cable_reverse_fly: {
    pattern: "rear_delt",
    primary: ["rear_delt"],
    secondary: ["mid_back"],
    subs: [
      { key: "reverse_pec_deck", relation: "same", note: "тренажёр" },
      { key: "incline_reverse_fly", relation: "same", note: "гантели, упор груди" },
      { key: "bent_over_reverse_fly", relation: "same", note: "гантели, стоя" },
      { key: "band_pull_apart", relation: "easier", note: "резинка" },
    ],
  },
  face_pull: {
    pattern: "rear_delt",
    primary: ["rear_delt", "rotator_cuff"],
    secondary: ["mid_back"],
    subs: [
      { key: "band_pull_apart", relation: "same", note: "резинка, без блока" },
      { key: "reverse_pec_deck", relation: "muscle", note: "без вращения плеча" },
      { key: "cable_reverse_fly", relation: "muscle", note: "без вращения плеча" },
      { key: "incline_reverse_fly", relation: "muscle", note: "гантели" },
    ],
  },
  band_pull_apart: {
    pattern: "rear_delt",
    primary: ["rear_delt", "mid_back"],
    secondary: [],
    subs: [
      { key: "cable_reverse_fly", relation: "same", note: "блок, вес больше" },
      { key: "bent_over_reverse_fly", relation: "same", note: "гантели" },
      { key: "face_pull", relation: "muscle", note: "блок" },
      { key: "superman_scapula", relation: "muscle", note: "на полу" },
    ],
  },
  incline_bench_press: {
    pattern: "incline_push",
    primary: ["chest_upper"],
    secondary: ["front_delt", "triceps"],
    subs: [
      { key: "incline_dumbbell_press", relation: "same", note: "гантели" },
      { key: "bench_press", relation: "angle", note: "середина груди" },
      { key: "machine_chest_press", relation: "angle", note: "середина груди, тренажёр" },
    ],
  },
  incline_dumbbell_press: {
    pattern: "incline_push",
    primary: ["chest_upper"],
    secondary: ["front_delt", "triceps"],
    subs: [
      { key: "incline_bench_press", relation: "same", note: "штанга" },
      { key: "dumbbell_bench_press", relation: "angle", note: "середина груди" },
      { key: "machine_chest_press", relation: "angle", note: "середина груди, тренажёр" },
    ],
  },
  machine_chest_press: {
    pattern: "horizontal_push",
    primary: ["chest"],
    secondary: ["front_delt", "triceps"],
    subs: [
      { key: "dumbbell_bench_press", relation: "same", note: "гантели" },
      { key: "bench_press", relation: "same", note: "штанга, нужна страховка" },
      { key: "push_ups", relation: "same", note: "свой вес" },
      { key: "cable_crossover", relation: "muscle", note: "без трицепса" },
    ],
  },
  dumbbell_fly: {
    pattern: "chest_fly",
    primary: ["chest"],
    secondary: ["front_delt"],
    subs: [
      { key: "pec_deck", relation: "same", note: "тренажёр" },
      { key: "cable_crossover", relation: "same", note: "блок" },
      { key: "dumbbell_bench_press", relation: "muscle", note: "жим, с трицепсом" },
    ],
  },
  cable_crossover: {
    pattern: "chest_fly",
    primary: ["chest"],
    secondary: ["front_delt"],
    subs: [
      { key: "pec_deck", relation: "same", note: "тренажёр" },
      { key: "dumbbell_fly", relation: "same", note: "гантели" },
      { key: "push_ups", relation: "muscle", note: "свой вес, с трицепсом" },
    ],
  },
  dumbbell_pullover: {
    pattern: "pullover",
    primary: ["lats", "chest"],
    secondary: ["triceps_long"],
    subs: [
      { key: "cable_pullover", relation: "same", note: "блок, больше широчайшие" },
      { key: "dumbbell_fly", relation: "muscle", note: "только грудь" },
      { key: "lat_pulldown", relation: "muscle", note: "широчайшие, с бицепсом" },
    ],
  },
  barbell_row: {
    pattern: "horizontal_pull",
    primary: ["mid_back", "lats"],
    secondary: ["biceps", "rear_delt", "erectors"],
    subs: [
      { key: "t_bar_row", relation: "same", note: "легче держать наклон" },
      { key: "dumbbell_row", relation: "same", note: "упор на скамью, бережёт поясницу" },
      { key: "hammer_row", relation: "same", note: "тренажёр, без нагрузки на поясницу" },
      { key: "seated_cable_row", relation: "same", note: "блок" },
    ],
  },
  t_bar_row: {
    pattern: "horizontal_pull",
    primary: ["mid_back", "lats"],
    secondary: ["biceps", "rear_delt", "erectors"],
    subs: [
      { key: "barbell_row", relation: "same", note: "обычный гриф" },
      { key: "hammer_row", relation: "same", note: "тренажёр" },
      { key: "dumbbell_row", relation: "same", note: "гантели" },
      { key: "seated_cable_row", relation: "same", note: "блок" },
    ],
  },
  hammer_row: {
    pattern: "horizontal_pull",
    primary: ["mid_back", "lats"],
    secondary: ["biceps", "rear_delt"],
    subs: [
      { key: "seated_cable_row", relation: "same", note: "блок" },
      { key: "dumbbell_row", relation: "same", note: "гантели, упор на скамью" },
      { key: "t_bar_row", relation: "same", note: "штанга" },
      { key: "barbell_row", relation: "harder", note: "без упора, нагрузка на поясницу" },
    ],
  },
  close_grip_pulldown: {
    pattern: "vertical_pull",
    primary: ["lats"],
    secondary: ["biceps", "mid_back"],
    subs: [
      { key: "assisted_pull_ups", relation: "same", note: "тренажёр" },
      { key: "band_pull_ups", relation: "same", note: "без тренажёра" },
      { key: "lat_pulldown", relation: "angle", note: "широкий хват, верх спины" },
      { key: "seated_cable_row", relation: "muscle", note: "тяга к поясу, та же рукоять" },
    ],
  },
  dumbbell_shrug: {
    pattern: "shrug",
    primary: ["traps"],
    secondary: ["forearms"],
    subs: [
      { key: "upright_row", relation: "muscle", note: "со средней дельтой" },
    ],
  },
  bulgarian_split_squat: {
    pattern: "lunge",
    primary: ["quads", "glute_max"],
    secondary: ["adductors", "glute_med"],
    subs: [
      { key: "smith_lunge", relation: "same", note: "Смит, проще баланс" },
      { key: "dumbbell_lunges", relation: "same", note: "гантели" },
      { key: "step_up", relation: "same", note: "платформа" },
      { key: "reverse_lunge", relation: "easier", note: "обе ноги на полу" },
    ],
  },
  step_up: {
    pattern: "lunge",
    primary: ["glute_max", "quads"],
    secondary: ["glute_med"],
    subs: [
      { key: "reverse_lunge", relation: "same", note: "без платформы" },
      { key: "bulgarian_split_squat", relation: "same", note: "скамья" },
      { key: "dumbbell_lunges", relation: "same", note: "гантели" },
    ],
  },
  smith_squat: {
    pattern: "squat",
    primary: ["quads", "glute_max"],
    secondary: ["adductors"],
    subs: [
      { key: "hack_squat", relation: "same", note: "тренажёр" },
      { key: "leg_press", relation: "same", note: "тренажёр" },
      { key: "goblet_squat", relation: "same", note: "гантель / гиря" },
      { key: "barbell_squat", relation: "harder", note: "свободная штанга" },
    ],
  },
  smith_lunge: {
    pattern: "lunge",
    primary: ["quads", "glute_max"],
    secondary: ["adductors"],
    subs: [
      { key: "bulgarian_split_squat", relation: "same", note: "гантели" },
      { key: "reverse_lunge", relation: "same", note: "гантели" },
      { key: "dumbbell_lunges", relation: "same", note: "гантели" },
      { key: "leg_press", relation: "muscle", note: "обе ноги, тренажёр" },
    ],
  },
  hack_squat: {
    pattern: "squat",
    primary: ["quads"],
    secondary: ["glute_max"],
    subs: [
      { key: "leg_press", relation: "same", note: "тренажёр" },
      { key: "smith_squat", relation: "same", note: "Смит" },
      { key: "goblet_squat", relation: "same", note: "гантель / гиря" },
      { key: "barbell_squat", relation: "harder", note: "штанга" },
    ],
  },
  seated_leg_curl: {
    pattern: "knee_flexion",
    primary: ["hamstrings"],
    secondary: [],
    subs: [
      { key: "lying_leg_curl", relation: "same", note: "лёжа" },
      { key: "romanian_deadlift", relation: "muscle", note: "наклон, без тренажёра" },
      { key: "single_leg_balance_hinge", relation: "muscle", note: "свой вес" },
    ],
  },
  reverse_lunge: {
    pattern: "lunge",
    primary: ["glute_max", "quads"],
    secondary: ["adductors", "glute_med"],
    subs: [
      { key: "dumbbell_lunges", relation: "same", note: "шаг вперёд" },
      { key: "bulgarian_split_squat", relation: "same", note: "задняя нога на скамье" },
      { key: "smith_lunge", relation: "same", note: "Смит, проще баланс" },
      { key: "step_up", relation: "same", note: "платформа" },
    ],
  },
  machine_hip_thrust: {
    pattern: "bridge",
    primary: ["glute_max"],
    secondary: ["hamstrings"],
    subs: [
      { key: "smith_hip_thrust", relation: "same", note: "Смит" },
      { key: "hip_thrust", relation: "same", note: "штанга" },
      { key: "single_leg_glute_bridge", relation: "same", note: "свой вес, одна нога" },
      { key: "glute_bridge", relation: "easier", note: "свой вес, на полу" },
    ],
  },
  smith_hip_thrust: {
    pattern: "bridge",
    primary: ["glute_max"],
    secondary: ["hamstrings"],
    subs: [
      { key: "machine_hip_thrust", relation: "same", note: "тренажёр" },
      { key: "hip_thrust", relation: "same", note: "штанга" },
      { key: "single_leg_glute_bridge", relation: "same", note: "свой вес, одна нога" },
    ],
  },
  single_leg_glute_bridge: {
    pattern: "bridge",
    primary: ["glute_max"],
    secondary: ["glute_med", "hamstrings"],
    subs: [
      { key: "machine_hip_thrust", relation: "same", note: "две ноги, с весом" },
      { key: "hip_thrust", relation: "same", note: "две ноги, штанга" },
      { key: "froggy", relation: "same", note: "две ноги, колени врозь" },
      { key: "glute_bridge", relation: "easier", note: "две ноги" },
    ],
  },
  cable_hip_abduction: {
    pattern: "hip_abduction",
    primary: ["glute_med"],
    secondary: [],
    subs: [
      { key: "seated_hip_abduction", relation: "same", note: "тренажёр, обе ноги" },
    ],
  },
  reverse_hyperextension: {
    pattern: "kickback",
    primary: ["glute_max"],
    secondary: ["hamstrings", "erectors"],
    subs: [
      { key: "cable_kickback", relation: "same", note: "блок, по одной ноге" },
      { key: "glute_bridge", relation: "muscle", note: "на полу" },
      { key: "back_extension", relation: "angle", note: "больше спина" },
    ],
  },
  plie_squat: {
    pattern: "squat",
    primary: ["glute_max", "adductors"],
    secondary: ["quads"],
    subs: [
      { key: "leg_press", relation: "same", note: "стопы широко, тренажёр" },
      { key: "smith_squat", relation: "same", note: "широкая стойка, Смит" },
      { key: "goblet_squat", relation: "angle", note: "больше квадрицепс" },
      { key: "seated_hip_adduction", relation: "muscle", note: "только приводящие" },
    ],
  },
  kettlebell_swing: {
    pattern: "hinge",
    primary: ["glute_max", "hamstrings"],
    secondary: ["erectors", "core"],
    subs: [
      { key: "romanian_deadlift", relation: "same", note: "медленно, штанга" },
      { key: "back_extension", relation: "same", note: "тренажёр" },
      { key: "hip_thrust", relation: "muscle", note: "без раскачки" },
    ],
  },
  cable_curl: {
    pattern: "curl",
    primary: ["biceps"],
    secondary: ["brachialis", "forearms"],
    subs: [
      { key: "dumbbell_curl", relation: "same", note: "гантели" },
      { key: "barbell_curl", relation: "same", note: "штанга" },
      { key: "preacher_curl", relation: "same", note: "упор локтей" },
      { key: "cable_curl_reverse", relation: "angle", note: "предплечье" },
    ],
  },
  hammer_curl: {
    pattern: "curl",
    primary: ["brachialis", "forearms"],
    secondary: ["biceps"],
    subs: [
      { key: "cable_curl_reverse", relation: "same", note: "блок, хват сверху" },
      { key: "dumbbell_curl", relation: "angle", note: "бицепс" },
      { key: "barbell_curl", relation: "angle", note: "бицепс" },
    ],
  },
  preacher_curl: {
    pattern: "curl",
    primary: ["biceps"],
    secondary: [],
    subs: [
      { key: "concentration_curl", relation: "same", note: "упор локтя, гантель" },
      { key: "barbell_curl", relation: "same", note: "стоя" },
      { key: "cable_curl", relation: "same", note: "блок" },
    ],
  },
  concentration_curl: {
    pattern: "curl",
    primary: ["biceps"],
    secondary: [],
    subs: [
      { key: "preacher_curl", relation: "same", note: "упор локтей, штанга" },
      { key: "dumbbell_curl", relation: "same", note: "стоя, две руки" },
      { key: "cable_curl", relation: "same", note: "блок" },
    ],
  },
  overhead_triceps_extension: {
    pattern: "triceps_extension",
    primary: ["triceps_long"],
    secondary: [],
    subs: [
      { key: "french_press", relation: "same", note: "штанга, лёжа" },
      { key: "cable_triceps_extension", relation: "angle", note: "наружная головка" },
      { key: "bench_dips", relation: "muscle", note: "свой вес" },
    ],
  },
  bench_dips: {
    pattern: "dip",
    primary: ["triceps"],
    secondary: ["front_delt"],
    subs: [
      { key: "cable_triceps_extension", relation: "muscle", note: "блок" },
      { key: "overhead_triceps_extension", relation: "muscle", note: "гантель" },
      { key: "dips", relation: "harder", note: "весь вес тела" },
    ],
  },
  bicycle_crunch: {
    pattern: "trunk_flexion",
    primary: ["obliques"],
    secondary: ["abs"],
    subs: [
      { key: "side_plank", relation: "muscle", note: "удержание" },
      { key: "crunches", relation: "angle", note: "прямая мышца" },
      { key: "mountain_climber", relation: "muscle", note: "в движении, пульс выше" },
    ],
  },
  reverse_crunch: {
    pattern: "trunk_flexion",
    primary: ["abs_lower"],
    secondary: ["abs"],
    subs: [
      { key: "hanging_leg_raise", relation: "harder", note: "в висе" },
      { key: "dead_bug", relation: "muscle", note: "удержание" },
      { key: "crunches", relation: "angle", note: "верх пресса" },
    ],
  },
  cable_crunch: {
    pattern: "trunk_flexion",
    primary: ["abs"],
    secondary: [],
    subs: [
      { key: "crunches", relation: "easier", note: "свой вес" },
      { key: "reverse_crunch", relation: "angle", note: "низ пресса" },
      { key: "hanging_leg_raise", relation: "harder", note: "низ пресса, вис" },
    ],
  },
  dead_bug: {
    pattern: "core_hold",
    primary: ["core", "transverse"],
    secondary: ["abs"],
    subs: [
      { key: "forearm_plank", relation: "same", note: "удержание, сложнее" },
      { key: "reverse_crunch", relation: "angle", note: "низ пресса" },
      { key: "stomach_vacuum", relation: "muscle", note: "поперечная, без движения" },
    ],
  },
  stomach_vacuum: {
    pattern: "core_hold",
    primary: ["transverse"],
    secondary: [],
    subs: [
      { key: "dead_bug", relation: "muscle", note: "в движении" },
      { key: "forearm_plank", relation: "muscle", note: "удержание всего кора" },
    ],
  },
  treadmill_run: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["legs"],
    subs: [
      { key: "elliptical", relation: "load", note: "без ударной нагрузки" },
      { key: "exercise_bike", relation: "load", note: "сидя, бережнее к коленям" },
      { key: "rowing_machine", relation: "load", note: "всё тело" },
      { key: "jump_rope", relation: "load", note: "без тренажёра" },
      { key: "treadmill_walk", relation: "easier", note: "ходьба с наклоном" },
    ],
  },
  stair_stepper: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["glute_max", "quads"],
    subs: [
      { key: "treadmill_walk", relation: "easier", note: "с наклоном 10–15%" },
      { key: "elliptical", relation: "easier", note: "без ударной нагрузки" },
      { key: "exercise_bike", relation: "easier", note: "сидя" },
    ],
  },
  rowing_machine: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["back", "legs", "arms"],
    subs: [
      { key: "elliptical", relation: "load", note: "руки и ноги" },
      { key: "exercise_bike", relation: "load", note: "только ноги" },
      { key: "treadmill_run", relation: "load", note: "бег" },
    ],
  },
  jump_rope: {
    pattern: "cardio",
    primary: ["cardio"],
    secondary: ["calves", "shoulders"],
    subs: [
      { key: "treadmill_run", relation: "load", note: "ударная нагрузка, ровнее" },
      { key: "burpee", relation: "load", note: "всё тело" },
      { key: "mountain_climber", relation: "load", note: "на месте, без прыжков" },
    ],
  },
  burpee: {
    pattern: "conditioning",
    primary: ["cardio", "full_body"],
    secondary: ["chest", "legs", "core"],
    subs: [
      { key: "mountain_climber", relation: "easier", note: "без прыжков" },
      { key: "jump_rope", relation: "load", note: "прыжки" },
      { key: "rowing_machine", relation: "load", note: "всё тело, тренажёр" },
    ],
  },
  mountain_climber: {
    pattern: "conditioning",
    primary: ["core", "cardio"],
    secondary: ["shoulders", "legs"],
    subs: [
      { key: "burpee", relation: "harder", note: "с прыжком" },
      { key: "jump_rope", relation: "load", note: "прыжки" },
      { key: "forearm_plank", relation: "easier", note: "удержание без движения" },
    ],
  },
};
