# Oak Network UI Automation

End-to-end UI automation for the [Oak Network](https://app-dev.oaknetwork.org) platform using **Playwright** and a real Chrome profile with **MetaMask**.

## Features

- **Automated Login** — Full MetaMask wallet login flow (unlock, connect, confirm)
- **Create Campaign** — Fills out the entire campaign creation form:
  - Title, subtitle, category, location
  - Cover image and video URL
  - Goal amount and duration
  - Items with image upload
  - Rewards with image, pricing, quantity, delivery date, and shipping method
  - Story, risks & challenges, FAQ
  - Preview, submit for approval, and confirmation
- **Human-like Interaction** — Character-by-character typing with random delays, natural scrolling, and pauses between actions
- **Chrome Profile Support** — Uses your existing Chrome profile so MetaMask and other extensions are available
- **CDP Auto-connect** — Automatically manages Chrome launch and connects via Chrome DevTools Protocol

## Prerequisites

- **Node.js** v18+
- **Google Chrome** with MetaMask extension installed
- **macOS** (Chrome launch commands are macOS-specific)

## Manual walkthrough (recommended before automation)

Please sign up, create a campaign, approve the campaign from the admin panel, take the campaign live, and complete at least one pledge **manually** at least once. That way your wallet, site permissions, and MetaMask prompts are already familiar to the browser and your extension stays in a reliable state for the scripted flow.

Follow the team’s **[Test Guidelines](https://ccprotocol.atlassian.net/wiki/spaces/CCPROTOCOL/pages/1037205505/Test+Guidelines)** on Confluence for the full step-by-step process.

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers (optional, only needed for bundled Chromium tests)
npx playwright install
```

Open `scripts/metamask_password.js` and replace `YOUR_METAMASK_PASSWORD_HERE` with your actual MetaMask password:

```js
const MM_PASSWORD = 'your-actual-password';
```

Open `scripts/admin_credentials.js` and fill in the admin panel email and password used by `scripts/admin.js`:

```js
const ADMIN_EMAIL = 'your-admin-email@example.com';
const ADMIN_PASSWORD = 'your-admin-password';
```

## Usage

### Run as Playwright tests (recommended — per-step pass/fail reports)

```bash
npm run test:flow            # run the full end-to-end flow
npm run test:report          # open the HTML report after the run
```

The full flow is split into four ordered tests that share one Chrome session:

1. `Login via MetaMask`
2. `Create a campaign`
3. `Admin approves campaign and it goes live`
4. `Crypto pledge`

Each test contains many sub-steps (one per button click / form field / verification). After the run:

- **Terminal** (list reporter) shows pass/fail per test, e.g.:

  ```
    ✓  1. Login via MetaMask (45.2s)
    ✓  2. Create a campaign (3m 12.6s)
    ✗  3. Admin approves campaign and it goes live (1m 8.1s)
       Click MetaMask "Confirm" (second signature)
       Error: MetaMask popup not found for second confirmation.
         at scripts/admin.js:131
    -  4. Crypto pledge (skipped)
  ```

- **HTML report** (`npx playwright show-report`) shows the full step tree under each test, marking the exact step that failed, with screenshot, video, and trace.

To run all tests (smoke + full flow):

```bash
npm test
```

### Run as a single CLI script (no per-step report)

```bash
npm run automation
```

Same flow, but executed as a plain Node script. Every action is logged to the terminal with `▶ name` / `✓ name` / `✗ name` markers, and the process exits non-zero on the first failed step.

## Project Structure

```
├── assets/
│   ├── cover.png             # Campaign cover image
│   ├── item.png              # Item image
│   └── reward.png            # Reward image
├── scripts/
│   ├── step.js               # Pluggable step runner (console vs test.step)
│   ├── browser.js            # Chrome lifecycle / CDP attach
│   ├── login.js              # MetaMask login flow (per-step)
│   ├── create_campaign.js    # Campaign creation flow (per-step)
│   ├── admin.js              # Admin approval flow (per-step)
│   ├── crypto_pledge.js      # Crypto pledge flow (per-step)
│   ├── run_automation.js     # CLI orchestrator
│   ├── metamask_password.js  # MetaMask password (placeholder — fill in locally)
│   └── admin_credentials.js  # Admin email/password (placeholder — fill in locally)
├── tests/
│   └── test_cases/
│       ├── full_flow.spec.ts     # Full end-to-end flow as ordered tests
│       ├── home.spec.ts          # Home page smoke tests
│       └── my-projects.spec.ts   # My Projects page smoke tests
├── playwright.config.ts      # Playwright test configuration
├── package.json
└── .gitignore
```

## How It Works

1. **Browser Launch** — The script detects if Chrome is running, quits it gracefully, copies your Chrome profile to a temp directory, and relaunches with `--remote-debugging-port` for Playwright to connect via CDP.
2. **Login Flow** — Clicks Log In → Continue with a wallet → MetaMask → enters password → clicks Connect → Confirm. Handles the profile verification modal if it appears.
3. **Campaign Creation** — Navigates through all campaign form steps (Details → Items → Rewards → Story → Preview → Request Approval), filling fields with human-like typing and uploading images.
4. **Cleanup** — On exit, kills the automation Chrome process and closes cleanly.

## References

- **[Test Guidelines (Confluence)](https://ccprotocol.atlassian.net/wiki/spaces/CCPROTOCOL/pages/1037205505/Test+Guidelines)** — canonical source for environment URLs (dev, staging, prod, etc.), test accounts, and the manual walkthrough steps this automation mirrors. Whenever you add or update an environment in `scripts/environments.js`, make sure its URLs match this doc.

## License

ISC
