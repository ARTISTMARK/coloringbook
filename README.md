# ARTISTMARK. COLOR

An interactive, browser-based ARTISTMARK paint-by-numbers experience. V2 preserves a lightly colored version of the original artwork as the guide and allows full horizontal and vertical navigation on smaller screens.

## Publish with GitHub Pages

1. Upload every file in this folder to the main directory of a new GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then click **Save**.

The app uses only HTML, CSS, and JavaScript. No installation or build step is required.

## Included controls

- Select any of 20 numbered colors
- Click, tap, or use Apple Pencil to fill enclosed areas
- Scroll, zoom, and pan across the complete artwork
- Original-color guided canvas with stronger, separated palette labels
- Correct-color feedback when a selected color does not match a region
- Undo and reset
- Hold to reveal the original artwork
- Download the finished composition as a PNG

## Adding another composition

Replace `artwork.png` with another 1:1 paint-by-numbers image. If the new image includes a palette on the right, update `ART_CROP_WIDTH` in `app.js` so only the artwork appears on the canvas. Update `COLORS` to match its numbered palette.
