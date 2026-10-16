import { Notice, Plugin, TFile } from "obsidian";
import { appendToEnd, appendToSection, findDuplicate } from "./insert";
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
