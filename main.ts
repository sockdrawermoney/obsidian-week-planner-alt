// main.ts
import { App, Editor, Plugin, PluginSettingTab, Setting, moment, TFile } from 'obsidian';
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

// noinspection JSUnusedGlobalSymbols
export default class WeekPlannerPlugin extends Plugin {
    settings: WeekPlannerPluginSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: "add-todo",
            name: "Add Todo",
            callback: () => {
                new TodoModal(this.app, 'Create Task', 'Create', '', (task: string, list: string, date: Date) => {
                    if (list == 'inbox') {
                        this.insertIntoInbox(TODO_PREFIX + task);
                    } else if (list == 'tomorrow') {
                        this.insertIntoTomorrow(TODO_PREFIX + task);
                    } else if (list == 'target-date') {
                        this.insertIntoTargetDate(date, TODO_PREFIX + task);
                    }
                }).open();
            },
        });

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

        this.addSettingTab(new WeekPlannerSettingTab(this.app, this));
    }

    async insertIntoTargetDate(date: Date, todo: string) {
        let targetDateFile = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, date));
        await targetDateFile.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox');
        await targetDateFile.insertAt(todo, 1);
    }

    async insertIntoInbox(todo: string) {
        let inbox = new WeekPlannerFile(this.app, this.settings, this.app.vault, getInboxFileName(this.settings));
        await inbox.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox');
        await inbox.insertAt(todo, 1);
    }

    async insertIntoTomorrow(todo: string) {
        let tomorrow = getTomorrowDate(this.settings.workingDays);
        let dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, tomorrow));
        await dest.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox');
        await dest.insertAt(todo, 1);
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
        let sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name);
        let source = new WeekPlannerFile(this.app, this.settings, this.app.vault, sourceFileName);

        let destFileName: string;
        if (source.isInbox() || source.isYesterday()) {
            // Inbox and yesterday's todos are moved to today
            destFileName = getDayFileName(this.settings, getNextWorkingDay(this.settings.workingDays));
        } else {
            // All other todos are moved to the next working day following the day represented by the current file
            let dateFromFilename = getDateFromFilename(source.fullFileName);
            let nextWorkingDay = getNextWorkingDay(this.settings.workingDays, moment(dateFromFilename));
            destFileName = getDayFileName(this.settings, nextWorkingDay);
        }

        let dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, destFileName);
        await this.move(editor, source, dest, 'Inbox');
    }

    async move(editor: Editor, source: WeekPlannerFile, dest: WeekPlannerFile, header: string) {
        await dest.createIfNotExists(this.app.vault, this.app.workspace, header);
        const line = editor.getCursor().line;
        let todo = editor.getLine(line);
        if (todo.startsWith(TODO_PREFIX) || todo.startsWith(TODO_DONE_PREFIX)) {
            await dest.insertAt(todo, 1);
            await source.deleteLine(line, todo, editor);
        }
    }

    async moveTaskToInbox(editor: Editor) {
        let sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name);
        let source = new WeekPlannerFile(this.app, this.settings, this.app.vault, sourceFileName);
        let dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, getInboxFileName(this.settings));
        await this.move(editor, source, dest, 'Inbox');
    }

    async moveAnywhere(editor: Editor) {
        const line = editor.getCursor().line;
        let todo = editor.getLine(line);
        if (todo.startsWith(TODO_PREFIX) || todo.startsWith(TODO_DONE_PREFIX)) {
            todo = todo.substring(TODO_PREFIX.length, todo.length);
            new TodoModal(this.app, 'Move Task', 'Move', todo, (task: string, list: string, date: Date) => {
                const sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name);
                const source = new WeekPlannerFile(this.app, this.settings, this.app.vault, sourceFileName);

                if (list == 'inbox') {
                    this.moveTaskToInbox(editor);
                } else if (list == 'tomorrow') {
                    const tomorrow = getTomorrowDate(this.settings.workingDays);
                    const dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, tomorrow));
                    this.move(editor, source, dest, 'Inbox');
                } else if (list == 'target-date') {
                    const dest = new WeekPlannerFile(this.app, this.settings, this.app.vault, getDayFileName(this.settings, date));
                    this.move(editor, source, dest, 'Inbox');
                }
            }).open();
        }
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