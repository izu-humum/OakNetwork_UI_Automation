/**
 * Environment registry — single source of truth for which Oak Network
 * deployment the automation should run against.
 *
 * URLs are sourced from the Confluence Test Guidelines:
 * https://ccprotocol.atlassian.net/wiki/spaces/CCPROTOCOL/pages/1037205505/Test+Guidelines
 *
 * Add a new environment by appending a key here. Both the CLI runner
 * (`npm run automation`) and the Playwright tests will pick it up
 * automatically.
 */

const ENVIRONMENTS = {
  dev: {
    label: 'Development',
    appUrl: 'https://app-dev.oaknetwork.org',
    adminUrl: 'https://ccprotocol-minipay-admin-git-saclient-dev-crowdsplit.vercel.app/admin/login',
  },
  stage: {
    label: 'Staging',
    appUrl: 'https://app-stage.oaknetwork.org',
    adminUrl: 'https://app-admin-stage.oaknetwork.org/admin/login',
  },
};

// Convenience aliases so e.g. OAK_ENV=staging works too.
const ALIASES = {
  development: 'dev',
  staging: 'stage',
};

function normalizeKey(input) {
  if (!input) return null;
  const key = String(input).trim().toLowerCase();
  return ALIASES[key] || key;
}

function getEnvironment(key) {
  const norm = normalizeKey(key);
  if (!norm || !ENVIRONMENTS[norm]) return null;
  return { key: norm, ...ENVIRONMENTS[norm] };
}

function listEnvironmentKeys() {
  return Object.keys(ENVIRONMENTS);
}

module.exports = {
  ENVIRONMENTS,
  ALIASES,
  getEnvironment,
  listEnvironmentKeys,
  normalizeKey,
};
