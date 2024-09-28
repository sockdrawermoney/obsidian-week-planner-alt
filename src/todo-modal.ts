import { App, Modal } from 'obsidian';
// @ts-ignore
import EditTodo from './ui/edit-todo.svelte';

export class TodoModal extends Modal {
  public readonly onSubmit: (date: Date) => void;

  constructor(
    app: App,
    onSubmit: (date: Date) => void
  ) {
    super(app);
    this.onSubmit = (date: Date) => {
      onSubmit(date);
      this.close();
    };
  }

  public onOpen(): void {
    const { contentEl } = this;
    new EditTodo({
      target: contentEl,
      props: {
        onSubmit: this.onSubmit,
      },
    });
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}