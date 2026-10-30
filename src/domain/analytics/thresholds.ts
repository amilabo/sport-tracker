// Analytics without AI (stages 40–45, docs/plan-timed-circuit-analytics.md §2): every rule's number in one place.
// Nothing is stored — all of it is counted from the workouts already on the phone when a screen opens.

/** «N дней без тренировок» in the draft (stage 44, mockup А5): from this many days since the last workout. */
export const COMEBACK_DAYS = 14;

/** «−15 % / −10 % / Как в плане» (А5); the first is picked by default. */
export const COMEBACK_OPTIONS = [15, 10, 0] as const;
export const COMEBACK_DEFAULT = 15;

/** ≈ максимум (Epley) only from sets of 1…12 reps (decision of 30.10.2026): longer sets give «Лучший вес» only. */
export const E1RM_MAX_REPS = 12;

/** «Рекорды» on the exercise screen: from this many workouts with the exercise. One workout has nothing to beat. */
export const RECORDS_MIN_SESSIONS = 2;

/** «Больше всего раз с N кг»: N — the most frequent working weight (but the best one) of the latest this many workouts. */
export const USUAL_WEIGHT_SESSIONS = 5;

/** Finish screen: records shown before «Ещё N». */
export const FINISH_RECORDS_SHOWN = 3;
