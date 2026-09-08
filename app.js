const ARTWORKS = window.ARTWORKS || [];
let currentArtwork = 0;
let COLORS = ARTWORKS[0]?.colors || [];

const canvas = document.querySelector('#paintCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const viewport = document.querySelector('#canvasViewport');
const stage = document.querySelector('#canvasStage');
const palette = document.querySelector('#palette');
const selectedSwatch = document.querySelector('#selectedSwatch');
const selectedLabel = document.querySelector('#selectedLabel');
const undoBtn = document.querySelector('#undoBtn');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const loading = document.querySelector('#loading');
const toast = document.querySelector('#toast');
const artworkList = document.querySelector('#artworkList');
const artworkTitle = document.querySelector('#artworkTitle');
const verticalScroll = document.querySelector('#verticalScroll');

let selected = 0;
let templateData;
let originalArt;
let history = [];
let fills = 0;
let zoom = 1;
let dragging = false;
let dragStart;
let pointerStart;
let spaceDown = false;
let revealPressed = false;

function createPalette() {
  palette.innerHTML = '';
  COLORS.forEach((color, i) => {
    const button = document.createElement('button');
    button.className = `swatch-button${i === 0 ? ' selected' : ''}`;
    button.style.setProperty('--swatch', color);
    button.setAttribute('aria-label', `Select color ${i + 1}`);
    button.innerHTML = `<span>${i + 1}</span>`;
    button.addEventListener('click', () => selectColor(i));
    palette.append(button);
  });
  updateSelectedCard();
}

function createArtworkList() {
  artworkList.innerHTML = '';
  ARTWORKS.forEach((artwork, index) => {
    const button = document.createElement('button');
    button.className = `artwork-choice${index === currentArtwork ? ' selected' : ''}`;
    button.setAttribute('aria-label', `Choose ${artwork.title}`);
    button.title = artwork.title;
    button.innerHTML = `<div class="artwork-thumb"><img src="${artwork.file}" alt=""><span class="artwork-number">#${index + 1}</span></div>`;
    button.addEventListener('click', () => chooseArtwork(index));
    artworkList.append(button);
  });
}

function chooseArtwork(index) {
  if (index === currentArtwork) return;
  currentArtwork = index;
  COLORS = ARTWORKS[index].colors;
  selected = 0; history = []; fills = 0;
  updateProgress(); undoBtn.disabled = true;
  document.querySelectorAll('.artwork-choice').forEach((el, i) => el.classList.toggle('selected', i === index));
  createPalette();
  artworkTitle.textContent = ARTWORKS[index].title;
  loading.textContent = 'Preparing your canvas…';
  loading.classList.remove('hidden');
  setZoom(1);
  loadArtwork();
}

function selectColor(index) {
  selected = index;
  document.querySelectorAll('.swatch-button').forEach((el, i) => el.classList.toggle('selected', i === selected));
  updateSelectedCard();
}

function updateSelectedCard() {
  selectedSwatch.style.background = COLORS[selected];
  selectedLabel.textContent = `Color ${selected + 1}`;
}

function loadArtwork() {
  const artwork = ARTWORKS[currentArtwork];
  const img = new Image();
  img.onload = () => {
    canvas.width = artwork.cropWidth || img.width;
    canvas.height = img.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const off = offscreen.getContext('2d', { willReadFrequently: true });
    off.drawImage(img, 0, 0);
    originalArt = off.getImageData(0, 0, canvas.width, canvas.height);
    templateData = makeTemplate(originalArt);
    ctx.putImageData(templateData, 0, 0);
    loading.classList.add('hidden');
    requestAnimationFrame(syncVerticalScroll);
  };
  img.onerror = () => { loading.textContent = 'Artwork could not be loaded.'; };
  img.src = artwork.file;
}

function makeTemplate(source) {
  const result = new ImageData(source.width, source.height);
  const s = source.data;
  const d = result.data;
  const dark = new Uint8Array(source.width * source.height);
  const darkInterior = new Uint8Array(source.width * source.height);

  for (let p = 0, i = 0; i < s.length; i += 4, p++) {
    const luminance = s[i] * .299 + s[i + 1] * .587 + s[i + 2] * .114;
    const spread = Math.max(s[i], s[i + 1], s[i + 2]) - Math.min(s[i], s[i + 1], s[i + 2]);
    dark[p] = luminance < 92 || (luminance < 135 && spread < 30) ? 1 : 0;
  }

  // Separate broad near-black painted areas from thin outlines and number glyphs.
  // This keeps color 20 paintable without thickening adjacent printed numbers.
  const radius = 5;
  for (let y = radius; y < source.height - radius; y++) {
    for (let x = radius; x < source.width - radius; x++) {
      const p = y * source.width + x;
      if (!dark[p]) continue;
      const w = source.width;
      if (dark[p-radius] && dark[p+radius] && dark[p-radius*w] && dark[p+radius*w] &&
          dark[p-radius*w-radius] && dark[p-radius*w+radius] &&
          dark[p+radius*w-radius] && dark[p+radius*w+radius]) darkInterior[p] = 1;
    }
  }

  for (let p = 0, i = 0; i < d.length; i += 4, p++) {
    if (dark[p] && !darkInterior[p]) {
      d[i] = d[i + 1] = d[i + 2] = 20;
    } else {
      // Retain the original palette as a light guide, then fill regions to full strength.
      d[i] = Math.round(255 * .68 + s[i] * .32);
      d[i + 1] = Math.round(255 * .68 + s[i + 1] * .32);
      d[i + 2] = Math.round(255 * .68 + s[i + 2] * .32);
    }
    d[i + 3] = 255;
  }
  return result;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - rect.left) * canvas.width / rect.width))),
    y: Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - rect.top) * canvas.height / rect.height)))
  };
}

function fillAt(x, y) {
  if (!templateData || revealPressed) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const start = (y * canvas.width + x) * 4;
  const sr = data[start], sg = data[start + 1], sb = data[start + 2];
  if (sr < 150 && sg < 150 && sb < 150) { showToast('Tap inside a numbered area.'); return; }

  const hex = COLORS[selected];
  const target = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  const sourcePixel = (y * canvas.width + x) * 4;
  const intended = nearestColor([
    originalArt.data[sourcePixel],
    originalArt.data[sourcePixel + 1],
    originalArt.data[sourcePixel + 2]
  ]);
  if (intended !== selected) {
    showToast(`That area uses color ${intended + 1}.`);
    return;
  }
  if (Math.abs(sr-target[0]) + Math.abs(sg-target[1]) + Math.abs(sb-target[2]) < 18) return;

  history.push(image);
  if (history.length > 18) history.shift();
  undoBtn.disabled = false;

  const w = canvas.width, h = canvas.height;
  const seen = new Uint8Array(w * h);
  const stack = [x, y];
  let changed = 0;
  const tolerance = 34;
  while (stack.length) {
    const cy = stack.pop();
    const cx = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const p = cy * w + cx;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (Math.abs(data[i]-sr) + Math.abs(data[i+1]-sg) + Math.abs(data[i+2]-sb) > tolerance) continue;
    if (data[i] < 145 && data[i+1] < 145 && data[i+2] < 145) continue;
    data[i] = target[0]; data[i+1] = target[1]; data[i+2] = target[2];
    changed++;
    stack.push(cx+1,cy,cx-1,cy,cx,cy+1,cx,cy-1);
  }

  if (changed < 30) { history.pop(); undoBtn.disabled = history.length === 0; return; }
  ctx.putImageData(image, 0, 0);
  fills++;
  updateProgress();
}

function updateProgress() {
  const pct = Math.min(100, Math.round((fills / 65) * 100));
  progressText.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
}

function nearestColor(rgb) {
  let best = 0;
  let bestDistance = Infinity;
  COLORS.forEach((hex, index) => {
    const candidate = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    const distance = (rgb[0]-candidate[0])**2 + (rgb[1]-candidate[1])**2 + (rgb[2]-candidate[2])**2;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return best;
}

function applyTransform() {
  canvas.style.width = `${zoom * 100}%`;
  document.querySelector('#zoomReset').textContent = `${Math.round(zoom * 100)}%`;
  requestAnimationFrame(syncVerticalScroll);
}

function setZoom(next) {
  zoom = Math.max(.5, Math.min(3, next));
  if (zoom === 1) { viewport.scrollLeft = 0; viewport.scrollTop = 0; }
  applyTransform();
}

canvas.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
  if (spaceDown && event.pointerType === 'mouse') {
    dragging = true;
    dragStart = { x: event.clientX + viewport.scrollLeft, y: event.clientY + viewport.scrollTop };
    event.preventDefault();
  }
});
viewport.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  viewport.scrollLeft = dragStart.x - event.clientX;
  viewport.scrollTop = dragStart.y - event.clientY;
});
canvas.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const movement = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  const wasDragging = dragging;
  dragging = false;
  if (!wasDragging && movement < 9) {
    const p = canvasPoint(event);
    fillAt(p.x, p.y);
  }
  pointerStart = null;
});
window.addEventListener('pointercancel', () => { dragging = false; pointerStart = null; });
viewport.addEventListener('wheel', (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? .15 : -.15));
}, { passive: false });
window.addEventListener('keydown', (event) => { if (event.code === 'Space') { spaceDown = true; viewport.style.cursor = 'grab'; } });
window.addEventListener('keyup', (event) => { if (event.code === 'Space') { spaceDown = false; viewport.style.cursor = 'crosshair'; } });

document.querySelector('#zoomIn').addEventListener('click', () => setZoom(zoom + .25));
document.querySelector('#zoomOut').addEventListener('click', () => setZoom(zoom - .25));
document.querySelector('#zoomReset').addEventListener('click', () => setZoom(1));

function syncVerticalScroll() {
  const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  verticalScroll.max = String(Math.max(1, Math.round(max)));
  verticalScroll.value = String(Math.min(max, Math.round(viewport.scrollTop)));
  verticalScroll.disabled = max < 2;
}
verticalScroll.addEventListener('input', () => { viewport.scrollTop = Number(verticalScroll.value); });
viewport.addEventListener('scroll', syncVerticalScroll, { passive: true });
window.addEventListener('resize', syncVerticalScroll);

undoBtn.addEventListener('click', () => {
  const prior = history.pop();
  if (!prior) return;
  ctx.putImageData(prior, 0, 0);
  fills = Math.max(0, fills - 1);
  undoBtn.disabled = history.length === 0;
  updateProgress();
});

document.querySelector('#resetBtn').addEventListener('click', () => {
  if (!templateData) return;
  ctx.putImageData(templateData, 0, 0);
  history = []; fills = 0; undoBtn.disabled = true; updateProgress(); setZoom(1);
  showToast('Canvas reset.');
});

document.querySelector('#downloadBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'ARTISTMARK-COLOR-composition-01.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Your artwork has been downloaded.');
});

document.querySelector('#hintBtn').addEventListener('click', () => {
  viewport.classList.remove('hinting');
  void viewport.offsetWidth;
  viewport.classList.add('hinting');
  showToast(`Look for every number ${selected + 1}.`);
});

const reveal = document.querySelector('#revealBtn');
function showOriginal() { if (!originalArt) return; revealPressed = true; ctx.putImageData(originalArt, 0, 0); }
function restorePainting() {
  if (!revealPressed) return;
  revealPressed = false;
  const current = history.length ? history[history.length - 1] : templateData;
  // The latest state is reconstructed by undoing the temporary reveal from a saved snapshot.
  if (history.length) {
    const snapshot = history.pop();
    ctx.putImageData(snapshot, 0, 0);
    history.push(snapshot);
  } else ctx.putImageData(current, 0, 0);
}
reveal.addEventListener('pointerdown', () => {
  if (!originalArt) return;
  reveal.dataset.snapshot = canvas.toDataURL('image/png');
  showOriginal();
});
['pointerup','pointerleave','pointercancel'].forEach(type => reveal.addEventListener(type, () => {
  if (!revealPressed) return;
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0); revealPressed = false; };
  img.src = reveal.dataset.snapshot;
}));

function showToast(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

createArtworkList();
createPalette();
artworkTitle.textContent = ARTWORKS[0]?.title || 'Experimental POP ART Composition #1';
loadArtwork();
