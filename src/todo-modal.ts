import { App, Modal } from 'obsidian';
// @ts-ignore
import EditTodo from './ui/edit-todo.svelte';

export class TodoModal extends Modal {
  public readonly onSubmit: (dateOrTag: Date | string) => void;

  constructor(
    app: App,
    onSubmit: (dateOrTag: Date | string) => void
  ) {
    super(app);
    this.onSubmit = (dateOrTag: Date | string) => {
      onSubmit(dateOrTag);
      this.close();
    };
  }

  public onOpen(): void {
    const { contentEl, titleEl, modalEl } = this;
    titleEl.setText('Move Task');

    new EditTodo({
      target: contentEl,
      props: {
        onSubmit: this.onSubmit,
        modalEl: modalEl,
        app: this.app, // Pass the app instance to the Svelte component
      },
    });
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}