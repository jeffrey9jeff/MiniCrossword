# Mini Crossword (NYT‑style 5×5)

A tiny, dependency‑free clone of the NYT Mini with timer, check/reveal tools, keyboard + on‑screen keypad, dark mode, and emoji share.

## Run locally
Open `index.html` in a browser, or serve the folder with any static server.

## Deploy to GitHub Pages
1. Create a new repo, e.g. `mini-crossword`.
2. Upload the contents of this folder (or push via git).
3. In **Settings → Pages**, set **Source** to `main` / root.
4. Visit the Pages URL shown by GitHub.

## Puzzles
The app loads one puzzle from `puzzles/today.json`.
Schema (5×5 only):

- `grid`: 5×5 array of letters; `#` = black square.
- `across` / `down`: arrays of clue objects:
  - `num`: printed clue number
  - `start`: 0‑based start index (row‑major: r*5 + c)
  - `len`: entry length
  - `answer`: solution in caps (letters only)
  - `text`: clue text

Update `puzzles/today.json` weekly with your next puzzle.
You can also add dated files (e.g. `2025-10-12.json`) and change `app.js` to compute the filename from `new Date()`.

## Controls
- **Typing**: fills current cell. **Space** toggles Across/Down.
- **Arrows** move the cursor; **Tab/Shift+Tab** next/prev word.
- **Check** letter/word/puzzle; **Reveal** letter/word/puzzle; **Reset** clears entries.
- **Share** copies an emoji grid with your time.

## License
MIT.
