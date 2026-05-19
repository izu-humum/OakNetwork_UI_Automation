/**
 * Create Campaign automation.
 * Every action is wrapped in `step(name, async () => { ... })` so the
 * Playwright HTML report shows per-step pass/fail when called from
 * tests, and the console runner logs every step when called from
 * `npm run automation`.
 *
 * Usage:
 *   const { createCampaign } = require('./create_campaign');
 *   const title = await createCampaign(page, context, { step });
 */

const path = require('path');
const { resolveStep } = require('./step');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ADJECTIVES = ['Bright', 'Bold', 'Creative', 'Epic', 'Grand', 'Stellar', 'Rising', 'Golden', 'Swift', 'Noble'];
const NOUNS = ['Horizon', 'Venture', 'Vision', 'Spark', 'Journey', 'Wave', 'Summit', 'Dream', 'Forge', 'Quest'];
const THEMES = ['Project', 'Initiative', 'Campaign', 'Movement', 'Mission', 'Launch', 'Edition', 'Chapter', 'Series', 'Collective'];

function randomTitle() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  return `${adj} ${noun} ${theme}`;
}

async function typeHumanLike(page, text, { min = 80, jitter = 120 } = {}) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: min + Math.floor(Math.random() * jitter) });
  }
}

async function createCampaign(page, context, opts = {}) {
  const step = resolveStep(opts);
  const titleText = randomTitle();

  await step('Click "Create Campaign" button (header)', async () => {
    const createBtn = page.locator('button[data-create-btn="true"]');
    await createBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });

  await step('Fill campaign title', async () => {
    const titleInput = page.locator('input[name="title"]');
    await titleInput.waitFor({ state: 'visible', timeout: 15_000 });
    await titleInput.click();
    await sleep(500);
    await typeHumanLike(page, titleText);
  });

  await step('Fill campaign subtitle', async () => {
    const subtitleInput = page.locator('input[name="subtitle"]');
    await subtitleInput.waitFor({ state: 'visible', timeout: 15_000 });
    await subtitleInput.click();
    await sleep(500);
    await typeHumanLike(page, 'My Campaign Subtitle');
  });

  await step('Select random category from dropdown', async () => {
    const categorySelect = page.locator('select[name="category"]');
    await categorySelect.waitFor({ state: 'visible', timeout: 15_000 });
    await categorySelect.selectOption({ index: 1 + Math.floor(Math.random() * 10) });
  });

  await step('Fill location field', async () => {
    const locationInput = page.locator('input[name="location"]');
    await locationInput.waitFor({ state: 'visible', timeout: 15_000 });
    await locationInput.click();
    await sleep(500);
    await typeHumanLike(page, 'Dhaka');
  });

  await step('Upload cover image', async () => {
    const dropzone = page.locator('.chakra-file-upload__dropzone');
    await dropzone.waitFor({ state: 'visible', timeout: 15_000 });
    await dropzone.scrollIntoViewIfNeeded();
    await sleep(500);

    const coverPath = path.resolve(__dirname, '..', 'assets', 'cover.png');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10_000 }),
      dropzone.click(),
    ]);
    await fileChooser.setFiles(coverPath);
    await sleep(3000);
  });

  await step('Fill cover video URL', async () => {
    const videoInput = page.locator('input[name="projectVideoUrl"]');
    await videoInput.waitFor({ state: 'visible', timeout: 15_000 });
    await videoInput.scrollIntoViewIfNeeded();
    await videoInput.click();
    await sleep(500);
    await typeHumanLike(page, 'https://www.youtube.com/watch?v=DGnH8MfyTf0', { min: 40, jitter: 60 });
  });

  await step('Enter goal amount', async () => {
    const goalInput = page.locator('input.chakra-number-input__input[placeholder="Enter goal amount"]');
    await goalInput.waitFor({ state: 'visible', timeout: 15_000 });
    await goalInput.scrollIntoViewIfNeeded();
    await goalInput.click();
    await sleep(500);
    await page.keyboard.type('0', { delay: 100 });
  });

  await step('Enter campaign duration (1 day)', async () => {
    const durationInput = page.locator('input.chakra-number-input__input[placeholder="30 days"]');
    await durationInput.waitFor({ state: 'visible', timeout: 15_000 });
    await durationInput.scrollIntoViewIfNeeded();
    await durationInput.click({ clickCount: 3 });
    await sleep(300);
    await page.keyboard.press('Backspace');
    await sleep(500);
    await page.keyboard.type('1', { delay: 100 });
  });

  await step('Click "Next: Items" button', async () => {
    const nextItemsBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*items/i });
    await nextItemsBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await nextItemsBtn.scrollIntoViewIfNeeded();
    await nextItemsBtn.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });

  await step('Click "Add New Item" button', async () => {
    const addNewItemBtn = page.getByRole('button', { name: /add new item/i });
    await addNewItemBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await addNewItemBtn.scrollIntoViewIfNeeded();
    await addNewItemBtn.click();
    await sleep(3000);
  });

  await step('Fill item title', async () => {
    const itemTitleInput = page.locator('input[name="name"]');
    await itemTitleInput.waitFor({ state: 'visible', timeout: 15_000 });
    await itemTitleInput.click();
    await sleep(500);
    await typeHumanLike(page, 'My Item Title');
  });

  await step('Upload item image', async () => {
    const itemDropzone = page.locator('#file\\:_r_t_\\:dropzone');
    await itemDropzone.waitFor({ state: 'visible', timeout: 15_000 });
    await itemDropzone.scrollIntoViewIfNeeded();
    await sleep(500);

    const itemImagePath = path.resolve(__dirname, '..', 'assets', 'item.png');
    const [itemFileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10_000 }),
      itemDropzone.click(),
    ]);
    await itemFileChooser.setFiles(itemImagePath);
    await sleep(3000);
  });

  await step('Click "Save" button (item)', async () => {
    const saveBtn = page.locator('button[type="submit"]').filter({ hasText: /save/i });
    await saveBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();
    await sleep(3000);
  });

  await step('Click "Next: Rewards" button', async () => {
    const nextRewardsBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*rewards/i });
    await nextRewardsBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await nextRewardsBtn.scrollIntoViewIfNeeded();
    await nextRewardsBtn.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });

  await step('Click "Add New Reward" button', async () => {
    const addNewRewardBtn = page.getByRole('button', { name: /add new reward/i });
    await addNewRewardBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await addNewRewardBtn.scrollIntoViewIfNeeded();
    await addNewRewardBtn.click();
    await sleep(3000);
  });

  await step('Fill reward title', async () => {
    const rewardTitleInput = page.locator('input[name="name"]');
    await rewardTitleInput.waitFor({ state: 'visible', timeout: 15_000 });
    await rewardTitleInput.click();
    await sleep(500);
    await typeHumanLike(page, 'Gold Trophy Reward');
  });

  await step('Fill reward description', async () => {
    const rewardDescInput = page.locator('input[name="description"]');
    await rewardDescInput.waitFor({ state: 'visible', timeout: 15_000 });
    await rewardDescInput.click();
    await sleep(500);
    await typeHumanLike(page, 'Get an exclusive gold trophy for your early support!', { min: 60, jitter: 100 });
  });

  await step('Upload reward image', async () => {
    const rewardDropzone = page.locator('#file\\:_r_19_\\:dropzone');
    await rewardDropzone.waitFor({ state: 'visible', timeout: 15_000 });
    await rewardDropzone.scrollIntoViewIfNeeded();
    await sleep(500);

    const rewardImagePath = path.resolve(__dirname, '..', 'assets', 'reward.png');
    const [rewardFileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10_000 }),
      rewardDropzone.click(),
    ]);
    await rewardFileChooser.setFiles(rewardImagePath);
    await sleep(3000);
  });

  await step('Enter reward price (1)', async () => {
    const pricingInput = page.locator('input[name="value"]');
    await pricingInput.waitFor({ state: 'visible', timeout: 15_000 });
    await pricingInput.scrollIntoViewIfNeeded();
    await pricingInput.click();
    await sleep(500);
    await page.keyboard.type('1', { delay: 100 });
  });

  await step('Enter reward quantity (100)', async () => {
    const quantityInput = page.locator('input[name="rewardQuantity"]');
    await quantityInput.waitFor({ state: 'visible', timeout: 15_000 });
    await quantityInput.scrollIntoViewIfNeeded();
    await quantityInput.click();
    await sleep(500);
    await typeHumanLike(page, '100');
  });

  await step('Select item from Item dropdown', async () => {
    await sleep(2000);
    const itemSelect = page.locator('select').filter({ has: page.locator('option') }).last();
    await itemSelect.scrollIntoViewIfNeeded();
    await itemSelect.selectOption({ index: 1 });
  });

  await step('Pick Estimated Delivery date (last available in calendar)', async () => {
    await sleep(2000);
    const dateInput = page.locator('input[placeholder="YYYY-MM-DD"]').first();
    await dateInput.waitFor({ state: 'visible', timeout: 15_000 });
    await dateInput.scrollIntoViewIfNeeded();
    await dateInput.click();
    await sleep(2000);

    const calendarPopover = page.locator('.chakra-popover__content .rdp-root');
    await calendarPopover.waitFor({ state: 'visible', timeout: 10_000 });

    const availableDays = calendarPopover.locator('.rdp-day:not(.rdp-disabled):not(.rdp-hidden) .rdp-day_button');
    const dayCount = await availableDays.count();
    const lastDayBtn = availableDays.nth(dayCount - 1);
    await lastDayBtn.click();
    await sleep(2000);
  });

  await step('Select "Digital Reward" shipping method', async () => {
    const digitalRewardRadio = page.getByText(/digital reward/i);
    await digitalRewardRadio.waitFor({ state: 'visible', timeout: 15_000 });
    await digitalRewardRadio.scrollIntoViewIfNeeded();
    await digitalRewardRadio.click();
  });

  await step('Click "Save" button (reward)', async () => {
    await sleep(2000);
    const saveRewardBtn = page.locator('button[type="submit"]').filter({ hasText: /save/i });
    await saveRewardBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await saveRewardBtn.scrollIntoViewIfNeeded();
    await saveRewardBtn.click();
    await sleep(3000);
  });

  await step('Click "Next: Story" button', async () => {
    const nextStoryBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*story/i });
    await nextStoryBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await nextStoryBtn.scrollIntoViewIfNeeded();
    await nextStoryBtn.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });

  await step('Fill campaign story (Quill editor)', async () => {
    const quillEditor = page.locator('.ql-editor[contenteditable="true"]').first();
    await quillEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await quillEditor.click();
    await sleep(500);
    await typeHumanLike(
      page,
      'This campaign is dedicated to bringing innovative ideas to life. We believe in the power of community-driven projects and aim to deliver exceptional value to our supporters. Join us on this exciting journey and help us make a difference!',
      { min: 30, jitter: 50 }
    );
  });

  await step('Fill risks and challenges', async () => {
    const risksTextarea = page.locator('textarea[name="risks"]');
    await risksTextarea.waitFor({ state: 'visible', timeout: 15_000 });
    await risksTextarea.scrollIntoViewIfNeeded();
    await risksTextarea.click();
    await sleep(500);
    await typeHumanLike(
      page,
      'As with any project, there are inherent risks including potential delays in production timelines and budget constraints. We have planned contingencies and will keep backers informed every step of the way to ensure transparency and accountability.',
      { min: 30, jitter: 50 }
    );
  });

  await step('Fill FAQ question', async () => {
    const faqQuestionInput = page.locator('input[placeholder="Write your question here..."]');
    await faqQuestionInput.waitFor({ state: 'visible', timeout: 15_000 });
    await faqQuestionInput.scrollIntoViewIfNeeded();
    await faqQuestionInput.click();
    await sleep(500);
    await typeHumanLike(page, 'When will I receive my reward?');
  });

  await step('Fill FAQ answer', async () => {
    const faqAnswerTextarea = page.locator('textarea[placeholder="Write your answer here..."]');
    await faqAnswerTextarea.waitFor({ state: 'visible', timeout: 15_000 });
    await faqAnswerTextarea.scrollIntoViewIfNeeded();
    await faqAnswerTextarea.click();
    await sleep(500);
    await typeHumanLike(
      page,
      'Rewards will be delivered within 30 days after the campaign ends. We will provide tracking information and updates throughout the fulfillment process.',
      { min: 30, jitter: 50 }
    );
  });

  await step('Click "+ Add FAQ" button', async () => {
    const addFaqBtn = page.getByRole('button', { name: /add faq/i });
    await addFaqBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await addFaqBtn.scrollIntoViewIfNeeded();
    await addFaqBtn.click();
    await sleep(3000);
  });

  await step('Click "Next: Preview" button', async () => {
    const nextPreviewBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*preview/i });
    await nextPreviewBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await nextPreviewBtn.scrollIntoViewIfNeeded();
    await nextPreviewBtn.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });

  await step('Scroll preview page to bottom', async () => {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('PageDown');
      await sleep(800);
      const atBottom = await page.evaluate(
        () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 10
      );
      if (atBottom) break;
    }
    await sleep(2000);
  });

  await step('Click "Next: Request approval" button', async () => {
    const nextApprovalBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*request approval/i });
    await nextApprovalBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await nextApprovalBtn.scrollIntoViewIfNeeded();
    await nextApprovalBtn.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });

  await step('Fill contact phone number', async () => {
    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.waitFor({ state: 'visible', timeout: 15_000 });
    await phoneInput.scrollIntoViewIfNeeded();
    await phoneInput.click({ clickCount: 3 });
    await sleep(300);
    await page.keyboard.press('Backspace');
    await sleep(500);
    await typeHumanLike(page, '1234567');
  });

  await step('Click "SUBMIT" button', async () => {
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await submitBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();
    await sleep(3000);
  });

  await step('Wait for "Submission Received!" modal', async () => {
    const submissionModal = page.getByText('Submission Received!');
    await submissionModal.waitFor({ state: 'visible', timeout: 30_000 });
  });

  await step('Click "DONE" button on submission modal', async () => {
    const doneBtn = page.getByRole('button', { name: /done/i });
    await doneBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await doneBtn.click();
    await sleep(5000);
  });

  await step('Verify campaign status is "In review"', async () => {
    const inReviewBadge = page.locator('.chakra-badge').filter({ hasText: /in review/i });
    const isInReview = await inReviewBadge.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!isInReview) {
      throw new Error('"In review" badge not visible after campaign submission.');
    }
  });

  return titleText;
}

module.exports = { createCampaign };
