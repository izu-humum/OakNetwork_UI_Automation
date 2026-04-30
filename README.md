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

> Both `metamask_password.js` and `admin_credentials.js` hold sensitive values. Do not commit your real values. If you want git to ignore your local edits to these files, run:
>
> ```bash
> git update-index --skip-worktree scripts/metamask_password.js scripts/admin_credentials.js
> ```

## Usage

### Run the full automation (login + create campaign)

```bash
npm run automation
```

This will:
1. Launch Chrome with your existing profile and MetaMask
2. Navigate to the Oak Network site
3. Log in via MetaMask (enter password, connect, confirm)
4. Scroll briefly after login
5. Create a new campaign with all form fields filled
6. Wait for you to press Enter before closing the browser

### Run Playwright tests

```bash
npm test
```

## Project Structure

```
├── assets/
│   ├── cover.png          # Campaign cover image
│   ├── item.png           # Item image
│   └── reward.png         # Reward image
├── scripts/
│   ├── run_automation.js     # Main automation script (login + orchestration)
│   ├── create_campaign.js    # Campaign creation form automation
│   ├── admin.js              # Admin panel approval automation
│   ├── crypto_pledge.js      # Crypto pledge automation
│   ├── metamask_password.js  # MetaMask password (placeholder — fill in locally)
│   └── admin_credentials.js  # Admin email/password (placeholder — fill in locally)
├── tests/
│   ├── home.spec.ts       # Home page smoke tests
│   └── my-projects.spec.ts # My Projects page smoke tests
├── playwright.config.ts   # Playwright test configuration
├── package.json
└── .gitignore
```

## How It Works

1. **Browser Launch** — The script detects if Chrome is running, quits it gracefully, copies your Chrome profile to a temp directory, and relaunches with `--remote-debugging-port` for Playwright to connect via CDP.
2. **Login Flow** — Clicks Log In → Continue with a wallet → MetaMask → enters password → clicks Connect → Confirm. Handles the profile verification modal if it appears.
3. **Campaign Creation** — Navigates through all campaign form steps (Details → Items → Rewards → Story → Preview → Request Approval), filling fields with human-like typing and uploading images.
4. **Cleanup** — On exit, kills the automation Chrome process and closes cleanly.

## License

ISC
