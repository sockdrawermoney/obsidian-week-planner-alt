import { App, EditorPosition, Vault, Editor, Workspace, normalizePath, moment, TFile } from 'obsidian';
import { getDailyNoteSettings } from 'obsidian-daily-notes-interface';
import * as path from 'path';
import { dateString, DATE_FORMAT, isWorkingDay, allDaysValid } from "./date";
import { WeekPlannerPluginSettings } from "./settings";

interface InsertResult {
  insertedLines: number[];
  headerAdded: boolean;
}

export default class WeekPlannerFile {
  public readonly fullFileName: string;
  public readonly settings: WeekPlannerPluginSettings;

  constructor(
    private app: App,
    settings: WeekPlannerPluginSettings,
    private vault: Vault,
    fullFileName: string
  ) {
    this.fullFileName = normalizePath(fullFileName);
    this.settings = settings;
  }

  async createIfNotExists(vault: Vault, workspace: Workspace, header: string) {
    const fileExists = await vault.adapter.exists(this.fullFileName);
    if (!fileExists) {
      let content = '';
      // If daily note template is specified, use it
      if (this.settings.dailyNoteTemplate) {
        const templateContent = await this.getDailyNoteTemplateContent();
        if (templateContent) {
          content += templateContent + '\n';
        }
      }
      if (header) {
        content += `## ${header}\n\n`;
      }
      await vault.create(this.fullFileName, content);
    }
  }

  async createIfNotExistsAndOpen(vault: Vault, workspace: Workspace, header: string) {
    await this.createIfNotExists(vault, workspace, header);
    const file = this.app.vault.getAbstractFileByPath(this.fullFileName);
    if (file instanceof TFile) {
      workspace.openLinkText(this.fullFileName, '', true);
    }
  }

  async getDailyNoteTemplateContent(): Promise<string | null> {
    const templatePath = this.settings.dailyNoteTemplate;

    if (templatePath) {
      const normalizedTemplatePath = normalizePath(templatePath);
      const templateFile = this.vault.getAbstractFileByPath(normalizedTemplatePath);

      if (templateFile && templateFile instanceof TFile) {
        // Read and return the template content
        return await this.vault.read(templateFile);
      } else {
        console.warn(`Template file not found at path: ${normalizedTemplatePath}`);
      }
    } else {
      console.warn('No template path set for daily notes in plugin settings.');
    }

    return null;
  }

  async insertAt(text: string, header: string, fileContent?: string): Promise<InsertResult> {
    const file = this.vault.getAbstractFileByPath(this.fullFileName) as TFile;
    if (!file) {
      console.error(`File not found: ${this.fullFileName}`);
      return { insertedLines: [], headerAdded: false };
    }
    const content = fileContent || (await this.vault.read(file));
    const lines = content.split('\n');
  
    const headerLineIndex = this.findHeaderLine(lines, header);
    let insertedLines: number[] = [];
    let headerAdded = false;
  
    if (headerLineIndex !== -1) {
      // Header found, insert immediately after the header line
      let insertPosition = headerLineIndex + 1;
  
      // Remove any blank lines between the header and tasks
      while (insertPosition < lines.length && lines[insertPosition].trim() === '') {
        lines.splice(insertPosition, 1);
      }
  
      // Insert the task and a blank line
      lines.splice(insertPosition, 0, text, '');
      insertedLines.push(insertPosition, insertPosition + 1);
    } else {
      // Header not found, insert the header, task, and a blank line at the top
      lines.unshift('', text, `## ${header}`);
      insertedLines.push(0, 1, 2); // Lines added at positions 0, 1, 2
      headerAdded = true;
    }
  
    const newContent = lines.join('\n');
    await this.vault.modify(file, newContent);
  
    return { insertedLines, headerAdded };
  }

  findHeaderLine(lines: string[], header: string): number {
    const headerText = `## ${header}`;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === headerText) {
        return i;
      }
    }
    return -1;
  }

  async deleteLine(lineNumber: number, lineText: string, editor: any) {
    const file = this.vault.getAbstractFileByPath(this.fullFileName) as TFile;
    if (!file) {
      console.error(`File not found: ${this.fullFileName}`);
      return;
    }
    const content = await this.vault.read(file);
    const lines = content.split('\n');

    if (lines[lineNumber] === lineText) {
      lines.splice(lineNumber, 1);
    } else {
      // If the line text doesn't match, try to find the line
      const index = lines.indexOf(lineText);
      if (index !== -1) {
        lines.splice(index, 1);
      } else {
        console.warn('Line not found in file:', lineText);
      }
    }

    const newContent = lines.join('\n');
    await this.vault.modify(file, newContent);
  }
}

export function extendFileName(settings: WeekPlannerPluginSettings, filename?: string) {
    if (filename == 'Inbox.md') {
        return settings.baseDir + '/' + 'Inbox.md';
    } else {
        return settings.baseDir + '/' + filename;
    }
}

export function getInboxFileName(settings: WeekPlannerPluginSettings) {
    return settings.baseDir + '/' + 'Inbox.md';
}

export function getDayFileName(settings: WeekPlannerPluginSettings, date: Date) {
    return settings.baseDir + '/' + dateString(moment(date)) + '.md';
}

export function getDateFromFilename(filename: string): moment.Moment {
    if (!filename) {
        return moment();
    }
    const parts = filename.split('/');
    const dateString = parts[parts.length - 1].replace('.md', '');
    return moment(dateString, DATE_FORMAT).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
}

export function getNextWorkingDay(workingDays: string, fromDate?: moment.Moment) {
    let date = fromDate ? fromDate.clone() : moment();
    do {
        date.add(1, 'days');
    } while (!isWorkingDay(date.toDate(), workingDays));
    return date.toDate();
}

export function getTomorrowDate(workingDays: string, date?: moment.Moment) {
    let today = date !== undefined ? date.clone() : moment();
    let tomorrow = today.clone();
    do {
        tomorrow.add(1, 'days');
    } while (!isWorkingDay(tomorrow.toDate(), workingDays));
    return tomorrow.toDate();
}

export function getYesterdayDate(workingDays: string) {
    let date = moment().subtract(1, 'days');
    while (!isWorkingDay(date.toDate(), workingDays)) {
        date.subtract(1, 'days');
    }
    return date.toDate();
}

export function isValidWorkingDaysString(value: string) {
    if (value == undefined || value.trim() == '') {
        console.log("Working day string undefined or empty");
        return false;
    }

    return allDaysValid(value.split(','));
}