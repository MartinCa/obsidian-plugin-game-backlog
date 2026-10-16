import { App, Modal, Notice, Setting } from "obsidian";
import { formatEvidence, formatLine, formatRating, suggestVerdict, Verdict } from "./format";
import { parseAppId, SearchResult } from "./parse";
import { fetchAppName, fetchGameData, GameData, searchSteam } from "./steam";

export interface AddGameRequest {
  line: string;
  name: string;
}

/**
 * Modal flow: find the game, review the fetched data and suggested verdict, then confirm.
 * `findDuplicate` lets the caller warn about games already in the note.
 */
export class AddGameModal extends Modal {
  private query = "";
  private notes = "";
  private mouseKeyboard = false;
  private results: SearchResult[] = [];
  private status = "";

  private selected: SearchResult | null = null;
  private data: GameData | null = null;
  private verdict: Verdict = "SD-skip";
  private evidenceExtra = "";
  private line = "";
  private duplicate: string | null = null;

  constructor(
    app: App,
    private onSubmit: (request: AddGameRequest) => Promise<void>,
    private findDuplicate: (name: string) => Promise<string | null>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText("Add game");

    new Setting(contentEl)
      .setName("Game")
      .setDesc("Name, Steam store URL or app ID")
      .addText((text) => {
        text
          .setPlaceholder("Hades")
          .setValue(this.query)
          .onChange((value) => (this.query = value));
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") void this.search();
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      })
      .addButton((button) =>
        button
          .setButtonText("Search")
          .setCta()
          .onClick(() => void this.search()),
      );

    new Setting(contentEl)
      .setName("Store / notes")
      .setDesc('Kept in the entry, e.g. "(Epic)", "(GOG)", "(SD)" or "Wait for patch"')
      .addText((text) =>
        text.setValue(this.notes).onChange((value) => {
          this.notes = value;
          this.recompute();
        }),
      );

    new Setting(contentEl)
      .setName("Mouse/keyboard-centric")
      .setDesc("Forces SD-skip, e.g. for FPS and mouse-driven strategy")
      .addToggle((toggle) =>
        toggle.setValue(this.mouseKeyboard).onChange((value) => {
          this.mouseKeyboard = value;
          this.recompute();
        }),
      );

    if (this.status) contentEl.createEl("p", { text: this.status, cls: "mod-warning" });

    if (!this.selected && this.results.length > 0) {
      contentEl.createEl("h4", { text: "Pick the right game" });
      for (const result of this.results) {
        new Setting(contentEl)
          .setName(result.name)
          .setDesc(`Steam app ${result.appId}`)
          .addButton((button) => button.setButtonText("Select").onClick(() => void this.select(result)));
      }
    }

    if (!this.selected && this.status.startsWith("No Steam results")) {
      new Setting(contentEl)
        .setName("Add without Steam data")
        .setDesc("Creates an SD-skip entry marked as not found on Steam")
        .addButton((button) => button.setButtonText("Add manually").onClick(() => this.addManual()));
    }

    if (this.selected && this.data) this.renderPreview();
  }

  private renderPreview(): void {
    const { contentEl } = this;
    contentEl.createEl("h4", { text: this.selected?.name ?? "" });

    if (this.data && this.data.missing.length > 0) {
      contentEl.createEl("p", {
        text: `Could not fetch: ${this.data.missing.join(", ")}. Those fields are left out of the line.`,
        cls: "mod-warning",
      });
    }
    if (this.duplicate) {
      contentEl.createEl("p", { text: `Already in the note: ${this.duplicate}`, cls: "mod-warning" });
    }

    new Setting(contentEl)
      .setName("Steam Deck verdict")
      .setDesc("Suggested from Valve status and ProtonDB; change it if you disagree")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("SD-good", "SD-good")
          .addOption("SD-skip", "SD-skip")
          .setValue(this.verdict)
          .onChange((value) => {
            this.verdict = value as Verdict;
            this.rebuildLine();
          }),
      );

    new Setting(contentEl)
      .setName("Extra reason")
      .setDesc('Appended after the evidence, e.g. "locked 30 fps"')
      .addText((text) =>
        text.setValue(this.evidenceExtra).onChange((value) => {
          this.evidenceExtra = value;
          this.rebuildLine();
        }),
      );

    const area = contentEl.createEl("textarea", { cls: "game-backlog-line" });
    area.value = this.line;
    area.rows = 3;
    area.style.width = "100%";
    area.addEventListener("input", () => (this.line = area.value));

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText(this.duplicate ? "Add anyway" : "Add to list")
        .setCta()
        .onClick(() => void this.submit()),
    );
  }

  private async search(): Promise<void> {
    const query = this.query.trim();
    if (!query) return;
    this.selected = null;
    this.data = null;
    this.results = [];
    this.status = "Searching Steam…";
    this.render();

    try {
      const appId = parseAppId(query);
      if (appId !== null) {
        const name = (await fetchAppName(appId)) ?? `App ${appId}`;
        await this.select({ appId, name });
        return;
      }
      this.results = await searchSteam(query);
      this.status = this.results.length === 0 ? "No Steam results. You can add the game manually." : "";
    } catch {
      this.status = "No Steam results (the search failed). You can add the game manually.";
    }
    this.render();
  }

  private async select(result: SearchResult): Promise<void> {
    this.selected = result;
    this.status = "Fetching Steam, Deck and ProtonDB data…";
    this.render();

    this.data = await fetchGameData(result.appId);
    this.status = "";
    this.duplicate = await this.findDuplicate(result.name);
    this.recompute();
    this.render();
  }

  /** Re-suggests the verdict from current data/notes, then rebuilds the line. */
  private recompute(): void {
    if (!this.data) return;
    this.verdict = suggestVerdict({
      deck: this.data.deck,
      proton: this.data.proton,
      notes: this.notes,
      mouseKeyboard: this.mouseKeyboard,
    });
    this.rebuildLine();
  }

  private rebuildLine(): void {
    if (!this.selected || !this.data) return;
    const { reviews, deck, proton } = this.data;
    const extra = [this.mouseKeyboard ? "mouse/keyboard-centric" : "", this.evidenceExtra]
      .filter((part) => part)
      .join("; ");
    this.line = formatLine({
      name: this.selected.name,
      notes: this.notes,
      rating: reviews ? formatRating(reviews) : null,
      verdict: this.verdict,
      evidence: formatEvidence(deck, proton, extra),
    });
    const area = this.contentEl.querySelector<HTMLTextAreaElement>("textarea.game-backlog-line");
    if (area) area.value = this.line;
  }

  private addManual(): void {
    const name = this.query.trim();
    if (!name || parseAppId(name) !== null) {
      new Notice("Type the game name first.");
      return;
    }
    const line = formatLine({
      name,
      notes: this.notes,
      rating: null,
      verdict: "SD-skip",
      evidence: "not found on Steam",
    });
    void this.submitLine(line, name);
  }

  private async submit(): Promise<void> {
    await this.submitLine(this.line, this.selected?.name ?? this.query);
  }

  private async submitLine(line: string, name: string): Promise<void> {
    try {
      await this.onSubmit({ line: line.trim(), name });
      this.close();
    } catch (error) {
      new Notice(`Could not add game: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
