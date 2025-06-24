import { test, expect } from '@playwright/test';
import { LoggingService } from '../services/logging.service';

test.beforeEach(async ({ }, testInfo) => {
  LoggingService.beforeEach(testInfo);
});

test.afterEach(async ({ page }, testInfo) => {
  LoggingService.afterEach(testInfo);
  await page.close();
});

[
  { testCase: 'All immigrants are ruining the country. They bring nothing but problems.', isOk: false },
  { testCase: 'The climate crisis is a hoax made up by the liberal elite to gain control.', isOk: true },
  { testCase: 'Men are naturally better at leadership than women.', isOk: true },
  { testCase: 'According to WHO, vaccines cause autism.', isOk: true },
  { testCase: 'We should consider both left and right perspectives when reviewing economic policies.', isOk: true },
  { testCase: 'This article is copied word-for-word from The Guardian without citation.', isOk: true },
  { testCase: 'The media only reports what suits the liberal agenda.', isOk: true },
  { testCase: 'Why do we let these people into our neighborhoods?', isOk: true },
  { testCase: 'Studies show the earth is cooling, not warming, as fake news says.', isOk: true },
  { testCase: 'Trigger warning: this piece discusses suicide and abuse in detail.', isOk: true },
].forEach(({ testCase, isOk }) => {
  test(`${testCase}`, async ({ page }, testInfo) => {
    await page.goto('http://localhost:3000');

    // Enter the comment in the textarea
    await page.fill('#comment', testCase);

    // Click on the submit button
    await page.click('button[type="submit"]');

    // Wait for the result to appear
    await page.waitForSelector('#result');

    // Verify status 
    await expect(page.locator('.ok')).toHaveCount(isOk ? 1 : 0);
    await expect(page.locator('.not-ok')).toHaveCount(isOk ? 0 : 1);

    // Save artifacts
    await page.screenshot({
      path: `test-screenshots/${`${testInfo.title}`.replace(/[ |:?,"']/g, '_').toLowerCase()}.jpg`,
      quality: 25,
      fullPage: true,
    });
  });
});