/* ============================================================
BLOCKDROP — script.js
Full game logic: drag/drop, grid, clearing, scoring, effects
============================================================ */

‘use strict’;

/* ── Audio (Web Audio API) ─────────────────────────────────── */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;

function initAudio() {
if (!actx) actx = new AudioCtx();
}

function playTone(freq, type, duration, gainVal, time = 0) {
if (!actx) return;
const osc = actx.createOscillator();
const gain = actx.createGain();
osc.connect(gain); gain.connect(actx.destination);
osc.type = type;
osc.frequency.setValueAtTime(freq, actx.currentTime + time);
gain.gain.setValueAtTime(gainVal, actx.currentTime + time);
gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + time + duration);
osc.start(actx.currentTime + time);
osc.stop(actx.currentTime + time + duration + 0.05);
}

function sfxPlace() {
initAudio();
playTone(300, ‘sine’, 0.08, 0.18);
playTone(500, ‘sine’, 0.06, 0.12, 0.04);
}

function sfxClear(combo = 1) {
initAudio();
const freqs = [523, 659, 784, 1047, 1319];
freqs.forEach((f, i) => playTone(f * Math.min(combo, 3), ‘sine’, 0.2, 0.15, i * 0.06));
}

function sfxGameOver() {
initAudio();
[400, 300, 200, 150].forEach((f, i) => playTone(f, ‘sawtooth’, 0.3, 0.1, i * 0.1));
}

/* ── Block Shape Definitions ────────────────────────────────── */
// Each shape: { cells: [[row,col],…], color: var name }
const SHAPES = [
// Singles
{ cells: [[0,0]], color: ‘–c1’, name: ‘dot’ },
// 2-line H
{ cells: [[0,0],[0,1]], color: ‘–c2’, name: ‘2h’ },
// 2-line V
{ cells: [[0,0],[1,0]], color: ‘–c3’, name: ‘2v’ },
// 3-line H
{ cells: [[0,0],[0,1],[0,2]], color: ‘–c4’, name: ‘3h’ },
// 3-line V
{ cells: [[0,0],[1,0],[2,0]], color: ‘–c5’, name: ‘3v’ },
// 4-line H
{ cells: [[0,0],[0,1],[0,2],[0,3]], color: ‘–c6’, name: ‘4h’ },
// 4-line V
{ cells: [[0,0],[1,0],[2,0],[3,0]], color: ‘–c1’, name: ‘4v’ },
// 5-line H
{ cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], color: ‘–c7’, name: ‘5h’ },
// 2x2 square
{ cells: [[0,0],[0,1],[1,0],[1,1]], color: ‘–c8’, name: ‘sq2’ },
// 3x3 square
{ cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]], color: ‘–c9’, name: ‘sq3’ },
// L shape
{ cells: [[0,0],[1,0],[2,0],[2,1]], color: ‘–c1’, name: ‘L’ },
// J shape
{ cells: [[0,1],[1,1],[2,0],[2,1]], color: ‘–c2’, name: ‘J’ },
// L flipped
{ cells: [[0,0],[0,1],[1,0],[2,0]], color: ‘–c3’, name: ‘Lf’ },
// J flipped
{ cells: [[0,0],[0,1],[1,1],[2,1]], color: ‘–c4’, name: ‘Jf’ },
// T shape
{ cells: [[0,0],[0,1],[0,2],[1,1]], color: ‘–c5’, name: ‘T’ },
// T rotated 90
{ cells: [[0,0],[1,0],[1,1],[2,0]], color: ‘–c6’, name: ‘T90’ },
// T rotated 180
{ cells: [[0,1],[1,0],[1,1],[1,2]], color: ‘–c7’, name: ‘T180’ },
// T rotated 270
{ cells: [[0,1],[1,0],[1,1],[2,1]], color: ‘–c8’, name: ‘T270’ },
// Z shape
{ cells: [[0,0],[0,1],[1,1],[1,2]], color: ‘–c9’, name: ‘Z’ },
// S shape
{ cells: [[0,1],[0,2],[1,0],[1,1]], color: ‘–c1’, name: ‘S’ },
// Z vertical
{ cells: [[0,1],[1,0],[1,1],[2,0]], color: ‘–c2’, name: ‘Zv’ },
// S vertical
{ cells: [[0,0],[1,0],[1,1],[2,1]], color: ‘–c3’, name: ‘Sv’ },
// Big L
{ cells: [[0,0],[1,0],[2,0],[3,0],[3,1]], color: ‘–c4’, name: ‘bigL’ },
// Corner 3
{ cells: [[0,0],[1,0],[1,1]], color: ‘–c5’, name: ‘corner’ },
// Corner 3 alt
{ cells: [[0,1],[1,0],[1,1]], color: ‘–c6’, name: ‘cornerA’ },
// Cross
{ cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], color: ‘–c7’, name: ‘cross’ },
// Staircase
{ cells: [[0,0],[1,0],[1,1],[2,1],[2,2]], color: ‘–c8’, name: ‘stair’ },
// 2x3 rect
{ cells: [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]], color: ‘–c9’, name: ‘2x3’ },
// 3x2 rect
{ cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], color: ‘–c1’, name: ‘3x2’ },
];

/* ── Game State ─────────────────────────────────────────────── */
const GRID_SIZE = 10;
let board = [];          // 2D array: null or color string
let score = 0;
let bestScore = 0;
let comboCount = 0;
let trayShapes = [null, null, null]; // current 3 shapes
let trayUsed   = [false, false, false];
let activeDrag = null;   // { shapeIdx, shape, element, offsetX, offsetY }
let gridCellElements = []; // flat 100-item array

/* ── DOM refs ───────────────────────────────────────────────── */
const startScreen    = document.getElementById(‘startScreen’);
const gameScreen     = document.getElementById(‘gameScreen’);
const gameGrid       = document.getElementById(‘gameGrid’);
const blockTray      = document.getElementById(‘blockTray’);
const scoreDisplay   = document.getElementById(‘scoreDisplay’);
const bestDisplay    = document.getElementById(‘bestDisplay’);
const scoreFloats    = document.getElementById(‘scoreFloats’);
const gameOverModal  = document.getElementById(‘gameOverModal’);
const finalScoreEl   = document.getElementById(‘finalScore’);
const finalBestEl    = document.getElementById(‘finalBest’);
const newBestBadge   = document.getElementById(‘newBestBadge’);
const comboDisplay   = document.getElementById(‘comboDisplay’);
const particleCanvas = document.getElementById(‘particleCanvas’);
const pCtx           = particleCanvas.getContext(‘2d’);
const startBestVal   = document.getElementById(‘startBestVal’);
const bgOrbs         = document.querySelector(’.bg-orbs’);

/* ── Particle System ────────────────────────────────────────── */
let particles = [];

function resizeCanvas() {
particleCanvas.width  = window.innerWidth;
particleCanvas.height = window.innerHeight;
}
window.addEventListener(‘resize’, resizeCanvas);
resizeCanvas();

class Particle {
constructor(x, y, color) {
this.x = x; this.y = y;
this.vx = (Math.random() - 0.5) * 10;
this.vy = (Math.random() - 0.8) * 10;
this.life = 1;
this.decay = 0.02 + Math.random() * 0.03;
this.size = 4 + Math.random() * 8;
this.color = color;
this.gravity = 0.25;
this.rotation = Math.random() * Math.PI * 2;
this.rotSpeed = (Math.random() - 0.5) * 0.3;
this.square = Math.random() > 0.5;
}
update() {
this.x  += this.vx; this.y  += this.vy;
this.vy += this.gravity;
this.vx *= 0.97;
this.life -= this.decay;
this.rotation += this.rotSpeed;
}
draw() {
pCtx.save();
pCtx.globalAlpha = Math.max(0, this.life);
pCtx.translate(this.x, this.y);
pCtx.rotate(this.rotation);
pCtx.fillStyle = this.color;
pCtx.shadowColor = this.color;
pCtx.shadowBlur = 6;
if (this.square) {
pCtx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
} else {
pCtx.beginPath();
pCtx.arc(0, 0, this.size/2, 0, Math.PI*2);
pCtx.fill();
}
pCtx.restore();
}
}

function spawnParticles(x, y, color, count = 20) {
for (let i = 0; i < count; i++) {
particles.push(new Particle(x, y, color));
}
}

function animParticles() {
pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
particles = particles.filter(p => p.life > 0);
particles.forEach(p => { p.update(); p.draw(); });
requestAnimationFrame(animParticles);
}
animParticles();

/* ── Build Grid DOM ─────────────────────────────────────────── */
function buildGrid() {
gameGrid.innerHTML = ‘’;
gridCellElements = [];
for (let r = 0; r < GRID_SIZE; r++) {
for (let c = 0; c < GRID_SIZE; c++) {
const cell = document.createElement(‘div’);
cell.className = ‘grid-cell’;
cell.dataset.r = r; cell.dataset.c = c;
gameGrid.appendChild(cell);
gridCellElements.push(cell);
}
}
}

function cellEl(r, c) {
return gridCellElements[r * GRID_SIZE + c];
}

/* ── Board Init ─────────────────────────────────────────────── */
function initBoard() {
board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function renderBoard() {
for (let r = 0; r < GRID_SIZE; r++) {
for (let c = 0; c < GRID_SIZE; c++) {
const el = cellEl(r, c);
const color = board[r][c];
if (color) {
el.classList.add(‘filled’);
el.style.background = `var(${color})`;
el.style.boxShadow = `0 0 8px var(${color}), inset 0 1px 0 rgba(255,255,255,0.25)`;
} else {
el.classList.remove(‘filled’, ‘preview-valid’, ‘preview-invalid’);
el.style.background = ‘’;
el.style.boxShadow = ‘’;
}
}
}
}

/* ── Score ──────────────────────────────────────────────────── */
function addScore(pts, x, y) {
score += pts;
scoreDisplay.textContent = score;
scoreDisplay.classList.remove(‘bump’);
void scoreDisplay.offsetWidth;
scoreDisplay.classList.add(‘bump’);
if (score > bestScore) {
bestScore = score;
bestDisplay.textContent = bestScore;
localStorage.setItem(‘blockdrop_best’, bestScore);
}
// Float
const float = document.createElement(‘div’);
float.className = ‘score-float’;
float.textContent = ‘+’ + pts;
float.style.left = (x || window.innerWidth/2) + ‘px’;
float.style.top  = (y || window.innerHeight/2) + ‘px’;
float.style.color = pts >= 50 ? ‘#ffd32a’ : pts >= 20 ? ‘#0be881’ : ‘#48dbfb’;
scoreFloats.appendChild(float);
float.addEventListener(‘animationend’, () => float.remove());
}

/* ── Generate Tray ──────────────────────────────────────────── */
function randomShape() {
return SHAPES[Math.floor(Math.random() * SHAPES.length)];
}

function generateTray() {
trayShapes = [randomShape(), randomShape(), randomShape()];
trayUsed   = [false, false, false];
renderTray();
}

function renderTray() {
for (let i = 0; i < 3; i++) {
const slot = document.getElementById(`slot${i}`);
slot.innerHTML = ‘’;
if (!trayShapes[i] || trayUsed[i]) {
if (trayUsed[i]) {
const ghost = document.createElement(‘div’);
ghost.className = ‘block-piece used’;
ghost.style.opacity = ‘0’;
slot.appendChild(ghost);
}
continue;
}
slot.appendChild(createPieceElement(trayShapes[i], i));
}
}

function createPieceElement(shape, idx) {
// Get bounding box
const rows = shape.cells.map(c=>c[0]);
const cols = shape.cells.map(c=>c[1]);
const maxR = Math.max(…rows);
const maxC = Math.max(…cols);

const piece = document.createElement(‘div’);
piece.className = ‘block-piece’;
piece.dataset.idx = idx;
piece.style.gridTemplateColumns = `repeat(${maxC+1}, var(--tray-cell))`;
piece.style.gridTemplateRows    = `repeat(${maxR+1}, var(--tray-cell))`;
piece.style.display = ‘grid’;

// Fill grid
for (let r = 0; r <= maxR; r++) {
for (let c = 0; c <= maxC; c++) {
const cell = document.createElement(‘div’);
const isFilled = shape.cells.some(([cr,cc]) => cr===r && cc===c);
if (isFilled) {
cell.className = ‘block-cell’;
cell.style.background = `var(${shape.color})`;
cell.style.boxShadow  = `0 3px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`;
} else {
cell.className = ‘block-cell empty-cell’;
}
piece.appendChild(cell);
}
}

// Drag events
piece.addEventListener(‘mousedown’,  e => startDrag(e, idx, ‘mouse’));
piece.addEventListener(‘touchstart’, e => startDrag(e, idx, ‘touch’), { passive: false });

return piece;
}

/* ── Drag & Drop ────────────────────────────────────────────── */
let dragEl = null;
let dragPreviewCells = [];

function startDrag(e, idx, mode) {
e.preventDefault();
initAudio();
if (trayUsed[idx]) return;

const shape = trayShapes[idx];

// Get pointer position
const pt = mode === ‘touch’ ? e.touches[0] : e;

// Clone the piece as a dragging ghost
const slot = document.getElementById(`slot${idx}`);
const original = slot.querySelector(’.block-piece’);
const rect = original.getBoundingClientRect();

dragEl = original.cloneNode(true);
dragEl.classList.add(‘dragging’);
document.body.appendChild(dragEl);

// Scale-adjusted cell size
const trayCell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(’–tray-cell’));
const rows = shape.cells.map(c=>c[0]);
const cols = shape.cells.map(c=>c[1]);
const maxR = Math.max(…rows);
const maxC = Math.max(…cols);
const pieceW = (maxC+1)*trayCell + maxC*0; // gap included
const pieceH = (maxR+1)*trayCell + maxR*0;

// Center the drag element on cursor
activeDrag = { idx, shape, mode };
positionDragEl(pt.clientX, pt.clientY, pieceW, pieceH);

// Dim original
original.style.opacity = ‘0.2’;

// Move handlers
if (mode === ‘mouse’) {
document.addEventListener(‘mousemove’, onDragMove);
document.addEventListener(‘mouseup’,   onDragEnd);
} else {
document.addEventListener(‘touchmove’, onDragMove, { passive: false });
document.addEventListener(‘touchend’,  onDragEnd);
}
}

function positionDragEl(clientX, clientY, pw, ph) {
// Account for scale(1.25)
const scale = 1.25;
const sw = (pw || dragEl.offsetWidth) * scale;
const sh = (ph || dragEl.offsetHeight) * scale;
dragEl.style.left = (clientX - sw/2) + ‘px’;
dragEl.style.top  = (clientY - sh * 0.6) + ‘px’;
}

function onDragMove(e) {
e.preventDefault();
const pt = activeDrag.mode === ‘touch’ ? e.touches[0] : e;
positionDragEl(pt.clientX, pt.clientY);
showPreview(pt.clientX, pt.clientY);
}

function onDragEnd(e) {
const pt = activeDrag.mode === ‘touch’ ? e.changedTouches[0] : e;
clearPreview();

const target = getGridTargetCell(pt.clientX, pt.clientY);
if (target) {
const { r, c } = target;
const shape = activeDrag.shape;
if (canPlace(shape, r, c)) {
placeShape(shape, r, c, activeDrag.idx);
} else {
snapBack();
}
} else {
snapBack();
}

cleanup();
}

function snapBack() {
// Restore original opacity
const slot = document.getElementById(`slot${activeDrag.idx}`);
const orig = slot.querySelector(’.block-piece’);
if (orig) orig.style.opacity = ‘’;
}

function cleanup() {
if (dragEl) { dragEl.remove(); dragEl = null; }
document.removeEventListener(‘mousemove’, onDragMove);
document.removeEventListener(‘mouseup’,   onDragEnd);
document.removeEventListener(‘touchmove’, onDragMove);
document.removeEventListener(‘touchend’,  onDragEnd);
clearPreview();
activeDrag = null;
}

/* ── Grid targeting ─────────────────────────────────────────── */
function getGridRect() {
return gameGrid.getBoundingClientRect();
}

function getGridTargetCell(clientX, clientY) {
// Map from pointer → grid anchor (top-left of shape)
const gridRect = getGridRect();
const cellSize  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(’–cell-size’));
const GAP = 3;
const step = cellSize + GAP;

// Adjust pointer up a bit (piece is offset above finger for visibility)
const adjustedY = clientY - cellSize * 2;

const relX = clientX - gridRect.left - 8; // 8 = padding
const relY = adjustedY - gridRect.top - 8;

const c = Math.round(relX / step);
const r = Math.round(relY / step);

return { r, c };
}

/* ── Preview ────────────────────────────────────────────────── */
function showPreview(clientX, clientY) {
clearPreview();
if (!activeDrag) return;

const target = getGridTargetCell(clientX, clientY);
const { r, c } = target;
const shape = activeDrag.shape;
const valid = canPlace(shape, r, c);

shape.cells.forEach(([dr, dc]) => {
const tr = r + dr; const tc = c + dc;
if (tr >= 0 && tr < GRID_SIZE && tc >= 0 && tc < GRID_SIZE) {
const el = cellEl(tr, tc);
el.classList.add(valid ? ‘preview-valid’ : ‘preview-invalid’);
if (valid) {
el.style.background = `var(${shape.color})`;
el.style.opacity = ‘0.6’;
}
dragPreviewCells.push(el);
}
});
}

function clearPreview() {
dragPreviewCells.forEach(el => {
el.classList.remove(‘preview-valid’, ‘preview-invalid’);
// Restore board color or empty
const r = parseInt(el.dataset.r); const c = parseInt(el.dataset.c);
if (board[r][c]) {
el.style.background = `var(${board[r][c]})`;
el.style.opacity = ‘’;
} else {
el.style.background = ‘’;
el.style.opacity = ‘’;
}
});
dragPreviewCells = [];
}

/* ── Placement ──────────────────────────────────────────────── */
function canPlace(shape, anchorR, anchorC) {
return shape.cells.every(([dr, dc]) => {
const r = anchorR + dr; const c = anchorC + dc;
return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && board[r][c] === null;
});
}

function placeShape(shape, anchorR, anchorC, idx) {
sfxPlace();

// Place on board
shape.cells.forEach(([dr, dc]) => {
const r = anchorR + dr; const c = anchorC + dc;
board[r][c] = shape.color;
const el = cellEl(r, c);
el.classList.add(‘filled’, ‘just-placed’);
el.style.background = `var(${shape.color})`;
el.style.boxShadow = `0 0 8px var(${shape.color}), inset 0 1px 0 rgba(255,255,255,0.25)`;
el.addEventListener(‘animationend’, () => el.classList.remove(‘just-placed’), { once: true });
});

// Score for placement
const placePts = shape.cells.length;
const midCell = shape.cells[Math.floor(shape.cells.length/2)];
const midEl = cellEl(anchorR + midCell[0], anchorC + midCell[1]);
const midRect = midEl.getBoundingClientRect();
addScore(placePts, midRect.left + midRect.width/2, midRect.top);

// Mark used
trayUsed[idx] = true;
const slot = document.getElementById(`slot${idx}`);
const orig = slot.querySelector(’.block-piece’);
if (orig) orig.style.opacity = ‘’;

// Check clears with delay
setTimeout(() => {
checkAndClear();
// Refresh tray if all used
const allUsed = trayUsed.every(u => u);
if (allUsed) generateTray();
else renderTray();
// Check game over
setTimeout(checkGameOver, 100);
}, 150);
}

/* ── Clear Lines ────────────────────────────────────────────── */
function checkAndClear() {
const fullRows = [];
const fullCols = [];

for (let r = 0; r < GRID_SIZE; r++) {
if (board[r].every(c => c !== null)) fullRows.push(r);
}
for (let c = 0; c < GRID_SIZE; c++) {
if (board.every(row => row[c] !== null)) fullCols.push(c);
}

if (fullRows.length === 0 && fullCols.length === 0) {
comboCount = 0;
comboDisplay.textContent = ‘’;
return;
}

const totalLines = fullRows.length + fullCols.length;
comboCount++;

// Show combo
if (totalLines > 1 || comboCount > 1) {
const msgs = [‘NICE!’,‘GREAT!’,‘AMAZING!’,‘ULTRA!’,‘LEGENDARY!’];
const msg = totalLines > 1
? `${totalLines}x COMBO!`
: msgs[Math.min(comboCount-1, msgs.length-1)];
comboDisplay.textContent = msg;
// Background pulse
bgOrbs.classList.remove(‘combo-pulse’);
void bgOrbs.offsetWidth;
bgOrbs.classList.add(‘combo-pulse’);
} else {
comboDisplay.textContent = ‘’;
}

// Collect all cells to clear
const toClear = new Set();
fullRows.forEach(r => {
for (let c = 0; c < GRID_SIZE; c++) toClear.add(`${r},${c}`);
});
fullCols.forEach(c => {
for (let r = 0; r < GRID_SIZE; r++) toClear.add(`${r},${c}`);
});

// Animate clear
toClear.forEach(key => {
const [r, c] = key.split(’,’).map(Number);
const el = cellEl(r, c);
el.classList.add(‘clearing’);

```
// Particles
const rect = el.getBoundingClientRect();
const color = board[r][c] ? `var(${board[r][c]})` : '#fff';
// Use resolved color
const computed = window.getComputedStyle(el).background;
spawnParticles(
  rect.left + rect.width/2,
  rect.top  + rect.height/2,
  board[r][c] ? getCSSVar(board[r][c]) : '#fff',
  8
);
```

});

// Screen shake
gameScreen.classList.remove(‘shake’);
void gameScreen.offsetWidth;
gameScreen.classList.add(‘shake’);

// Score
const lineScore = totalLines * 10 * (totalLines > 1 ? totalLines : 1) * comboCount;
const centerEl = cellEl(fullRows[0] ?? 0, fullCols[0] ?? 5);
const cr = centerEl.getBoundingClientRect();
addScore(lineScore, cr.left + cr.width/2, cr.top);

sfxClear(totalLines);

// After animation: clear board
setTimeout(() => {
toClear.forEach(key => {
const [r, c] = key.split(’,’).map(Number);
board[r][c] = null;
const el = cellEl(r, c);
el.classList.remove(‘clearing’, ‘filled’);
el.style.background = ‘’;
el.style.boxShadow  = ‘’;
el.style.opacity    = ‘’;
});
}, 420);
}

function getCSSVar(varName) {
return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ‘#fff’;
}

/* ── Game Over ──────────────────────────────────────────────── */
function canAnyFit() {
for (let i = 0; i < 3; i++) {
if (trayUsed[i] || !trayShapes[i]) continue;
const shape = trayShapes[i];
for (let r = 0; r < GRID_SIZE; r++) {
for (let c = 0; c < GRID_SIZE; c++) {
if (canPlace(shape, r, c)) return true;
}
}
}
return false;
}

function checkGameOver() {
if (!canAnyFit()) {
sfxGameOver();
showGameOver();
}
}

function showGameOver() {
finalScoreEl.textContent = score;
finalBestEl.textContent  = bestScore;
newBestBadge.classList.toggle(‘hidden-badge’, score < bestScore || score === 0);
gameOverModal.classList.remove(‘hidden’);
void gameOverModal.offsetWidth;
gameOverModal.classList.add(‘show’);
}

/* ── Start / Restart ────────────────────────────────────────── */
function startGame() {
score = 0;
comboCount = 0;
scoreDisplay.textContent = ‘0’;
bestDisplay.textContent  = bestScore;
comboDisplay.textContent = ‘’;

initBoard();
buildGrid();
renderBoard();
generateTray();

startScreen.classList.remove(‘active’);
gameScreen.classList.add(‘active’);
}

function restartGame() {
gameOverModal.classList.remove(‘show’);
setTimeout(() => {
gameOverModal.classList.add(‘hidden’);
startGame();
}, 400);
}

/* ── Init ───────────────────────────────────────────────────── */
function init() {
bestScore = parseInt(localStorage.getItem(‘blockdrop_best’) || ‘0’);
bestDisplay.textContent  = bestScore;
startBestVal.textContent = bestScore;

document.getElementById(‘btnPlay’).addEventListener(‘click’, () => {
initAudio();
startGame();
});
document.getElementById(‘btnRestart’).addEventListener(‘click’, restartGame);

buildGrid();
startScreen.classList.add(‘active’);
}

init();
