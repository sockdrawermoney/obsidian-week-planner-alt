// main.ts
import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, moment, TFile } from 'obsidian';
import * as chrono from 'chrono-node';
import WeekPlannerFile, {
    extendFileName,
    getInboxFileName,
    getDayFileName,
    getDateFromFilename,
    getTomorrowDate,
    getYesterdayDate,
    getNextWorkingDay,
    isValidWorkingDaysString,
} from "./src/file";
import { TODO_DONE_PREFIX, TODO_PREFIX } from "./src/constants";
import { TodoModal } from "./src/todo-modal";
import { DEFAULT_SETTINGS, WeekPlannerPluginSettings } from "./src/settings";
import { TaskAction } from "./src/actions";

// noinspection JSUnusedGlobalSymbols
export default class WeekPlannerPlugin extends Plugin {
    settings: WeekPlannerPluginSettings;
    undoStack: TaskAction[] = []; // Undo stack for task movements

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'week-planner-inbox',
            name: 'Show Inbox',
            callback: () => this.createInbox(),
            hotkeys: []
        });

        this.addCommand({
            id: 'week-planner-today',
            name: 'Show Today',
            callback: () => this.createToday(),
            hotkeys: []
        });

        this.addCommand({
            id: 'week-planner-yesterday',
            name: 'Show Yesterday',
            callback: () => this.createYesterday(),
            hotkeys: []
        });

        this.addCommand({
            id: 'week-planner-tomorrow',
            name: 'Show Tomorrow',
            callback: () => this.createTomorrow(),
            hotkeys: []
        });

        this.addCommand({
            id: 'move-task',
            name: 'Move Task',
            editorCallback: (editor: Editor) => {
                this.moveTask(editor);
            }
        });

        this.addCommand({
            id: 'move-to-inbox',
            name: 'Move to Inbox',
            editorCallback: (editor: Editor) => {
                this.moveTaskToInbox(editor);
            }
        });

        this.addCommand({
            id: 'move-anywhere',
            name: 'Move anywhere',
            editorCallback: (editor: Editor) => {
                this.moveAnywhere(editor);
            }
        });

        this.addCommand({
            id: 'undo-last-task-movement',
            name: 'Undo Last Task Movement',
            callback: () => {
                this.undoLastAction();
            }
        });

        this.addSettingTab(new WeekPlannerSettingTab(this.app, this));
    }

    async insertIntoTargetDate(date: Date, todo: string) {
        let targetDateFile = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, date));
        await targetDateFile.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox');
        await targetDateFile.insertAt(todo, 'Inbox');
    }

    async insertIntoInbox(todo: string) {
        let inbox = new WeekPlannerFile(this.app, this.settings, this.app.vault, getInboxFileName(this.settings));
        await inbox.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox');
        await inbox.insertAt(todo, 'Inbox');
    }

    async insertIntoTomorrow(todo: string) {
        let tomorrow = getTomorrowDate(this.settings.workingDays);
        let dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, tomorrow));
        await dest.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox');
        await dest.insertAt(todo, 'Inbox');
    }

    async createInbox() {
        let file = new WeekPlannerFile(this.app, this.settings, this.app.vault, getInboxFileName(this.settings));
        await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox');
    }

    async createToday() {
        let date = new Date();
        let file = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, date));
        await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox');
    }

    async createTomorrow() {
        let date = getTomorrowDate(this.settings.workingDays);
        let file = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, date));
        await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox');
    }

    async createYesterday() {
        let date = getYesterdayDate(this.settings.workingDays);
        let file = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, date));
        await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox');
    }

    async moveTask(editor: Editor) {
        const line = editor.getCursor().line;
        let taskContent = editor.getLine(line);

        if (taskContent.startsWith(TODO_PREFIX) || taskContent.startsWith(TODO_DONE_PREFIX)) {
            new TodoModal(
                this.app,
                async (date: Date) => {
                    const sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name);
                    const source = new WeekPlannerFile(this.app, this.settings, this.app.vault, sourceFileName);

                    const dest = new WeekPlannerFile(
                        this.app,
                        this.settings,
                        this.app.vault,
                        getDayFileName(this.settings, date)
                    );
                    await this.move(editor, source, dest, 'Inbox');
                }
            ).open();
        }
    }

    async move(editor: Editor, source: WeekPlannerFile, dest: WeekPlannerFile, header: string) {
        const line = editor.getCursor().line;
        let taskContent = editor.getLine(line);

        if (taskContent.startsWith(TODO_PREFIX) || taskContent.startsWith(TODO_DONE_PREFIX)) {
            // Delete the task from the source file
            await source.deleteLine(line, taskContent, editor);

            // Check if moving within the same file
            const movingWithinSameFile = source.fullFileName === dest.fullFileName;

            // Insert the task into the destination file under the specified header
            if (movingWithinSameFile) {
                // Read updated content after deletion
                const file = this.app.vault.getAbstractFileByPath(dest.fullFileName) as TFile;
                const content = await this.app.vault.read(file);
                await dest.insertAt(taskContent, header, content);
            } else {
                await dest.createIfNotExists(this.app.vault, this.app.workspace, header);
                await dest.insertAt(taskContent, header);
            }

            // Record the action in the undo stack
            this.undoStack.push({
                sourceFile: source.fullFileName,
                destFile: dest.fullFileName,
                taskContent: taskContent,
                sourceLine: line,
            });

            // Optional: Limit the undo stack size
            if (this.undoStack.length > 50) {
                this.undoStack.shift();
            }
        }
    }

    async moveTaskToInbox(editor: Editor) {
        const line = editor.getCursor().line;
        let taskContent = editor.getLine(line);

        if (taskContent.startsWith(TODO_PREFIX) || taskContent.startsWith(TODO_DONE_PREFIX)) {
            const sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name);
            const source = new WeekPlannerFile(this.app, this.settings, this.app.vault, sourceFileName);
            const dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, getInboxFileName(this.settings));

            await this.move(editor, source, dest, 'Inbox');
        }
    }

    async moveAnywhere(editor: Editor) {
        const line = editor.getCursor().line;
        let taskContent = editor.getLine(line);

        if (taskContent.startsWith(TODO_PREFIX) || taskContent.startsWith(TODO_DONE_PREFIX)) {
            new TodoModal(
                this.app,
                async (date: Date) => {
                    const sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name);
                    const source = new WeekPlannerFile(this.app, this.settings, this.app.vault, sourceFileName);

                    const dest = new WeekPlannerFile(
                        this.app,
                        this.settings,
                        this.app.vault,
                        getDayFileName(this.settings, date)
                    );
                    await this.move(editor, source, dest, 'Inbox');
                }
            ).open();
        }
    }

    async undoLastAction() {
        if (this.undoStack.length === 0) {
            new Notice('No actions to undo.');
            return;
        }

        const lastAction = this.undoStack.pop();

        if (!lastAction) {
            new Notice('Failed to retrieve the last action.');
            return;
        }

        const { sourceFile, destFile, taskContent, sourceLine } = lastAction;

        // Remove the task from the destination file
        const destFileObj = this.app.vault.getAbstractFileByPath(destFile) as TFile;
        if (!destFileObj) {
            new Notice('Destination file not found.');
            return;
        }

        let destContent = await this.app.vault.read(destFileObj);
        let destLines = destContent.split('\n');
        const taskIndex = destLines.indexOf(taskContent);

        if (taskIndex === -1) {
            new Notice('Task not found in destination file.');
            return;
        }

        destLines.splice(taskIndex, 1);
        await this.app.vault.modify(destFileObj, destLines.join('\n'));

        // Insert the task back into the source file at the original line
        const sourceFileObj = this.app.vault.getAbstractFileByPath(sourceFile) as TFile;
        if (!sourceFileObj) {
            new Notice('Source file not found.');
            return;
        }

        let sourceContent = await this.app.vault.read(sourceFileObj);
        let sourceLines = sourceContent.split('\n');
        sourceLines.splice(sourceLine, 0, taskContent);
        await this.app.vault.modify(sourceFileObj, sourceLines.join('\n'));

        new Notice('Undo successful.');
    }

    onunload() {
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class WeekPlannerSettingTab extends PluginSettingTab {
    plugin: WeekPlannerPlugin;

    constructor(app: App, plugin: WeekPlannerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Settings for Week Planner plugin.' });

        new Setting(containerEl)
            .setName('Daily Note Template')
            .setDesc('Path to the template file for daily notes.')
            .addText(text => text
                .setPlaceholder('_templates/Daily')
                .setValue(this.plugin.settings.dailyNoteTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.dailyNoteTemplate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Working Days')
            .setDesc('Weekdays that should be considered when stepping between days or shifting tasks to the next working day. Format: Mon,Tue,Wed,Thu,Fri,Sat,Sun')
            .addText(text => text
                .setPlaceholder('Mon,Tue,Wed,Thu,Fri')
                .setValue(this.plugin.settings.workingDays)
                .onChange(async (value) => {
                    value = validateOrDefault(value);
                    this.plugin.settings.workingDays = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Base directory')
            .setDesc("Week planner's root directory. Will be created if it doesn't exist.")
            .addText(text => text
                .setPlaceholder('Daily')
                .setValue(this.plugin.settings.baseDir)
                .onChange(async (value) => {
                    value = validateDirectoryOrDefault(value, DEFAULT_SETTINGS.baseDir).trim();
                    this.plugin.settings.baseDir = value;
                    await this.plugin.saveSettings();
                }));

        const div = containerEl.createEl('div', {
            cls: 'advanced-tables-donation',
        });

        const donateText = document.createElement('p');
        donateText.appendText(
            'If this plugin adds value for you and you would like to help support ' +
            'continued development, please use the button below:',
        );
        div.appendChild(donateText);

        const parser = new DOMParser();

        div.appendChild(
            createDonateButton(
                'https://paypal.me/ralfwirdemann',
                parser.parseFromString(paypal, 'text/xml').documentElement,
            ),
        );
    }
}

function validateOrDefault(value: string) {
    if (isValidWorkingDaysString(value)) {
        return value;
    }
    return DEFAULT_SETTINGS.workingDays;
}

function validateDirectoryOrDefault(value: string, defaultValue: string) {
    if (!value || /[:/\\]/.test(value)) {
        return defaultValue;
    }
    return value;
}

const createDonateButton = (link: string, img: HTMLElement): HTMLElement => {
    const a = document.createElement('a');
    a.setAttribute('href', link);
    a.addClass('advanced-tables-donate-button');
    a.appendChild(img);
    return a;
};

const paypal = '';