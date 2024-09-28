export interface TaskAction {
  sourceFile: string;
  destFile: string;
  taskContent: string;
  sourceLine: number;
  insertedLines: number[];
  headerAdded: boolean;
}