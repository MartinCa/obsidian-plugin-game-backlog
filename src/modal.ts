import { App, Modal, Notice, Setting } from "obsidian";
import { formatDeck, formatLine, formatRating, suggestVerdict, Verdict } from "./format";
import { parseAppId, SearchResult } from "./parse";
import { fetchAppName, fetchGameData, GameData, searchSteam } from "./steam";

export interface AddGameRequest {
  line: string;
  name: string;
}

/**
 * Modal flow: find the game, review the fetched data and suggested verdict, then confirm.
 * `findDuplicate` lets the caller warn about games already in the note.
 *
 * The search inputs are built once so they keep focus and their text; only the results/preview area below
 * them is re-rendered.
 */
export class AddGameModal extends Modal {
  private query = "";
  private tags = "";
  private genres = "";
  private mouseKeyboard = false;
  private results: SearchResult[] = [];
  private status = "";

  private selected: SearchResult | null = null;
  private data: GameData | null = null;
  private verdict: Verdict = "sd-skip";
  private note = "";
  private line = "";
  private duplicate: string | null = null;

  /** True once the user picked a verdict by hand; later input changes no longer re-suggest it. */
  private verdictTouched = false;
  /** True once the user typed in the preview line; later input changes no longer rebuild it. */
  private lineEdited = false;

  private resultsEl!: HTMLElement;

  constructor(
    app: App,
    private onSubmit: (request: AddGameRequest) => Promise<void>,
    private findDuplicate: (name: string) => Promise<string | null>,
  ) {
    super(app);
  }

  onOpen(): void {
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
      .setName("Store / tags")
      .setDesc('Shown as [tags] after the title, e.g. "epic", "gog" or "epic sd"')
      .addText((text) =>
        text.setValue(this.tags).onChange((value) => {
          this.tags = value;
          this.recompute();
        }),
      );

    new Setting(contentEl)
      .setName("Genres")
      .setDesc('Comma-separated, e.g. "metroidvania, roguelike"')
      .addText((text) =>
        text.setValue(this.genres).onChange((value) => {
          this.genres = value;
          this.rebuildLine();
        }),
      );

    new Setting(contentEl)
      .setName("Mouse/keyboard-centric")
      .setDesc("Forces sd-skip, e.g. for FPS and mouse-driven strategy")
      .addToggle((toggle) =>
        toggle.setValue(this.mouseKeyboard).onChange((value) => {
          this.mouseKeyboard = value;
          this.recompute();
        }),
      );

    this.resultsEl = contentEl.createDiv();
    this.renderResults();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** Re-renders the area below the search inputs: status, pick list, manual entry or preview. */
  private renderResults(): void {
    const el = this.resultsEl;
    el.empty();

    if (this.status) el.createEl("p", { text: this.status, cls: "mod-warning" });

    if (!this.selected && this.results.length > 0) {
      el.createEl("h4", { text: "Pick the right game" });
      for (const result of this.results) {
        new Setting(el)
          .setName(result.name)
          .setDesc(`Steam app ${result.appId}`)
          .addButton((button) => button.setButtonText("Select").onClick(() => void this.select(result)));
      }
    }

    if (!this.selected && this.status.startsWith("No Steam results")) {
      new Setting(el)
        .setName("Add without Steam data")
        .setDesc("Creates an sd-skip entry marked as not on Steam")
        .addButton((button) => button.setButtonText("Add manually").onClick(() => this.addManual()));
    }

    if (this.selected && this.data) this.renderPreview(el);
  }

  private renderPreview(el: HTMLElement): void {
    el.createEl("h4", { text: this.selected?.name ?? "" });

    if (this.data && this.data.missing.length > 0) {
      el.createEl("p", {
        text: `Could not fetch: ${this.data.missing.join(", ")}. Those fields are left out of the line.`,
        cls: "mod-warning",
      });
    }
    if (this.duplicate) {
      el.createEl("p", { text: `Already in the note: ${this.duplicate}`, cls: "mod-warning" });
    }

    new Setting(el)
      .setName("Steam Deck verdict")
      .setDesc("Suggested from Valve status and ProtonDB; change it if you disagree")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("sd-good", "sd-good")
          .addOption("sd-skip", "sd-skip")
          .setValue(this.verdict)
          .onChange((value) => {
            this.verdict = value as Verdict;
            this.verdictTouched = true;
            this.rebuildLine();
          }),
      );

    new Setting(el)
      .setName("Note")
      .setDesc('Last field of the entry, e.g. "locked 30 fps" or "wait for patch"')
      .addText((text) =>
        text.setValue(this.note).onChange((value) => {
          this.note = value;
          this.rebuildLine();
        }),
      );

    const area = el.createEl("textarea", { cls: "game-backlog-line" });
    area.value = this.line;
    area.rows = 3;
    area.addEventListener("input", () => {
      this.line = area.value;
      this.lineEdited = true;
    });

    new Setting(el)
      .setName("Regenerate line")
      .setDesc("Discard manual changes and rebuild the verdict and line from the fields above")
      .addButton((button) =>
        button.setButtonText("Regenerate").onClick(() => {
          this.verdictTouched = false;
          this.lineEdited = false;
          this.recompute();
          this.renderResults();
        }),
      );

    new Setting(el).addButton((button) =>
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
    this.verdictTouched = false;
    this.lineEdited = false;
    this.status = "Searching Steam…";
    this.renderResults();

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
    this.renderResults();
  }

  private async select(result: SearchResult): Promise<void> {
    this.selected = result;
    this.status = "Fetching Steam, Deck and ProtonDB data…";
    this.renderResults();

    this.data = await fetchGameData(result.appId);
    this.status = "";
    this.duplicate = await this.findDuplicate(result.name);
    this.recompute();
    this.renderResults();
  }

  /**
   * Re-suggests the verdict from the current data and tags, then rebuilds the line.
   * A verdict the user chose by hand is kept, and so is a hand-edited line.
   */
  private recompute(): void {
    if (!this.data) return;
    if (!this.verdictTouched) {
      this.verdict = suggestVerdict({
        deck: this.data.deck,
        proton: this.data.proton,
        tags: this.tags,
        mouseKeyboard: this.mouseKeyboard,
      });
      this.syncVerdictDropdown();
    }
    this.rebuildLine();
  }

  private syncVerdictDropdown(): void {
    const select = this.resultsEl.querySelector<HTMLSelectElement>("select.dropdown");
    if (select) select.value = this.verdict;
  }

  private rebuildLine(): void {
    if (!this.selected || !this.data || this.lineEdited) return;
    const { reviews, deck, proton } = this.data;
    const note = [this.mouseKeyboard ? "mouse/keyboard-centric" : "", this.note].filter((part) => part).join("; ");
    this.line = formatLine({
      name: this.selected.name,
      tags: this.tags,
      rating: reviews ? formatRating(reviews) : null,
      verdict: this.verdict,
      deck: formatDeck(deck, proton),
      genres: this.genres,
      note,
    });
    const area = this.resultsEl.querySelector<HTMLTextAreaElement>("textarea.game-backlog-line");
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
      tags: this.tags,
      rating: null,
      verdict: "sd-skip",
      deck: "not on steam",
      genres: this.genres,
      note: this.note,
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
