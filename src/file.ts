import { App, Vault, Editor, Workspace, normalizePath, moment, TFile } from 'obsidian';
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

  /**
   * Inserts content below the YAML frontmatter in the file.
   * If frontmatter exists, inserts after it. Otherwise, inserts at the top.
   * @param text - The text to insert.
   * @param header - The header under which to insert the text (e.g., 'Inbox').
   * @param fileContent - Optional pre-read content of the file.
   * @returns InsertResult indicating inserted line numbers and if a header was added.
   */
  async insertAt(text: string, header: string, fileContent?: string): Promise<InsertResult> {
    const file = this.vault.getAbstractFileByPath(this.fullFileName) as TFile;
    if (!file) {
      console.error(`File not found: ${this.fullFileName}`);
      return { insertedLines: [], headerAdded: false };
    }
    const content = fileContent || (await this.vault.read(file));
    const lines = content.split('\n');

    // Detect YAML frontmatter
    const frontMatterRegex = /^---\n[\s\S]*?\n---\n?/;
    const frontMatterMatch = content.match(frontMatterRegex);
    let insertStart = 0;

    if (frontMatterMatch) {
      // Insert after frontmatter
      insertStart = frontMatterMatch[0].length;
    }

    // Find the header line after frontmatter
    const linesAfterFrontMatter = lines.slice(content.slice(0, insertStart).split('\n').length);
    const headerLineIndexRelative = this.findHeaderLine(linesAfterFrontMatter, header);
    const headerLineIndex = headerLineIndexRelative !== -1 ? headerLineIndexRelative + insertStart : -1;

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
      // Header not found, insert the header, task, and a blank line after frontmatter or at top
      const headerContent = `## ${header}\n${text}\n`;
      if (frontMatterMatch) {
        lines.splice(insertStart, 0, headerContent);
        insertedLines.push(insertStart, insertStart + 1);
      } else {
        lines.unshift('', headerContent);
        insertedLines.push(0, 1, 2); // Lines added at positions 0, 1, 2
      }
      headerAdded = true;
    }

    const newContent = lines.join('\n');
    await this.vault.modify(file, newContent);

    return { insertedLines, headerAdded };
  }

  /**
   * Finds the index of the specified header in the given lines.
   * @param lines - Array of lines to search within.
   * @param header - The header to find (e.g., 'Inbox').
   * @returns The index of the header line, or -1 if not found.
   */
  findHeaderLine(lines: string[], header: string): number {
    const headerText = `## ${header}`;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === headerText) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Deletes a specific line from the file.
   * @param lineNumber - The line number to delete.
   * @param lineText - The exact text of the line to delete.
   * @param editor - The editor instance (unused in this context).
   */
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