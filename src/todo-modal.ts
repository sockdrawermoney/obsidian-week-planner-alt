import { App, Modal } from 'obsidian';
// @ts-ignore
import EditTodo from './ui/edit-todo.svelte';

export class TodoModal extends Modal {
    public readonly onSubmit: (dateOrTag: Date | string) => void;
    public readonly tagName: string | undefined;

    constructor(
        app: App,
        tagName: string | undefined, // New parameter
        onSubmit: (dateOrTag: Date | string) => void
    ) {
        super(app);
        this.tagName = tagName;
        this.onSubmit = (dateOrTag: Date | string) => {
            onSubmit(dateOrTag);
            this.close();
        };
    }

    public onOpen(): void {
        const { contentEl } = this;

        // Remove existing content
        contentEl.empty();

        // Create the Svelte component
        new EditTodo({
            target: contentEl,
            props: {
                onSubmit: this.onSubmit,
                tagName: this.tagName, // Pass the tagName prop
                app: this.app, // Pass the app instance to the Svelte component
            },
        });
    }

    public onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
