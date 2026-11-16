# Game Backlog

Obsidian plugin that adds a game to your backlog note with its Steam rating, Steam Deck status and ProtonDB tier, in one plain-text line.

## Usage

Run the command **Add game**, type a name (or paste a Steam URL / app ID), pick the match, review the suggested line and confirm. The entry is added at the cursor, following the surrounding list style (bulleted or numbered):

- Cursor on an empty list item: the entry fills it.
- Cursor on an existing entry: the entry is added as a new item right after it (and after its nested lines). In a numbered list the numbering continues and following numbers are shifted.
- Cursor on a blank line: the entry goes there, continuing the list above if there is one.
- Cursor on other text: the entry is added as a bullet on the next line.

If no note is being edited (for example in reading mode), the entry goes to the fallback note from the settings instead.

```
- Ball X Pit | 95% | sd-good | verified, platinum 95
- Elden Ring [epic] | 93% | sd-skip | verified, gold 2105 | - | locked 30 fps
- Dead Cells [sd] | 97% | sd-good | verified, platinum 157 | metroidvania, roguelike
- Gundegon | - | sd-skip | not on steam
```

The format uses only characters you can type on a keyboard:

```
Title [store] [sd] | steam% | sd-good or sd-skip | deck status, protondb tier count | genres | note
```

- Fields are always in this order. An empty field in the middle is `-`, trailing empty fields are left out.
- `[store]` and `[sd]` come from the _Store / tags_ field (`epic sd` becomes `[epic] [sd]`). `[sd]` is your own Steam Deck tag.
- `thin data` replaces the ProtonDB tier when there are too few reports.
- `sd-good`, `sd-skip` and the genres are plain words, not Obsidian tags, so they do not clutter the vault's tag list and are not tied to the whole note. Find them with text search.
- A `|` typed into a field is replaced with `/` so it cannot break the line. In _Store / tags_ it is treated as a separator instead.

Entries in the old format (`Title — Rating (95%) · SD-good · ...`) are still recognised when checking for duplicates.

### Steam Deck verdict

- **sd-good:** Verified, or Playable with ProtonDB Platinum (at least 5 reports).
- **sd-skip:** everything else, or when you tick _Mouse/keyboard-centric_.
- An `sd` tag always means sd-good. You can override the suggestion before adding.

## Settings

- **Fallback note:** vault path used when no note is being edited (empty = active note).
- **Fallback position:** end of a section (default heading `Main`, must exist) or end of the note.

## Data sources

- Steam store: `storesearch`, `appdetails`, `IStoreBrowseService` (reviews) and `ajaxgetdeckappcompatibilityreport`.
- ProtonDB: `api/v1/reports/summaries/<appid>.json`.

These are unofficial endpoints and may change. If a source fails, its field is left out of the line and the preview says so.

## Development

```
pnpm install
pnpm test
pnpm build
```

Releases are created by publishing a GitHub release; the publish workflow stamps the version and updates `manifest.json`, `package.json` and `versions.json`. Do not edit those versions by hand.
