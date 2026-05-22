/**
 * Environment selector.
 *
 * Resolution order:
 *   1. If `OAK_ENV` is set (env var) and matches a known environment,
 *      use it. This is the CI / scripted path.
 *   2. Otherwise, prompt the user interactively with a numbered list
 *      of environments from `scripts/environments.js`.
 *   3. If stdin is not a TTY and OAK_ENV is not set, throw with a
 *      clear instruction — no implicit default.
 *
 * The returned object is `{ key, label, appUrl, adminUrl }`.
 */

const readline = require('readline');
const { ENVIRONMENTS, listEnvironmentKeys, getEnvironment } = require('./environments');

async function promptForEnvironment() {
  const keys = listEnvironmentKeys();

  console.log('\n──────────────────────────────────────────────');
  console.log('Where do you want to run this test?');
  console.log('──────────────────────────────────────────────');
  keys.forEach((k, i) => {
    const env = ENVIRONMENTS[k];
    console.log(`  ${i + 1}. ${k.padEnd(8)} — ${env.label}`);
    console.log(`     app:   ${env.appUrl}`);
    console.log(`     admin: ${env.adminUrl}`);
  });
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  try {
    while (true) {
      const answer = (await ask(`Enter number (1-${keys.length}) or env name: `)).trim();
      if (!answer) continue;

      let key = null;
      const num = Number.parseInt(answer, 10);
      if (Number.isInteger(num) && num >= 1 && num <= keys.length) {
        key = keys[num - 1];
      } else {
        const env = getEnvironment(answer);
        if (env) key = env.key;
      }

      if (!key) {
        console.log(`  ✗ Invalid choice. Pick one of: ${keys.join(', ')} (or 1-${keys.length}).\n`);
        continue;
      }

      const env = getEnvironment(key);
      console.log(`\n✓ Running against: ${env.key} (${env.label})\n`);
      return env;
    }
  } finally {
    rl.close();
  }
}

async function selectEnvironment() {
  const fromEnvVar = process.env.OAK_ENV;
  if (fromEnvVar) {
    const env = getEnvironment(fromEnvVar);
    if (!env) {
      throw new Error(
        `Unknown OAK_ENV="${fromEnvVar}". Valid values: ${listEnvironmentKeys().join(', ')}.`
      );
    }
    console.log(`Environment from OAK_ENV: ${env.key} (${env.label})`);
    console.log(`  app:   ${env.appUrl}`);
    console.log(`  admin: ${env.adminUrl}\n`);
    return env;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `OAK_ENV is not set and stdin is not a TTY. Set OAK_ENV=<env> (one of: ${listEnvironmentKeys().join(', ')}).`
    );
  }

  return promptForEnvironment();
}

module.exports = { selectEnvironment };
