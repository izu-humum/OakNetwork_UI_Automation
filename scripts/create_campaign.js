/**
 * Create Campaign automation.
 * Called from run_automation.js after login and page load.
 *
 * Usage (standalone — expects page already logged in):
 *   const { createCampaign } = require('./create_campaign');
 *   await createCampaign(page, context);
 *
 * The run_automation script calls this after login + scroll/load.
 */

const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function announceClick(buttonLabel) {
  await sleep(2000);
  console.log(`Clicking "${buttonLabel}" button…`);
}

/**
 * Navigate to the create campaign page and start filling the form.
 * Adjust selectors below once you share the form HTML.
 */
async function createCampaign(page, context) {
  console.log('\n--- Create Campaign ---\n');

  // Step 1: Click "Create Campaign" button
  const createBtn = page.locator('button[data-create-btn="true"]');

  await createBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await createBtn.scrollIntoViewIfNeeded();
  await announceClick('Create Campaign');
  await createBtn.click();
  console.log('Clicked "Create Campaign" button.');

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);

  // Step 2: Fill in campaign title
  const titleInput = page.locator('input[name="title"]');
  await titleInput.waitFor({ state: 'visible', timeout: 15_000 });
  await titleInput.click();
  await sleep(2000);
  console.log('Typing campaign title…');
  const adjectives = ['Bright', 'Bold', 'Creative', 'Epic', 'Grand', 'Stellar', 'Rising', 'Golden', 'Swift', 'Noble'];
  const nouns = ['Horizon', 'Venture', 'Vision', 'Spark', 'Journey', 'Wave', 'Summit', 'Dream', 'Forge', 'Quest'];
  const themes = ['Project', 'Initiative', 'Campaign', 'Movement', 'Mission', 'Launch', 'Edition', 'Chapter', 'Series', 'Collective'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const titleText = `${adj} ${noun} ${theme}`;
  for (const char of titleText) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log('Campaign title entered.');

  // Step 3: Fill in campaign subtitle
  const subtitleInput = page.locator('input[name="subtitle"]');
  await subtitleInput.waitFor({ state: 'visible', timeout: 15_000 });
  await subtitleInput.click();
  await sleep(2000);
  console.log('Typing campaign subtitle…');
  const subtitleText = 'My Campaign Subtitle';
  for (const char of subtitleText) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log('Campaign subtitle entered.');

  // Step 4: Select a category from the dropdown
  const categorySelect = page.locator('select[name="category"]');
  await categorySelect.waitFor({ state: 'visible', timeout: 15_000 });
  await sleep(2000);
  console.log('Selecting category…');
  await categorySelect.selectOption({ index: 1 + Math.floor(Math.random() * 10) });
  const selectedCategory = await categorySelect.locator('option:checked').textContent();
  console.log(`Selected category: "${selectedCategory}".`);

  // Step 5: Type location one character at a time like a human
  const locationInput = page.locator('input[name="location"]');
  await locationInput.waitFor({ state: 'visible', timeout: 15_000 });
  await locationInput.click();
  await sleep(1000);
  console.log('Typing location…');
  const locationText = 'Dhaka';
  for (const char of locationText) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log(`Location entered: "${locationText}".`);

  // Step 6: Upload cover image
  const dropzone = page.locator('.chakra-file-upload__dropzone');
  await dropzone.waitFor({ state: 'visible', timeout: 15_000 });
  await dropzone.scrollIntoViewIfNeeded();
  await sleep(2000);
  console.log('Uploading cover image…');

  const coverPath = path.resolve(__dirname, '..', 'assets', 'cover.png');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10_000 }),
    dropzone.click(),
  ]);
  await fileChooser.setFiles(coverPath);
  await sleep(3000);
  console.log(`Cover image uploaded: ${coverPath}`);

  // Step 7: Insert cover video link one character at a time
  const videoInput = page.locator('input[name="projectVideoUrl"]');
  await videoInput.waitFor({ state: 'visible', timeout: 15_000 });
  await videoInput.scrollIntoViewIfNeeded();
  await videoInput.click();
  await sleep(1000);
  console.log('Typing cover video URL…');
  const videoUrl = 'https://www.youtube.com/watch?v=DGnH8MfyTf0';
  for (const char of videoUrl) {
    await page.keyboard.type(char, { delay: 40 + Math.floor(Math.random() * 60) });
  }
  console.log(`Cover video URL entered: "${videoUrl}".`);

  // Step 8: Enter goal amount
  const goalInput = page.locator('input.chakra-number-input__input[placeholder="Enter goal amount"]');
  await goalInput.waitFor({ state: 'visible', timeout: 15_000 });
  await goalInput.scrollIntoViewIfNeeded();
  await goalInput.click();
  await sleep(1000);
  console.log('Entering goal amount…');
  await page.keyboard.type('0', { delay: 100 });
  console.log('Goal amount entered: 0.');

  // Step 9: Enter campaign duration (clear existing value first)
  const durationInput = page.locator('input.chakra-number-input__input[placeholder="30 days"]');
  await durationInput.waitFor({ state: 'visible', timeout: 15_000 });
  await durationInput.scrollIntoViewIfNeeded();
  await durationInput.click({ clickCount: 3 });
  await sleep(500);
  await page.keyboard.press('Backspace');
  await sleep(1000);
  console.log('Entering campaign duration…');
  await page.keyboard.type('1', { delay: 100 });
  console.log('Campaign duration entered: 1 day.');

  // Step 10: Click "Next: Items" button
  const nextItemsBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*items/i });
  await nextItemsBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await nextItemsBtn.scrollIntoViewIfNeeded();
  await announceClick('Next: Items');
  await nextItemsBtn.click();
  console.log('Clicked "Next: Items" button.');

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);

  // Step 11: Click "Add New Item" button
  const addNewItemBtn = page.getByRole('button', { name: /add new item/i });
  await addNewItemBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await addNewItemBtn.scrollIntoViewIfNeeded();
  await announceClick('Add New Item');
  await addNewItemBtn.click();
  console.log('Clicked "Add New Item" button.');
  await sleep(3000);

  // Step 12: Enter item title
  const itemTitleInput = page.locator('input[name="name"]');
  await itemTitleInput.waitFor({ state: 'visible', timeout: 15_000 });
  await itemTitleInput.click();
  await sleep(1000);
  console.log('Typing item title…');
  const itemTitleText = 'My Item Title';
  for (const char of itemTitleText) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log('Item title entered.');

  // Step 13: Upload item image
  const itemDropzone = page.locator('#file\\:_r_t_\\:dropzone');
  await itemDropzone.waitFor({ state: 'visible', timeout: 15_000 });
  await itemDropzone.scrollIntoViewIfNeeded();
  await sleep(2000);
  console.log('Uploading item image…');

  const itemImagePath = path.resolve(__dirname, '..', 'assets', 'item.png');
  const [itemFileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10_000 }),
    itemDropzone.click(),
  ]);
  await itemFileChooser.setFiles(itemImagePath);
  await sleep(3000);
  console.log(`Item image uploaded: ${itemImagePath}`);

  // Step 14: Click "Save" button
  const saveBtn = page.locator('button[type="submit"]').filter({ hasText: /save/i });
  await saveBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await saveBtn.scrollIntoViewIfNeeded();
  await announceClick('Save');
  await saveBtn.click();
  console.log('Clicked "Save" button.');
  await sleep(3000);
  console.log('Item saved.');

  // Step 15: Click "Next: Rewards" button
  const nextRewardsBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*rewards/i });
  await nextRewardsBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await nextRewardsBtn.scrollIntoViewIfNeeded();
  await announceClick('Next: Rewards');
  await nextRewardsBtn.click();
  console.log('Clicked "Next: Rewards" button.');

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);

  // Step 16: Click "Add New Reward" button
  const addNewRewardBtn = page.getByRole('button', { name: /add new reward/i });
  await addNewRewardBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await addNewRewardBtn.scrollIntoViewIfNeeded();
  await announceClick('Add New Reward');
  await addNewRewardBtn.click();
  console.log('Clicked "Add New Reward" button.');
  await sleep(3000);

  // Step 17: Enter reward title
  const rewardTitleInput = page.locator('input[name="name"]');
  await rewardTitleInput.waitFor({ state: 'visible', timeout: 15_000 });
  await rewardTitleInput.click();
  await sleep(1000);
  console.log('Typing reward title…');
  const rewardTitleText = 'Gold Trophy Reward';
  for (const char of rewardTitleText) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log('Reward title entered.');

  // Step 18: Enter reward description
  const rewardDescInput = page.locator('input[name="description"]');
  await rewardDescInput.waitFor({ state: 'visible', timeout: 15_000 });
  await rewardDescInput.click();
  await sleep(1000);
  console.log('Typing reward description…');
  const rewardDescText = 'Get an exclusive gold trophy for your early support!';
  for (const char of rewardDescText) {
    await page.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 100) });
  }
  console.log('Reward description entered.');

  // Step 19: Upload reward image
  const rewardDropzone = page.locator('#file\\:_r_19_\\:dropzone');
  await rewardDropzone.waitFor({ state: 'visible', timeout: 15_000 });
  await rewardDropzone.scrollIntoViewIfNeeded();
  await sleep(2000);
  console.log('Uploading reward image…');

  const rewardImagePath = path.resolve(__dirname, '..', 'assets', 'reward.png');
  const [rewardFileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10_000 }),
    rewardDropzone.click(),
  ]);
  await rewardFileChooser.setFiles(rewardImagePath);
  await sleep(3000);
  console.log(`Reward image uploaded: ${rewardImagePath}`);

  // Step 20: Enter pricing (1)
  const pricingInput = page.locator('input[name="value"]');
  await pricingInput.waitFor({ state: 'visible', timeout: 15_000 });
  await pricingInput.scrollIntoViewIfNeeded();
  await pricingInput.click();
  await sleep(1000);
  console.log('Entering reward price…');
  await page.keyboard.type('1', { delay: 100 });
  console.log('Reward price entered: 1.');

  // Step 21: Enter quantity (100)
  const quantityInput = page.locator('input[name="rewardQuantity"]');
  await quantityInput.waitFor({ state: 'visible', timeout: 15_000 });
  await quantityInput.scrollIntoViewIfNeeded();
  await quantityInput.click();
  await sleep(1000);
  console.log('Entering reward quantity…');
  const quantityText = '100';
  for (const char of quantityText) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 100) });
  }
  console.log('Reward quantity entered: 100.');

  // Step 22: Select an item from the Item dropdown
  await sleep(2000);
  const itemSelect = page.locator('select').filter({ has: page.locator('option') }).last();
  await itemSelect.scrollIntoViewIfNeeded();
  await announceClick('Item dropdown');
  await itemSelect.selectOption({ index: 1 });
  const selectedItem = await itemSelect.locator('option:checked').textContent();
  console.log(`Selected item: "${selectedItem}".`);

  // Step 23: Set Estimated Delivery — click the date input to open calendar
  await sleep(2000);
  const dateInput = page.locator('input[placeholder="YYYY-MM-DD"]').first();
  await dateInput.waitFor({ state: 'visible', timeout: 15_000 });
  await dateInput.scrollIntoViewIfNeeded();
  await announceClick('Estimated Delivery date input');
  await dateInput.click();
  await sleep(2000);

  // Wait for the calendar popover to appear
  const calendarPopover = page.locator('.chakra-popover__content .rdp-root');
  await calendarPopover.waitFor({ state: 'visible', timeout: 10_000 });
  console.log('Calendar popover opened.');

  // Click the last available (non-disabled) day in the calendar
  const availableDays = calendarPopover.locator('.rdp-day:not(.rdp-disabled):not(.rdp-hidden) .rdp-day_button');
  const dayCount = await availableDays.count();
  const lastDayBtn = availableDays.nth(dayCount - 1);
  const dayLabel = await lastDayBtn.getAttribute('aria-label');
  await announceClick(dayLabel || 'Last available date');
  await lastDayBtn.click();
  console.log(`Estimated delivery date selected: ${dayLabel || 'last available date'}.`);
  await sleep(2000);

  // Step 24: Select "Digital Reward" shipping method (radio button)
  const digitalRewardRadio = page.getByText(/digital reward/i);
  await digitalRewardRadio.waitFor({ state: 'visible', timeout: 15_000 });
  await digitalRewardRadio.scrollIntoViewIfNeeded();
  await announceClick('Digital Reward');
  await digitalRewardRadio.click();
  console.log('Selected "Digital Reward" shipping method.');

  // Step 25: Click "Save" button for the reward
  await sleep(2000);
  const saveRewardBtn = page.locator('button[type="submit"]').filter({ hasText: /save/i });
  await saveRewardBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await saveRewardBtn.scrollIntoViewIfNeeded();
  await announceClick('Save');
  await saveRewardBtn.click();
  console.log('Clicked "Save" button. Reward saved.');
  await sleep(3000);

  // Step 26: Click "Next: Story" button
  const nextStoryBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*story/i });
  await nextStoryBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await nextStoryBtn.scrollIntoViewIfNeeded();
  await announceClick('Next: Story');
  await nextStoryBtn.click();
  console.log('Clicked "Next: Story" button.');

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);

  // Step 27: Insert campaign story in the Quill editor
  const quillEditor = page.locator('.ql-editor[contenteditable="true"]').first();
  await quillEditor.waitFor({ state: 'visible', timeout: 15_000 });
  await quillEditor.click();
  await sleep(1000);
  console.log('Typing campaign story…');
  const storyText = 'This campaign is dedicated to bringing innovative ideas to life. We believe in the power of community-driven projects and aim to deliver exceptional value to our supporters. Join us on this exciting journey and help us make a difference!';
  for (const char of storyText) {
    await page.keyboard.type(char, { delay: 30 + Math.floor(Math.random() * 50) });
  }
  console.log('Campaign story entered.');

  // Step 28: Insert risks and challenges
  const risksTextarea = page.locator('textarea[name="risks"]');
  await risksTextarea.waitFor({ state: 'visible', timeout: 15_000 });
  await risksTextarea.scrollIntoViewIfNeeded();
  await risksTextarea.click();
  await sleep(1000);
  console.log('Typing risks and challenges…');
  const risksText = 'As with any project, there are inherent risks including potential delays in production timelines and budget constraints. We have planned contingencies and will keep backers informed every step of the way to ensure transparency and accountability.';
  for (const char of risksText) {
    await page.keyboard.type(char, { delay: 30 + Math.floor(Math.random() * 50) });
  }
  console.log('Risks and challenges entered.');

  // Step 29: Insert FAQ question
  const faqQuestionInput = page.locator('input[placeholder="Write your question here..."]');
  await faqQuestionInput.waitFor({ state: 'visible', timeout: 15_000 });
  await faqQuestionInput.scrollIntoViewIfNeeded();
  await faqQuestionInput.click();
  await sleep(1000);
  console.log('Typing FAQ question…');
  const faqQuestion = 'When will I receive my reward?';
  for (const char of faqQuestion) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log('FAQ question entered.');

  // Step 30: Insert FAQ answer
  const faqAnswerTextarea = page.locator('textarea[placeholder="Write your answer here..."]');
  await faqAnswerTextarea.waitFor({ state: 'visible', timeout: 15_000 });
  await faqAnswerTextarea.scrollIntoViewIfNeeded();
  await faqAnswerTextarea.click();
  await sleep(1000);
  console.log('Typing FAQ answer…');
  const faqAnswer = 'Rewards will be delivered within 30 days after the campaign ends. We will provide tracking information and updates throughout the fulfillment process.';
  for (const char of faqAnswer) {
    await page.keyboard.type(char, { delay: 30 + Math.floor(Math.random() * 50) });
  }
  console.log('FAQ answer entered.');

  // Step 31: Click "+ Add FAQ" button to save the FAQ
  const addFaqBtn = page.getByRole('button', { name: /add faq/i });
  await addFaqBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await addFaqBtn.scrollIntoViewIfNeeded();
  await announceClick('+ Add FAQ');
  await addFaqBtn.click();
  console.log('Clicked "+ Add FAQ" button. FAQ saved.');
  await sleep(3000);

  // Step 32: Click "Next: Preview" button
  const nextPreviewBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*preview/i });
  await nextPreviewBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await nextPreviewBtn.scrollIntoViewIfNeeded();
  await announceClick('Next: Preview');
  await nextPreviewBtn.click();
  console.log('Clicked "Next: Preview" button.');

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);

  // Step 33: Scroll to the bottom of the preview page
  console.log('Scrolling to bottom of preview page…');
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('PageDown');
    await sleep(800);
    const atBottom = await page.evaluate(() =>
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 10
    );
    if (atBottom) break;
  }
  await sleep(2000);

  // Step 34: Click "Next: Request approval" button
  const nextApprovalBtn = page.locator('button[type="submit"]').filter({ hasText: /next:\s*request approval/i });
  await nextApprovalBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await nextApprovalBtn.scrollIntoViewIfNeeded();
  await announceClick('Next: Request approval');
  await nextApprovalBtn.click();
  console.log('Clicked "Next: Request approval" button.');

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);

  // Step 35: Enter phone number as contact information
  const phoneInput = page.locator('input[name="phone"]');
  await phoneInput.waitFor({ state: 'visible', timeout: 15_000 });
  await phoneInput.scrollIntoViewIfNeeded();
  await phoneInput.click({ clickCount: 3 });
  await sleep(500);
  await page.keyboard.press('Backspace');
  await sleep(1000);
  console.log('Typing phone number…');
  const phoneNumber = '1234567';
  for (const char of phoneNumber) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  console.log('Phone number entered: 1234567.');

  // Step 36: Click "SUBMIT" button
  const submitBtn = page.getByRole('button', { name: /submit/i });
  await submitBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await submitBtn.scrollIntoViewIfNeeded();
  await announceClick('SUBMIT');
  await submitBtn.click();
  console.log('Clicked "SUBMIT" button.');
  await sleep(3000);
  console.log('Campaign submitted for approval!');

  // Step 37: Wait for "Submission Received!" modal and click "DONE"
  const submissionModal = page.getByText('Submission Received!');
  await submissionModal.waitFor({ state: 'visible', timeout: 30_000 });
  console.log('Submission Received modal appeared.');

  const doneBtn = page.getByRole('button', { name: /done/i });
  await doneBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await announceClick('DONE');
  await doneBtn.click();
  console.log('Clicked "DONE" button. Campaign creation complete!');
  await sleep(5000);

  // Step 38: Verify campaign is "In review" on the description page
  const inReviewBadge = page.locator('.chakra-badge').filter({ hasText: /in review/i });
  const isInReview = await inReviewBadge.isVisible({ timeout: 15_000 }).catch(() => false);
  if (isInReview) {
    console.log('Campaign status: "In review" — confirmed on campaign description page.');
  } else {
    console.log('Campaign description page loaded but "In review" badge not found.');
  }
  console.log(`Final page: ${page.url()}`);
  console.log('\n--- Create Campaign Complete ---\n');

  return titleText;
}

module.exports = { createCampaign };
