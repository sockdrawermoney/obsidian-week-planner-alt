// src/file.ts

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
                content += `# ${header}\n\n`;
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
     * Inserts content into the file under the specified header.
     * Ensures that the header exists and handles line spacing appropriately.
     * @param text - The todo item to insert.
     * @param header - The header under which to insert the todo.
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
            insertStart = frontMatterMatch[0].split('\n').length;
        }

        // Find the header line (e.g., # Inbox)
        const headerLineIndex = lines.findIndex((line, index) => {
            const trimmed = line.trim();
            return trimmed === `# ${header}` || trimmed === `## ${header}`;
        });

        let insertedLines: number[] = [];
        let headerAdded = false;

        if (headerLineIndex !== -1) {
            // Header exists
            // Find the last todo item under this header
            let lastTodoIndex = headerLineIndex;
            for (let i = headerLineIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
                    lastTodoIndex = i;
                } else if (line.startsWith('#')) {
                    break; // Next header encountered
                }
            }

            // Insert the new todo directly after the last todo
            // Ensure no extra blank lines are added
            lines.splice(lastTodoIndex + 1, 0, text);
            insertedLines.push(lastTodoIndex + 1);

            // Check if there's already an empty line after the last todo
            if (lastTodoIndex + 2 >= lines.length || lines[lastTodoIndex + 2].trim() !== '') {
                lines.splice(lastTodoIndex + 2, 0, ''); // Add an empty line
                insertedLines.push(lastTodoIndex + 2);
            }
        } else {
            // Header does not exist, create it at the top (after frontmatter if present)
            const headerContent = `# ${header}`;
            lines.splice(insertStart, 0, headerContent, text, '');
            insertedLines.push(insertStart, insertStart + 1, insertStart + 2);
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
        const headerText = `# ${header}`;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === headerText) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Deletes a specific line from the file and cleans up the header if necessary.
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

        // Delete the specified line
        if (lines[lineNumber] === lineText) {
            lines.splice(lineNumber, 1);
        } else {
            // If the line text doesn't match, try to find the line
            const index = lines.indexOf(lineText);
            if (index !== -1) {
                lines.splice(index, 1);
            } else {
                console.warn('Line not found in file:', lineText);
                return; // Exit early if the line wasn't found
            }
        }

        // After deletion, check if # Inbox has any remaining todos
        const inboxHeaderIndex = lines.findIndex(line => line.trim() === '# Inbox' || line.trim() === '## Inbox');

        if (inboxHeaderIndex !== -1) {
            // Check for remaining todos under # Inbox
            let hasTodos = false;
            for (let i = inboxHeaderIndex + 1; i < lines.length; i++) {
                const trimmedLine = lines[i].trim();
                if (trimmedLine.startsWith('- [ ]') || trimmedLine.startsWith('- [x]')) {
                    hasTodos = true;
                    break;
                } else if (trimmedLine.startsWith('#')) {
                    // Reached another header; stop searching
                    break;
                }
            }

            if (!hasTodos) {
                // Remove the # Inbox header
                lines.splice(inboxHeaderIndex, 1);

                // Also remove the blank line immediately after the header, if it exists
                if (lines[inboxHeaderIndex] === '') {
                    lines.splice(inboxHeaderIndex, 1);
                }

                console.log(`Removed # Inbox header from ${this.fullFileName} as it has no remaining todos.`);
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
