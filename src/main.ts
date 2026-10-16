import { Editor, MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { appendToEnd, appendToSection, diffLines, findDuplicate, placeEntry } from "./insert";
import { AddGameModal } from "./modal";
import { DEFAULT_SETTINGS, GameBacklogSettings, GameBacklogSettingTab } from "./settings";

export default class GameBacklogPlugin extends Plugin {
  settings: GameBacklogSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new GameBacklogSettingTab(this.app, this));

    this.addCommand({
      id: "add-game",
      name: "Add game",
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.getMode() === "source") {
          // Edit mode: add the entry at the cursor.
          const editor = view.editor;
          const cursorLine = editor.getCursor().line;
          new AddGameModal(
            this.app,
            async ({ line }) => this.addAtCursor(editor, cursorLine, line),
            async (name) => findDuplicate(editor.getValue(), name),
          ).open();
          return;
        }
        // No note being edited: fall back to the configured note and section.
        const file = this.resolveTarget();
        if (!file) return;
        new AddGameModal(
          this.app,
          async ({ line }) => this.addLine(file, line),
          async (name) => findDuplicate(await this.app.vault.cachedRead(file), name),
        ).open();
      },
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private addAtCursor(editor: Editor, cursorLine: number, line: string): void {
    const before = editor.getValue().split("\n");
    const placement = placeEntry(before, cursorLine, line);
    const change = diffLines(before, placement.lines);
    if (change) {
      const from = { line: change.start, ch: 0 };
      const lastOld = change.oldEnd - 1;
      const text = change.lines.join("\n");
      if (change.oldEnd > change.start) {
        editor.replaceRange(text, from, { line: lastOld, ch: before[lastOld].length });
      } else {
        // Pure insertion: add the new lines before the line at `start`, or at the end of the document.
        if (change.start < before.length) editor.replaceRange(`${text}\n`, from);
        else editor.replaceRange(`\n${text}`, { line: before.length - 1, ch: before[before.length - 1].length });
      }
    }
    const newLine = placement.lines[placement.cursorLine] ?? "";
    editor.setCursor({ line: placement.cursorLine, ch: newLine.length });
    new Notice("Game added");
  }

  private resolveTarget(): TFile | null {
    const path = this.settings.targetPath;
    const file = path ? this.app.vault.getFileByPath(path) : this.app.workspace.getActiveFile();
    if (!file) {
      new Notice(
        path
          ? `Game Backlog: note "${path}" not found. Check the plugin settings.`
          : "Game Backlog: open the list note first, or set a target note in the plugin settings.",
      );
      return null;
    }
    return file;
  }

  private async addLine(file: TFile, line: string): Promise<void> {
    let failure: string | null = null;
    await this.app.vault.process(file, (content) => {
      if (this.settings.insertMode === "end") return appendToEnd(content, line);
      const updated = appendToSection(content, this.settings.heading, line);
      if (updated === null) {
        failure = `heading "${this.settings.heading}" not found in ${file.path}`;
        return content;
      }
      return updated;
    });
    if (failure) throw new Error(failure);
    new Notice(`Added to ${file.basename}`);
  }
}
