import { WEEK_PLANNER_BASE_DIR } from "./constants";

export interface WeekPlannerPluginSettings {
  workingDays: string;
  baseDir: string;
  dailyNoteTemplate: string;
  tagBaseFolder: string; // New property
}

export const DEFAULT_SETTINGS: WeekPlannerPluginSettings = {
  workingDays: 'Mon,Tue,Wed,Thu,Fri',
  baseDir: WEEK_PLANNER_BASE_DIR,
  dailyNoteTemplate: '_templates/Daily.md',
  tagBaseFolder: 'Tags', // Default value
};