// Chronomètre du tour (le sablier du livret), fondé sur l'horloge murale pour
// survivre à une fermeture de l'application. Objet sérialisable : aucune référence DOM.
//
// Règle temporelle déterministe (choix de l'application) : une action n'est
// comptée que si elle survient STRICTEMENT avant la fin du temps. À égalité
// exacte, la fin du temps l'emporte.

export function createClock(durationMs) {
  return { durationMs, elapsedMs: 0, runningSince: null };
}

export function remainingMs(clock, now) {
  const running = clock.runningSince == null ? 0 : Math.max(0, now - clock.runningSince);
  return Math.max(0, clock.durationMs - clock.elapsedMs - running);
}

export function isRunning(clock) {
  return clock.runningSince != null;
}

export function isExpired(clock, now) {
  return remainingMs(clock, now) <= 0;
}

/** Une action survenant à `now` est-elle recevable ? */
export function acceptsAction(clock, now) {
  return isRunning(clock) && remainingMs(clock, now) > 0;
}

export function start(clock, now) {
  if (isRunning(clock)) return clock;
  return { ...clock, runningSince: now };
}

export function pause(clock, now) {
  if (!isRunning(clock)) return clock;
  const elapsed = Math.min(clock.durationMs, clock.elapsedMs + Math.max(0, now - clock.runningSince));
  return { ...clock, elapsedMs: elapsed, runningSince: null };
}

/** Instant (horloge murale) où le temps s'épuise, si le chrono tourne. */
export function deadline(clock) {
  if (!isRunning(clock)) return null;
  return clock.runningSince + clock.durationMs - clock.elapsedMs;
}
