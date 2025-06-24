import { TestInfo } from "@playwright/test";

export class LoggingService {
    static async beforeEach(testInfo: TestInfo) {
        const testName = `\n\n\n\x1b[1m\x1b[36m${testInfo.title}\n\x1b[0m`;
        console.log(testName);
        return testName;
    }

    static async afterEach(testInfo: TestInfo) {
        console.log(`\nTest duration: ${(testInfo.duration / 1000).toFixed(1)} s\n`);

        if (testInfo.error) {
            console.error(`Message: ${testInfo.error.message}\n`);
        }
        return testInfo.error;
    }
};