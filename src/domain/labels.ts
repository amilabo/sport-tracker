import type { Relation } from "@/content/exercise-substitutes";
import type { Equipment, LogType, MuscleGroup } from "./types";

/** First half of a substitute's line: «То же движение · гантели». */
export const RELATION_LABELS: Record<Relation, string> = {
  same: "То же движение",
  angle: "Смещает акцент",
  muscle: "Та же мышца",
  easier: "Легче",
  harder: "Сложнее",
  load: "Та же нагрузка",
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "грудь",
  back: "спина",
  legs: "ноги",
  glutes: "ягодицы",
  shoulders: "плечи",
  arms: "руки",
  abs: "пресс",
  cardio: "кардио",
  full_body: "всё тело",
};

/** After «на»: «Ещё на спину». Only «спина» changes. */
export const MUSCLE_GROUP_ON: Record<MuscleGroup, string> = { ...MUSCLE_GROUP_LABELS, back: "спину" };

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "штанга",
  dumbbells: "гантели",
  kettlebell: "гиря",
  // One exercise whichever the gym has free today: one history and one chart.
  dumbbells_kettlebell: "гантели / гиря",
  machine: "тренажёр",
  cable: "блок",
  bodyweight: "свой вес",
  band: "резина",
  cardio_machine: "кардиотренажёр",
  other: "другое",
};

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  weight_reps: "вес × раз",
  reps: "количество раз",
  bodyweight_plus: "свой вес ± кг × раз",
  time: "время",
  cardio: "время и скорость",
};
