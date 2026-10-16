import { App, PluginSettingTab, Setting } from "obsidian";
import type GameBacklogPlugin from "./main";
import type { InsertMode } from "./insert";

export interface GameBacklogSettings {
  /** Vault path of the list note. Empty means the currently active note. */
  targetPath: string;
  insertMode: InsertMode;
  /** Heading whose section receives new entries when insertMode is "section". */
  heading: string;
}

export const DEFAULT_SETTINGS: GameBacklogSettings = {
  targetPath: "",
  insertMode: "section",
  heading: "Main",
};

export class GameBacklogSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: GameBacklogPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Target note")
      .setDesc(
        "Vault path of the note that holds your game list, e.g. Games/Backlog.md. Leave empty to use the active note.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Games/Backlog.md")
          .setValue(this.plugin.settings.targetPath)
          .onChange(async (value) => {
            this.plugin.settings.targetPath = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Where to add new games")
      .setDesc("New entries are always added at the end, so your existing order is kept.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("section", "End of a section")
          .addOption("end", "End of the note")
          .setValue(this.plugin.settings.insertMode)
          .onChange(async (value) => {
            this.plugin.settings.insertMode = value as InsertMode;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Section heading")
      .setDesc("Used when adding to the end of a section. The heading must already exist in the note.")
      .addText((text) =>
        text
          .setPlaceholder("Main")
          .setValue(this.plugin.settings.heading)
          .onChange(async (value) => {
            this.plugin.settings.heading = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
