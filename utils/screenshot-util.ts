import { Page, TestInfo } from "@playwright/test";

export async function printViewport(page: Page, testInfo: TestInfo) {
    const projectName = testInfo.project.name;
    await page.screenshot({
        path: `test-screenshots/${`${projectName} | ${testInfo.title}`.replace(/[ |]/g, '_')}.jpg`,
        quality: 25,
    });
}