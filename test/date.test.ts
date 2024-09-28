// test/date.test.ts
import { DATE_FORMAT, dateString, isWorkingDay } from "../src/date";
import * as Moment from "moment";

jest.mock('obsidian', () => ({
    App: jest.fn().mockImplementation(),
    moment: () => Moment()
}));

test('isWorkingDay', () => {
    const sun = Moment("2022-10-23", DATE_FORMAT).toDate();
    expect(isWorkingDay(sun, 'Mon,Tue,Wed,Thu,Fri')).toBe(false);
});

test('dateString', () => {
    const sun = Moment("2022-10-23", DATE_FORMAT);
    expect(dateString(sun)).toBe("2022-10-23");

    const mon = sun.add(1, "day");
    expect(dateString(mon)).toBe("2022-10-24");
});