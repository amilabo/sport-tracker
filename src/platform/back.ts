// Screens with unsaved changes (a draft workout, the plan editor) ask before the Android back button leaves them.
// On the site nobody calls runBackGuard: the browser's back works as before.
const guards: (() => void)[] = [];

/** Registers a guard; the newest one wins. Returns the removal. */
export function pushBackGuard(onBack: () => void): () => void {
  guards.push(onBack);
  return () => {
    const i = guards.lastIndexOf(onBack);
    if (i >= 0) guards.splice(i, 1);
  };
}

/** Runs the newest guard instead of going back; false if there is none. */
export function runBackGuard(): boolean {
  const guard = guards.at(-1);
  if (!guard) return false;
  guard();
  return true;
}
