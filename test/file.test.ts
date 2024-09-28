// test/file.test.ts
import { DATE_FORMAT } from "../src/date";
import * as Moment from "moment";
import { getDayFileName } from "../src/file";
import { WeekPlannerPluginSettings } from "../src/settings";

jest.mock('obsidian', () => ({
    App: jest.fn().mockImplementation(),
    moment: () => Moment()
}));

test('getDayFileName', () => {
    const settings: WeekPlannerPluginSettings = {
        workingDays: 'Mon,Tue,Wed,Thu,Fri',
        baseDir: 'Daily',
        dailyNoteTemplate: '' // Add this line
    };
    const date = Moment("2022-10-24", DATE_FORMAT).toDate();
    expect(getDayFileName(settings, date)).toBe('Daily/2022-10-24.md');
});