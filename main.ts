import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface WeekPlannerPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: WeekPlannerPluginSettings = {
	mySetting: 'default'
}

export default class WeekPlannerPlugin extends Plugin {
	settings: WeekPlannerPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Week Planner', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addCommand({
      id: 'week-planner-inbox',
      name: 'Show Inbox',
      callback: () => this.createNewNote('Inbox', 'Inbox'),
      hotkeys: []
    });

		this.addCommand({
      id: 'week-planner-week',
      name: 'Show Week',
      callback: () => this.createNewNote('Calweek-2022-36', 'Goals of Calendar Week 36', 'Weeks'),
      hotkeys: []
    });

		this.addCommand({
      id: 'week-planner-today',
      name: 'Show Today',
      callback: () => this.createNewNote('2022-09-05-Monday', 'Today', 'Days'),
      hotkeys: []
    });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async createNewNote(input: string, header: string, subdir?: string): Promise<void> {		
		if (typeof subdir !== 'undefined') {
			const subDirectoryExists = await this.app.vault.adapter.exists('Week Planner/' + subdir);
			if (!subDirectoryExists) {
				await this.app.vault.createFolder('Week Planner/' + subdir)
			}
		}

		const directoryPath = 'Week Planner'
    const directoryExists = await this.app.vault.adapter.exists(directoryPath);
		if (!directoryExists) {
			await this.app.vault.createFolder(directoryPath)
		}

		var fullFileName = ""
		if (typeof subdir !== 'undefined') {
			fullFileName = 'Week Planner/' + subdir + '/' + input
		} else {
			fullFileName = 'Week Planner/' + input
		}

		const fileExists = await this.app.vault.adapter.exists(fullFileName + '.md');
		if (!fileExists) {
			await this.app.vault.create(fullFileName + '.md', '## ' + header)
		}
		this.app.workspace.openLinkText(fullFileName, '', false )
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Hello Ling');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: WeekPlannerPlugin;

	constructor(app: App, plugin: WeekPlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
