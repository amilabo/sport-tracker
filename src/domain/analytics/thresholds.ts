// Analytics without AI (stages 40–45, docs/plan-timed-circuit-analytics.md §2): every rule's number in one place.
// Nothing is stored — all of it is counted from the workouts already on the phone when a screen opens.

/** «N дней без тренировок» in the draft (stage 44, mockup А5): from this many days since the last workout. */
export const COMEBACK_DAYS = 14;

/** «−15 % / −10 % / Как в плане» (А5); the first is picked by default. */
export const COMEBACK_OPTIONS = [15, 10, 0] as const;
export const COMEBACK_DEFAULT = 15;
