import { App, EditorPosition, Vault, Editor, Workspace, normalizePath, moment, TFile } from 'obsidian';
import { getDailyNoteSettings } from 'obsidian-daily-notes-interface';
import * as path from 'path';
import { dateString, DATE_FORMAT, isWorkingDay, allDaysValid } from "./date";
import { WeekPlannerPluginSettings } from "./settings";

export default class WeekPlannerFile {
    app: App;
    vault: Vault;
    fullFileName: string;
    settings: WeekPlannerPluginSettings;

    constructor(app: App, settings: WeekPlannerPluginSettings, vault: Vault, fullFileName: string) {
        this.app = app;
        this.settings = settings;
        this.vault = vault;
        this.fullFileName = fullFileName;
    }

    async deleteLine(line: number, s: string, editor: Editor) {
        const from: EditorPosition = { line: line, ch: 0 };

        // Replace trailing newline only if the line to delete isn't the last one
        let delta = 0;
        if (line < editor.lastLine()) {
            delta = path.sep.length;
        }

        const to: EditorPosition = { line: line, ch: s.length + delta };
        editor.replaceRange('', from, to);
    }

    async insertAt(line: string, at: number) {
        const fileContents = await this.getFileContents();
        if (fileContents == undefined) {
            console.log('Could not read file');
            return;
        }

        const todos = fileContents.split('\n');
        todos.splice(at, 0, line);
        await this.updateFile(todos.join('\n'));
    }

    async getFileContents() {
        return await this.vault.adapter.read(this.fullFileName);
    }

    async updateFile(fileContents: string) {
        try {
            return await this.vault.adapter.write(this.fullFileName, fileContents);
        } catch (error) {
            console.log(error);
        }
    }

    async createIfNotExists(vault: Vault, workspace: Workspace, header: string) {
        const fileExists = await vault.adapter.exists(this.fullFileName);
        if (!fileExists) {
            await this.ensureDirectories();
            const templateContent = await this.getDailyNoteTemplateContent();
            let fileContent = '';
            if (templateContent) {
                // Process the template variables
                const processedTemplate = this.processTemplateContent(templateContent);

                // Insert '## Inbox' under the page's header
                const lines = processedTemplate.split('\n');
                let insertIndex = 1; // Default to insert after the first line
                // Find the first header line (starting with '#')
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('#')) {
                        insertIndex = i + 1;
                        break;
                    }
                }
                lines.splice(insertIndex, 0, '## ' + header);
                fileContent = lines.join('\n');
            } else {
                fileContent = '## ' + header;
            }
            await vault.create(this.fullFileName, fileContent);
        }
    }

    async createIfNotExistsAndOpen(vault: Vault, workspace: Workspace, header: string) {
        await this.createIfNotExists(vault, workspace, header);
        await workspace.openLinkText(this.obsidianFile(this.fullFileName), '', false);
    }

    obsidianFile(filename: string) {
        return filename.replace('.md', '');
    }

    isInbox() {
        return this.fullFileName == getInboxFileName(this.settings);
    }

    isYesterday() {
        const d = getYesterdayDate(this.settings.workingDays);
        return this.fullFileName.endsWith(dateString(moment(d)) + '.md');
    }

    async ensureDirectories() {
        const directories = this.fullFileName.split('/');
        let directoryPath = "";
        for (let i = 0; i < directories.length - 1; i++) {
            directoryPath = directoryPath + directories[i] + '/';

            try {
                const normalizedPath = normalizePath(directoryPath);
                const folderExists = await this.vault.adapter.exists(normalizedPath, false);
                if (!folderExists) {
                    await this.vault.createFolder(normalizedPath);
                }
            } catch (error) {
                console.log(error);
            }
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
							console.warn(`Template file not found at path: ${templatePath}`);
					}
			} else {
					console.warn('No template path set for daily notes in plugin settings.');
			}
	
			return null;
		}

    processTemplateContent(templateContent: string): string {
        // Replace template variables (e.g., {{date}}, {{time}}, {{title}})
        let output = templateContent;

        const date = moment();
        output = output.replace(/{{\s*date\s*}}/g, date.format('YYYY-MM-DD'));
        output = output.replace(/{{\s*time\s*}}/g, date.format('HH:mm'));
        output = output.replace(/{{\s*title\s*}}/g, this.fullFileName.replace('.md', ''));

        // Add more replacements as needed
        // Handle custom date formats: {{date:format}}

        const dateFormatRegex = /{{\s*date:(.*?)\s*}}/g;
        output = output.replace(dateFormatRegex, (match, fmt) => date.format(fmt));

        return output;
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