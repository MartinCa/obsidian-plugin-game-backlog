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
- Ball X Pit — Overwhelmingly Positive (95%) · SD-good · Verified, ProtonDB Platinum (95)
- Elden Ring — Very Positive (93%) · SD-skip · Verified, ProtonDB Gold (2105); locked 30 fps
- Gundegon — no Steam rating · SD-skip — not found on Steam
```

`SD-good` and `SD-skip` are plain words, not tags, so they do not clutter the vault's tag list. Find them with Obsidian's text search.

### Steam Deck verdict

- **SD-good:** Verified, or Playable with ProtonDB Platinum (at least 5 reports).
- **SD-skip:** everything else, or when you tick _Mouse/keyboard-centric_.
- A `(SD)` in the notes always means SD-good. You can override the suggestion before adding.

## Settings

- **Fallback note:** vault path used when no note is being edited (empty = active note).
- **Fallback position:** end of a section (default heading `Main`, must exist) or end of the note.

## Data sources

- Steam store: `storesearch`, `appdetails`, `appreviews` and `ajaxgetdeckappcompatibilityreport`.
- ProtonDB: `api/v1/reports/summaries/<appid>.json`.

These are unofficial endpoints and may change. If a source fails, its field is left out of the line and the preview says so.

## Development

```
pnpm install
pnpm test
pnpm build
```

Releases are created by publishing a GitHub release; the publish workflow stamps the version and updates `manifest.json`, `package.json` and `versions.json`. Do not edit those versions by hand.
