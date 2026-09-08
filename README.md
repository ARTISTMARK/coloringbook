# ARTISTMARK. COLOR

An interactive, browser-based ARTISTMARK paint-by-numbers experience. V4 includes eight Experimental POP ART compositions while preserving the left selector, adjacent scrollbar, and 50%–300% zoom.

## Publish with GitHub Pages

1. Upload every file in this folder to the main directory of a new GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then click **Save**.

The app uses only HTML, CSS, and JavaScript. No installation or build step is required.

## Included controls

- Choose from eight Experimental POP ART compositions
- Use an artwork-specific numbered palette
- Click, tap, or use Apple Pencil to fill enclosed areas
- Scroll vertically with the dedicated control beside the image
- Zoom from 50% through 300%
- Original-color guided canvas with stronger, separated palette labels
- Correct-color feedback when a selected color does not match a region
- Undo and reset
- Hold to reveal the original artwork
- Download the finished composition as a PNG

## Adding another composition

Add the new guide image to `dist/`, then add its title, filename, artwork crop width, and 20-color palette to `dist/artworks.js`.
