/**
 * Pluggable step runner.
 *
 * Wraps a unit of work so it can be reported individually in a Playwright
 * test report. Each helper script calls `step(name, async () => { ... })`
 * around every distinct action (click, fill, navigation, upload, etc.).
 *
 * Modes:
 *   - Default: prints a console marker, runs the function, prints pass/fail.
 *     This is what `npm run automation` uses.
 *   - Test mode: pass `{ step: test.step.bind(test) }` from inside a
 *     Playwright test so each action becomes its own reportable step in
 *     the HTML report (with screenshots / trace / per-step pass-fail).
 */

const defaultStep = async (name, fn) => {
  console.log(`▶ ${name}`);
  try {
    const result = await fn();
    console.log(`✓ ${name}`);
    return result;
  } catch (err) {
    console.log(`✗ ${name} — ${err.message}`);
    throw err;
  }
};

function resolveStep(opts) {
  if (opts && typeof opts.step === 'function') return opts.step;
  return defaultStep;
}

module.exports = { defaultStep, resolveStep };
