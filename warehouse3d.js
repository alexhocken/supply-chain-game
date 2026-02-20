// ============================================================
// WAREHOUSE 3D — PRIMARY GAME WORLD
// Three.js r128
// ============================================================

let whActive = false;
let whRenderer, whScene, whCamera;
let whAnimFrame = null;
let whKeys = {};
let whYaw = Math.PI;   // start facing into the warehouse
let whPitch = 0;
let whPointerLocked = false;
let whClock = 0;
let whTerminalOpen = false;
let whHasStarted = false;
let whInfoPanelOpen = null;  // 'incoming' | 'goal' | null
let whDirLight = null;       // for time-of-day
let whDragLook = false;
let whLastPointerX = 0, whLastPointerY = 0;
let whAmbientSound = null;   // Web Audio gain node for optional hum

// Terminal position in world space (the terminal object)
const TERMINAL_INTERACT_DIST = 5.0;
// Incoming board (left wall) and goal sign (right wall)
const INCOMING_BOARD_POS = { x: -13.2, z: -18 };
const GOAL_SIGN_POS = { x: 13.2, z: -18 };
const SIGN_INTERACT_DIST = 4.0;

const WALK_SPEED = 8;
const LOOK_SENS  = 0.0022;

// Shelf box group — rebuilt after each turn
let whBoxGroup = null;
let whSignMesh = null;
let whFillBar  = null;

// ─────────────────────────────────────────────
// ENTRY / EXIT
// ─────────────────────────────────────────────
function enterWarehouseWorld() {
  whActive = true;
  document.getElementById('difficulty-screen').style.display = 'none';
  document.getElementById('warehouse-world').style.display = 'block';

  document.addEventListener('keydown', whOnKeyDown);
  document.addEventListener('keyup',   whOnKeyUp);
  document.addEventListener('mousemove', whOnMouseMove);
  document.addEventListener('pointerlockchange', whOnPointerLockChange);
  whAddDragAndPadListeners();
  whStartAmbientSound();

  // Defer renderer init until after the DOM has painted so canvas has real dimensions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!whRenderer) initWarehouseRenderer();
      rebuildWarehouseContents();
      updateWarehouseHUD();
      whClock = performance.now();
      whLoop();
    });
  });
}

function exitWarehouseWorld() {
  whActive = false;
  document.getElementById('warehouse-world').style.display = 'none';
  if (whAnimFrame) { cancelAnimationFrame(whAnimFrame); whAnimFrame = null; }
  document.removeEventListener('keydown', whOnKeyDown);
  document.removeEventListener('keyup',   whOnKeyUp);
  document.removeEventListener('mousemove', whOnMouseMove);
  document.removeEventListener('pointerlockchange', whOnPointerLockChange);
  whRemoveDragAndPadListeners();
  if (document.pointerLockElement) document.exitPointerLock();
  whPointerLocked = false;
  whKeys = {};
  whTerminalOpen = false;
  whHasStarted = false;
  whInfoPanelOpen = null;
  closeInfoPanels();
  whStopAmbientSound();
}

function requestWarehousePointerLock() {
  if (whTerminalOpen) return;
  const canvas = document.getElementById('warehouse-canvas');
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {}); // silence rejection on file://
  } catch(e) {}
  // Even if pointer lock fails (file:// restriction), mark as started
  // so the overlay disappears and player can use mouse freely
  whHasStarted = true;
  document.getElementById('wh-click-msg').style.display = 'none';
}

function whOnPointerLockChange() {
  // once player has clicked once, never show click-to-start again
  whPointerLocked = document.pointerLockElement === document.getElementById('warehouse-canvas');
  if (whPointerLocked) whHasStarted = true;
  document.getElementById('wh-click-msg').style.display = whHasStarted ? 'none' : 'flex';
}

// ─────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────
function whOnKeyDown(e) {
  whKeys[e.code] = true;

  if (e.code === 'Escape') {
    if (whTerminalOpen) {
      closeTerminal();
    } else if (whInfoPanelOpen) {
      closeInfoPanels();
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
    }
    return;
  }

  if (e.code === 'KeyE') {
    if (whInfoPanelOpen) {
      closeInfoPanels();
    } else if (!whTerminalOpen) {
      if (isNearTerminal()) openTerminal();
      else if (isNearIncomingBoard()) openIncomingBoard();
      else if (isNearGoalSign()) openGoalSign();
    }
  }
}

function whOnKeyUp(e) { whKeys[e.code] = false; }

function whOnMouseMove(e) {
  if (whTerminalOpen) return;
  if (whPointerLocked) {
    whYaw   -= e.movementX * LOOK_SENS;
    whPitch -= e.movementY * LOOK_SENS;
    whPitch  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, whPitch));
    return;
  }
  if (whDragLook) {
    whYaw   -= (e.clientX - whLastPointerX) * LOOK_SENS;
    whPitch -= (e.clientY - whLastPointerY) * LOOK_SENS;
    whPitch  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, whPitch));
    whLastPointerX = e.clientX;
    whLastPointerY = e.clientY;
  }
}

// ─────────────────────────────────────────────
// TERMINAL OPEN / CLOSE
// ─────────────────────────────────────────────
function openTerminal() {
  whTerminalOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('terminal-panel').classList.remove('terminal-closed');
  document.getElementById('terminal-panel').classList.add('terminal-open');
  document.getElementById('wh-interact-prompt').style.display = 'none';
  document.getElementById('wh-click-msg').style.display = 'none';
  document.getElementById('wh-crosshair').style.display = 'none';
  document.getElementById('wh-hud').style.opacity = '0.3';
}

function closeTerminal() {
  whTerminalOpen = false;
  whHasStarted = false;
  document.getElementById('terminal-panel').classList.remove('terminal-open');
  document.getElementById('terminal-panel').classList.add('terminal-closed');
  document.getElementById('wh-crosshair').style.display = 'block';
  document.getElementById('wh-hud').style.opacity = '1';
  // Re-request pointer lock so they can walk again
  setTimeout(requestWarehousePointerLock, 100);
}

function isNearTerminal() {
  if (!whCamera) return false;
  const dx = whCamera.position.x - 0;
  const dz = whCamera.position.z - 0;
  return Math.sqrt(dx * dx + dz * dz) < TERMINAL_INTERACT_DIST;
}

function isNearIncomingBoard() {
  if (!whCamera) return false;
  const dx = whCamera.position.x - INCOMING_BOARD_POS.x;
  const dz = whCamera.position.z - INCOMING_BOARD_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < SIGN_INTERACT_DIST;
}

function isNearGoalSign() {
  if (!whCamera) return false;
  const dx = whCamera.position.x - GOAL_SIGN_POS.x;
  const dz = whCamera.position.z - GOAL_SIGN_POS.z;
  return Math.sqrt(dx * dx + dz * dz) < SIGN_INTERACT_DIST;
}

function openIncomingBoard() {
  whInfoPanelOpen = 'incoming';
  const pipe = typeof pipeline !== 'undefined' ? pipeline : [];
  const hasFast = typeof hasFastShipping === 'function' && hasFastShipping();
  let html = '<p style="margin:0;color:#9aa3b2;font-size:14px;line-height:1.6">';
  if (!pipe || pipe.length === 0) {
    html += 'No shipments in transit. Place an order at the terminal.';
  } else {
    if (pipe[0] > 0) html += `Next turn: <strong style="color:#4ecdc4">${pipe[0]} units</strong><br>`;
    if (!hasFast && pipe[1] > 0) html += `In 2 turns: <strong style="color:#f7b731">${pipe[1]} units</strong>`;
  }
  html += '</p>';
  document.getElementById('incoming-board-content').innerHTML = html;
  document.getElementById('incoming-board-panel').classList.remove('wh-info-closed');
  document.getElementById('incoming-board-panel').classList.add('wh-info-open');
  document.getElementById('wh-interact-prompt').style.display = 'none';
}

function openGoalSign() {
  whInfoPanelOpen = 'goal';
  const goal = typeof goalCash !== 'undefined' ? goalCash : 500;
  const lvl = typeof currentLevel !== 'undefined' ? currentLevel : 1;
  const lvlDef = typeof LEVELS !== 'undefined' ? LEVELS[Math.min(lvl - 1, LEVELS.length - 1)] : null;
  const name = lvlDef ? lvlDef.label : `Level ${lvl}`;
  document.getElementById('goal-sign-content').innerHTML =
    `<p style="margin:0;color:#9aa3b2;font-size:14px;line-height:1.6">
      <strong style="color:#f7b731">${name}</strong><br>
      Reach <strong style="color:#a8ff78">$${Number(goal).toLocaleString()}</strong> cash before time runs out.
    </p>`;
  document.getElementById('goal-sign-panel').classList.remove('wh-info-closed');
  document.getElementById('goal-sign-panel').classList.add('wh-info-open');
  document.getElementById('wh-interact-prompt').style.display = 'none';
}

function closeInfoPanels() {
  whInfoPanelOpen = null;
  const ib = document.getElementById('incoming-board-panel');
  const gs = document.getElementById('goal-sign-panel');
  if (ib) { ib.classList.add('wh-info-closed'); ib.classList.remove('wh-info-open'); }
  if (gs) { gs.classList.add('wh-info-closed'); gs.classList.remove('wh-info-open'); }
}

// ─────────────────────────────────────────────
// AMBIENT SOUND (subtle warehouse hum via Web Audio)
// ─────────────────────────────────────────────
function whStartAmbientSound() {
  if (whAmbientSound !== null) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0.015;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    whAmbientSound = { ctx, gain };
  } catch (e) {}
}

function whStopAmbientSound() {
  if (whAmbientSound && whAmbientSound.gain) {
    try { whAmbientSound.gain.gain.value = 0; } catch (e) {}
  }
  whAmbientSound = null;
}

// ─────────────────────────────────────────────
// DRAG-TO-LOOK & MOVEMENT PAD (mobile / non–pointer-lock)
// ─────────────────────────────────────────────
let whDragListeners = null;

function whAddDragAndPadListeners() {
  if (whDragListeners) return;
  const canvas = document.getElementById('warehouse-canvas');
  if (!canvas) return;

  const onPointerDown = (e) => {
    if (whTerminalOpen || whInfoPanelOpen) return;
    e.preventDefault();
    whDragLook = true;
    whLastPointerX = e.clientX != null ? e.clientX : e.touches[0].clientX;
    whLastPointerY = e.clientY != null ? e.clientY : e.touches[0].clientY;
  };
  const onPointerMove = (e) => {
    if (!whDragLook) return;
    e.preventDefault();
    const x = e.clientX != null ? e.clientX : (e.touches[0] ? e.touches[0].clientX : whLastPointerX);
    const y = e.clientY != null ? e.clientY : (e.touches[0] ? e.touches[0].clientY : whLastPointerY);
    whYaw   -= (x - whLastPointerX) * LOOK_SENS;
    whPitch -= (y - whLastPointerY) * LOOK_SENS;
    whPitch  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, whPitch));
    whLastPointerX = x;
    whLastPointerY = y;
  };
  const onPointerUp = () => { whDragLook = false; };

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  document.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  canvas.addEventListener('touchend', onPointerUp);
  canvas.addEventListener('touchcancel', onPointerUp);

  const setKey = (code, down) => { whKeys[code] = down; };
  const w = document.getElementById('wh-btn-w');
  const s = document.getElementById('wh-btn-s');
  const a = document.getElementById('wh-btn-a');
  const d = document.getElementById('wh-btn-d');
  if (w) {
    w.addEventListener('pointerdown', () => setKey('KeyW', true));
    w.addEventListener('pointerup', () => setKey('KeyW', false));
    w.addEventListener('pointerleave', () => setKey('KeyW', false));
  }
  if (s) {
    s.addEventListener('pointerdown', () => setKey('KeyS', true));
    s.addEventListener('pointerup', () => setKey('KeyS', false));
    s.addEventListener('pointerleave', () => setKey('KeyS', false));
  }
  if (a) {
    a.addEventListener('pointerdown', () => setKey('KeyA', true));
    a.addEventListener('pointerup', () => setKey('KeyA', false));
    a.addEventListener('pointerleave', () => setKey('KeyA', false));
  }
  if (d) {
    d.addEventListener('pointerdown', () => setKey('KeyD', true));
    d.addEventListener('pointerup', () => setKey('KeyD', false));
    d.addEventListener('pointerleave', () => setKey('KeyD', false));
  }

  whDragListeners = { onPointerDown, onPointerMove, onPointerUp, canvas };
}

function whRemoveDragAndPadListeners() {
  whDragLook = false;
  if (!whDragListeners) return;
  const { canvas } = whDragListeners;
  if (canvas) {
    canvas.removeEventListener('mousedown', whDragListeners.onPointerDown);
    canvas.removeEventListener('mousemove', whDragListeners.onPointerMove);
  }
  document.removeEventListener('mouseup', whDragListeners.onPointerUp);
  if (canvas) {
    canvas.removeEventListener('touchstart', whDragListeners.onPointerDown);
    canvas.removeEventListener('touchmove', whDragListeners.onPointerMove);
    canvas.removeEventListener('touchend', whDragListeners.onPointerUp);
    canvas.removeEventListener('touchcancel', whDragListeners.onPointerUp);
  }
  whDragListeners = null;
}

// ─────────────────────────────────────────────
// HUD UPDATE  (called from game.js after each turn)
// ─────────────────────────────────────────────
function updateWarehouseHUD() {
  if (!document.getElementById('wh-cash-hud')) return;
  const inv = typeof inventory !== 'undefined' ? inventory : 0;
  const cap = typeof warehouseCapacity === 'function' ? warehouseCapacity() : 100;
  const lvl = typeof currentLevel !== 'undefined' ? currentLevel : 1;
  const gCash = typeof cash !== 'undefined' ? cash : 0;
  const t = typeof turn !== 'undefined' ? turn : 1;
  const goal = typeof goalCash !== 'undefined' ? goalCash : 500;
  const lvlDef = typeof LEVELS !== 'undefined' ? LEVELS[Math.min(lvl-1, LEVELS.length-1)] : null;

  document.getElementById('wh-cash-hud').textContent   = `💰 $${Number(gCash).toFixed(0)}`;
  document.getElementById('wh-inv-hud').textContent     = `📦 ${inv} units`;
  document.getElementById('wh-turn-hud').textContent    = `🔄 Turn ${t}/20`;
  document.getElementById('wh-goal-hud').textContent    = `🎯 Goal $${Number(goal).toLocaleString()}`;
  document.getElementById('wh-level-badge').textContent = `LEVEL ${lvl}`;
  document.getElementById('wh-level-name').textContent  = lvlDef ? lvlDef.label : `Level ${lvl}`;
}

// ─────────────────────────────────────────────
// RENDERER INIT (once)
// ─────────────────────────────────────────────
function initWarehouseRenderer() {
  const canvas = document.getElementById('warehouse-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  whRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  whRenderer.setSize(window.innerWidth, window.innerHeight);
  whRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  whRenderer.shadowMap.enabled = true;
  whRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  whRenderer.setClearColor(0x0a0f1a);

  whScene = new THREE.Scene();
  whScene.fog = new THREE.Fog(0x0a1018, 28, 56);
  whScene.background = new THREE.Color(0x0a0f1a);

  whCamera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 100);
  whCamera.position.set(0, 1.7, 10); // start near entrance, facing terminal

  window.addEventListener('resize', () => {
    whCamera.aspect = window.innerWidth / window.innerHeight;
    whCamera.updateProjectionMatrix();
    whRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  canvas.addEventListener('click', () => { if (!whTerminalOpen) requestWarehousePointerLock(); });

  buildStaticWarehouse();
}

// ─────────────────────────────────────────────
// STATIC GEOMETRY (built once)
// ─────────────────────────────────────────────
function buildStaticWarehouse() {
  const S = whScene;

  // ── MATERIALS (Phong for specular highlights under lights) ──
  const floorMat  = new THREE.MeshPhongMaterial({ color: 0x222234, specular: 0x222244, shininess: 15 });
  const wallMat   = new THREE.MeshPhongMaterial({ color: 0x1a2f4a, specular: 0x1a2a4a, shininess: 20 });
  const ceilMat   = new THREE.MeshPhongMaterial({ color: 0x0d1520, specular: 0x0a1020, shininess: 10 });
  const shelfMat  = new THREE.MeshPhongMaterial({ color: 0x3d2e1e, specular: 0x2a2218, shininess: 25 });
  const pillarMat = new THREE.MeshPhongMaterial({ color: 0x1c2d44, specular: 0x152540, shininess: 30 });
  const stripeMat = new THREE.MeshPhongMaterial({ color: 0xe94560, specular: 0xcc3350, shininess: 40 });
  const stripeY   = new THREE.MeshPhongMaterial({ color: 0xf7b731, specular: 0xdda020, shininess: 40 });
  const darkMat   = new THREE.MeshPhongMaterial({ color: 0x111111, specular: 0x080808, shininess: 5 });

  // ── FLOOR ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  S.add(floor);

  // Floor tiles (grid lines)
  const gridLineMat = new THREE.MeshPhongMaterial({ color: 0x252535, specular: 0x151520, shininess: 8 });
  for (let x = -14; x <= 14; x += 2) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 60), gridLineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.001, 0);
    S.add(line);
  }
  for (let z = -29; z <= 29; z += 2) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.03), gridLineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.001, z);
    S.add(line);
  }

  // Safety stripes on edges of walk lane
  for (let z = -24; z < 25; z += 5) {
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3.5), stripeMat);
    s1.rotation.x = -Math.PI / 2; s1.position.set(-4.8, 0.002, z); S.add(s1);
    const s2 = s1.clone(); s2.position.set(4.8, 0.002, z); S.add(s2);
    const sy1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3.5), stripeY);
    sy1.rotation.x = -Math.PI / 2; sy1.position.set(-4.8, 0.003, z + 2.5); S.add(sy1);
    const sy2 = sy1.clone(); sy2.position.set(4.8, 0.003, z + 2.5); S.add(sy2);
  }

  // ── WALLS ──
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry; S.add(m);
  };
  mkWall(30, 12, 0, 6, -28);
  mkWall(30, 12, 0, 6,  28, Math.PI);
  mkWall(60, 12, -15, 6, 0, Math.PI / 2);
  mkWall(60, 12,  15, 6, 0, -Math.PI / 2);

  // Wall accent stripe near top
  const wallAccent = new THREE.MeshPhongMaterial({ color: 0x4ecdc4, specular: 0x3ebcb4, shininess: 35 });
  [-28, 28].forEach(z => {
    const acc = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.3), wallAccent);
    acc.position.set(0, 10.5, z + (z < 0 ? 0.01 : -0.01));
    if (z > 0) acc.rotation.y = Math.PI;
    S.add(acc);
  });

  // ── CEILING ──
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 12;
  S.add(ceil);

  // Ceiling beams
  const beamMat = new THREE.MeshPhongMaterial({ color: 0x162030, specular: 0x0d1520, shininess: 12 });
  for (let z = -20; z <= 20; z += 10) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 0.4), beamMat);
    beam.position.set(0, 11.8, z);
    S.add(beam);
  }

  // ── PILLARS ──
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.28, 12, 8);
  [[-10,-20],[10,-20],[-10,-10],[10,-10],[-10,0],[10,0],[-10,10],[10,10],[-10,20],[10,20]].forEach(([x,z]) => {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, 6, z);
    p.castShadow = true;
    S.add(p);
    // Base plate
    const baseMat = new THREE.MeshPhongMaterial({ color: 0xe94560, specular: 0xcc3350, shininess: 45 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), baseMat);
    base.position.set(x, 0.075, z);
    S.add(base);
  });

  // ── SHELVING UPRIGHTS (static) ──
  buildShelfStructure(S, shelfMat, darkMat);

  // ── ENTRANCE DOOR (back wall) ──
  buildDoor(S, 0, 0, 27.5, Math.PI);

  // ── EXIT SIGN (emissive so it glows) ──
  const exitGeo = new THREE.PlaneGeometry(2, 0.5);
  const exitMat = new THREE.MeshLambertMaterial({ color: 0x00cc55, emissive: 0x004422, emissiveIntensity: 0.6 });
  const exitSign = new THREE.Mesh(exitGeo, exitMat);
  exitSign.position.set(0, 11, -27.8);
  S.add(exitSign);

  // ── TERMINAL (center of warehouse) ──
  buildTerminal(S);

  // ── FORKLIFT ──
  buildForklift(S, 3, 0, 15);

  // ── INCOMING BOARD (left wall) & GOAL SIGN (right wall) — interact with E ──
  const signW = 2.2, signH = 1.4;
  const incomingCanvas = document.createElement('canvas');
  incomingCanvas.width = 256; incomingCanvas.height = 160;
  const incCtx = incomingCanvas.getContext('2d');
  incCtx.fillStyle = '#0d1520'; incCtx.fillRect(0, 0, 256, 160);
  incCtx.strokeStyle = '#4ecdc4'; incCtx.lineWidth = 3; incCtx.strokeRect(4, 4, 248, 152);
  incCtx.fillStyle = '#4ecdc4'; incCtx.font = 'bold 22px monospace'; incCtx.textAlign = 'center';
  incCtx.fillText('INCOMING', 128, 36); incCtx.fillText('SHIPMENTS', 128, 62);
  incCtx.fillStyle = '#9aa3b2'; incCtx.font = '14px monospace'; incCtx.fillText('Press [E] to view', 128, 120);
  const incomingTex = new THREE.CanvasTexture(incomingCanvas);
  const incomingSign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: incomingTex }));
  incomingSign.position.set(INCOMING_BOARD_POS.x, 2.2, INCOMING_BOARD_POS.z);
  incomingSign.rotation.y = Math.PI / 2;
  S.add(incomingSign);

  const goalCanvas = document.createElement('canvas');
  goalCanvas.width = 256; goalCanvas.height = 160;
  const goalCtx = goalCanvas.getContext('2d');
  goalCtx.fillStyle = '#0d1520'; goalCtx.fillRect(0, 0, 256, 160);
  goalCtx.strokeStyle = '#f7b731'; goalCtx.lineWidth = 3; goalCtx.strokeRect(4, 4, 248, 152);
  goalCtx.fillStyle = '#f7b731'; goalCtx.font = 'bold 22px monospace'; goalCtx.textAlign = 'center';
  goalCtx.fillText('LEVEL GOAL', 128, 50);
  goalCtx.fillStyle = '#9aa3b2'; goalCtx.font = '14px monospace'; goalCtx.fillText('Press [E] to view', 128, 120);
  const goalTex = new THREE.CanvasTexture(goalCanvas);
  const goalSign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: goalTex }));
  goalSign.position.set(GOAL_SIGN_POS.x, 2.2, GOAL_SIGN_POS.z);
  goalSign.rotation.y = -Math.PI / 2;
  S.add(goalSign);

  // ── AMBIENT + KEY LIGHT (store for time-of-day) ──
  S.add(new THREE.AmbientLight(0x1e2a3a, 0.9));
  whDirLight = new THREE.DirectionalLight(0xfff5e8, 0.55);
  whDirLight.position.set(5, 18, 10);
  whDirLight.castShadow = true;
  whDirLight.shadow.mapSize.width = 1024;
  whDirLight.shadow.mapSize.height = 1024;
  whDirLight.shadow.camera.near = 0.5;
  whDirLight.shadow.camera.far = 60;
  whDirLight.shadow.camera.left = -20;
  whDirLight.shadow.camera.right = 20;
  whDirLight.shadow.camera.top = 20;
  whDirLight.shadow.camera.bottom = -20;
  S.add(whDirLight);

  const lightRows = [[-5,-20],[5,-20],[-5,-10],[5,-10],[-5,0],[5,0],[-5,10],[5,10],[-5,20],[5,20]];
  lightRows.forEach(([x, z]) => {
    const light = new THREE.PointLight(0xfff5dd, 1.0, 22);
    light.position.set(x, 10.5, z);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    S.add(light);
    // Fixture box (emissive so it reads as lit)
    const fixMat = new THREE.MeshLambertMaterial({ color: 0xffffcc, emissive: 0xffee99, emissiveIntensity: 0.25 });
    const fix = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), fixMat);
    fix.position.set(x, 11.9, z);
    S.add(fix);
    // Light cone (downward glow hint)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.12 }));
    cone.position.set(x, 11.6, z);
    S.add(cone);
  });
}

function buildShelfStructure(S, shelfMat, darkMat) {
  // Two long shelf rows on left (-8x) and right (+8x)
  const rowXs = [-8, 8];
  const LEVELS = 4;
  const Z_START = -22, Z_END = 22;
  const SLOTS = 9;
  const zStep = (Z_END - Z_START) / SLOTS;

  rowXs.forEach(rx => {
    // Uprights every slot
    for (let u = 0; u <= SLOTS; u++) {
      const upZ = Z_START + u * zStep;
      for (let lv = 0; lv < LEVELS; lv++) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.06), shelfMat);
        upright.position.set(rx, 0.7 + lv * 2.0 + 1.0, upZ);
        S.add(upright);
      }
      // Tall back upright
      const tall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 9.5, 0.08), darkMat);
      tall.position.set(rx, 4.75, upZ);
      S.add(tall);
    }

    // Shelf planks
    for (let lv = 0; lv < LEVELS; lv++) {
      const shelfY = 0.55 + lv * 2.0;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, Z_END - Z_START + 1.2), shelfMat);
      plank.position.set(rx, shelfY, (Z_START + Z_END) / 2);
      plank.receiveShadow = true;
      S.add(plank);
    }
  });
}

function buildTerminal(S) {
  // Desk base
  const deskMat = new THREE.MeshPhongMaterial({ color: 0x1e2d3d, specular: 0x152030, shininess: 22 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.0), deskMat);
  desk.position.set(0, 0.45, 0);
  desk.castShadow = true;
  S.add(desk);

  // Desk legs
  const legMat = new THREE.MeshPhongMaterial({ color: 0x151f2a, specular: 0x0d151f, shininess: 15 });
  [[0.9, -0.4],[0.9, 0.4],[-0.9, -0.4],[-0.9, 0.4]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), legMat);
    leg.position.set(lx, 0.45, lz);
    S.add(leg);
  });

  // Monitor stand
  const standMat = new THREE.MeshPhongMaterial({ color: 0x0f1a24, specular: 0x0a1218, shininess: 12 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), standMat);
  stand.position.set(0, 1.15, -0.1);
  S.add(stand);

  // Monitor bezel
  const monW = 1.6, monH = 1.0;
  const monMat = new THREE.MeshPhongMaterial({ color: 0x0d1117, specular: 0x080c10, shininess: 8 });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(monW + 0.1, monH + 0.1, 0.06), monMat);
  monitor.position.set(0, 1.9, -0.1);
  S.add(monitor);

  // Screen texture — improved with subtle glow and vignette
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 512; scrCanvas.height = 320;
  const sCtx = scrCanvas.getContext('2d');
  sCtx.fillStyle = '#0a0e12';
  sCtx.fillRect(0, 0, 512, 320);
  const screenGrad = sCtx.createRadialGradient(256, 160, 0, 256, 160, 320);
  screenGrad.addColorStop(0, 'rgba(78,205,196,0.06)');
  screenGrad.addColorStop(0.5, 'transparent');
  screenGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
  sCtx.fillStyle = screenGrad;
  sCtx.fillRect(0, 0, 512, 320);
  for (let y = 0; y < 320; y += 4) { sCtx.fillStyle = 'rgba(0,0,0,0.12)'; sCtx.fillRect(0, y, 512, 2); }
  sCtx.fillStyle = '#4ecdc4';
  sCtx.font = 'bold 28px monospace';
  sCtx.textAlign = 'center';
  sCtx.fillText('SUPPLY CHAIN MGMT', 256, 60);
  sCtx.fillStyle = '#a8ff78';
  sCtx.font = '20px monospace';
  sCtx.fillText('>> TERMINAL READY <<', 256, 110);
  sCtx.fillStyle = '#f7b731';
  sCtx.font = '18px monospace';
  sCtx.fillText('Press [E] to interact', 256, 160);
  sCtx.fillStyle = '#6a7a88';
  sCtx.font = '14px monospace';
  sCtx.fillText('_', 256, 200);
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  const screenMat = new THREE.MeshBasicMaterial({ map: scrTex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(monW, monH), screenMat);
  screen.position.set(0, 1.9, -0.07);
  S.add(screen);

  // Screen glow light (stronger so terminal is a focal point)
  const glow = new THREE.PointLight(0x6ee7dc, 0.7, 5);
  glow.position.set(0, 1.9, 0.5);
  S.add(glow);

  // Keyboard
  const kbMat = new THREE.MeshPhongMaterial({ color: 0x1a2535, specular: 0x121a28, shininess: 18 });
  const kb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.35), kbMat);
  kb.position.set(0, 0.92, 0.25);
  S.add(kb);

  // Chair
  buildChair(S, 0, 0, 1.4);
}

function buildChair(S, x, y, z) {
  const mat = new THREE.MeshPhongMaterial({ color: 0x2a1a2e, specular: 0x1a1220, shininess: 20 });
  const dark = new THREE.MeshPhongMaterial({ color: 0x111111, specular: 0x080808, shininess: 5 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), mat);
  seat.position.set(x, y + 0.55, z); S.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.06), mat);
  back.position.set(x, y + 1.05, z - 0.37); S.add(back);
  // Legs
  [[0.3,0.3],[0.3,-0.3],[-0.3,0.3],[-0.3,-0.3]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), dark);
    leg.position.set(x + lx, y + 0.275, z + lz); S.add(leg);
  });
  // Center pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), dark);
  pole.position.set(x, y + 0.275, z); S.add(pole);
}

function buildDoor(S, x, y, z, ry) {
  const frameMat = new THREE.MeshPhongMaterial({ color: 0x243050, specular: 0x1a2840, shininess: 25 });
  const doorMat  = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, specular: 0x122840, shininess: 22 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.5, 0.2), frameMat);
  frame.position.set(x, 2.25, z); frame.rotation.y = ry; S.add(frame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.0, 0.1), doorMat);
  door.position.set(x, 2.0, z + (ry === 0 ? 0.06 : -0.06)); door.rotation.y = ry; S.add(door);
  const handleMat = new THREE.MeshPhongMaterial({ color: 0xf7b731, specular: 0xdda020, shininess: 50 });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), handleMat);
  handle.position.set(x + 0.9, 1.1, z + (ry === 0 ? 0.12 : -0.12)); S.add(handle);
}

function buildForklift(S, x, y, z) {
  const bodyMat  = new THREE.MeshPhongMaterial({ color: 0xf7b731, specular: 0xdda020, shininess: 40 });
  const darkMat  = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, specular: 0x0a0a0a, shininess: 15 });
  const redMat   = new THREE.MeshPhongMaterial({ color: 0xe94560, specular: 0xcc3350, shininess: 45 });
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 2.2), bodyMat);
  body.position.set(x, y + 0.55, z); body.castShadow = true; S.add(body);
  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.9), bodyMat);
  cabin.position.set(x, y + 1.5, z + 0.5); S.add(cabin);
  // Cabin windows
  const winMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), winMat);
  win.position.set(x, y + 1.55, z + 0.96); S.add(win);
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12);
  [[-0.75,-0.85],[0.75,-0.85],[-0.75,0.85],[0.75,0.85]].forEach(([wx,wz]) => {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x + wx, y + 0.28, z + wz); S.add(w);
    // Hubcap
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 8), redMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x + wx, y + 0.28, z + wz); S.add(hub);
  });
  // Mast uprights
  const mastMat = new THREE.MeshPhongMaterial({ color: 0x888888, specular: 0x555555, shininess: 30 });
  [-0.35, 0.35].forEach(mx => {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.0, 0.08), mastMat);
    mast.position.set(x + mx, y + 1.85, z - 1.25); S.add(mast);
  });
  // Forks
  const forkMat = new THREE.MeshPhongMaterial({ color: 0x666666, specular: 0x444444, shininess: 25 });
  [-0.28, 0.28].forEach(fx => {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 1.4), forkMat);
    fork.position.set(x + fx, y + 0.55, z - 1.85); S.add(fork);
  });
}

// ─────────────────────────────────────────────
// DYNAMIC CONTENT — rebuild shelf boxes + sign
// ─────────────────────────────────────────────
function rebuildWarehouseContents() {
  if (!whScene) return;

  // Remove old box group and sign
  if (whBoxGroup) { whScene.remove(whBoxGroup); whBoxGroup = null; }
  if (whSignMesh) { whScene.remove(whSignMesh); whSignMesh = null; }
  if (whFillBar)  { whScene.remove(whFillBar);  whFillBar  = null; }

  const inv  = typeof inventory !== 'undefined' ? inventory : 0;
  const cap  = typeof warehouseCapacity === 'function' ? warehouseCapacity() : 100;
  const fillRatio = Math.min(inv / cap, 1);

  whBoxGroup = new THREE.Group();

  const boxMat   = new THREE.MeshPhongMaterial({ color: 0xf7b731, specular: 0xdda020, shininess: 35 });
  const emptyMat = new THREE.MeshPhongMaterial({ color: 0x1e1e2e, specular: 0x151520, shininess: 8 });
  const labelMat = new THREE.MeshPhongMaterial({ color: 0xb45309, specular: 0x8a3d06, shininess: 30 });

  const rowXs = [-8, 8];
  const SHELF_LEVELS = 4;
  const Z_START = -22, Z_END = 22;
  const SLOTS = 9;
  const zStep = (Z_END - Z_START) / SLOTS;
  const totalSlots = rowXs.length * SHELF_LEVELS * SLOTS;
  let filledSlots = Math.round(fillRatio * totalSlots);
  let idx = 0;

  rowXs.forEach(rx => {
    for (let lv = 0; lv < SHELF_LEVELS; lv++) {
      const shelfY = 0.55 + lv * 2.0;
      for (let s = 0; s < SLOTS; s++) {
        const boxZ = Z_START + s * zStep + zStep / 2;
        const filled = idx < filledSlots;
        idx++;

        const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.82, 0.85), filled ? boxMat : emptyMat);
        box.position.set(rx, shelfY + 0.44, boxZ);
        box.castShadow = true;
        whBoxGroup.add(box);

        if (filled) {
          // Top stripe
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.05), labelMat);
          stripe.position.set(rx, shelfY + 0.44, boxZ + 0.43);
          whBoxGroup.add(stripe);
          // Cross line
          const cross = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.82, 0.05), labelMat);
          cross.position.set(rx + 0.43, shelfY + 0.44, boxZ);
          whBoxGroup.add(cross);
        }
      }
    }
  });

  whScene.add(whBoxGroup);

  // ── Back wall sign (gradient + drop shadow for depth) ──
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024; signCanvas.height = 256;
  const sCtx = signCanvas.getContext('2d');
  const grad = sCtx.createLinearGradient(0, 0, 1024, 256);
  grad.addColorStop(0, '#0c1a2e'); grad.addColorStop(0.5, '#0d1f38'); grad.addColorStop(1, '#0a1628');
  sCtx.fillStyle = grad; sCtx.fillRect(0, 0, 1024, 256);
  sCtx.strokeStyle = 'rgba(78,205,196,0.6)'; sCtx.lineWidth = 6;
  sCtx.strokeRect(6, 6, 1012, 244);
  sCtx.shadowColor = 'rgba(0,0,0,0.7)'; sCtx.shadowBlur = 8; sCtx.shadowOffsetX = 2; sCtx.shadowOffsetY = 2;
  sCtx.fillStyle = '#4ecdc4'; sCtx.font = 'bold 38px monospace'; sCtx.textAlign = 'center';
  sCtx.fillText('WAREHOUSE INVENTORY STATUS', 512, 60);
  sCtx.shadowBlur = 6; sCtx.shadowOffsetX = 1; sCtx.shadowOffsetY = 1;
  sCtx.fillStyle = '#f7b731'; sCtx.font = 'bold 80px monospace';
  sCtx.fillText(`${inv}`, 320, 175);
  sCtx.fillStyle = '#9aa3b2'; sCtx.font = 'bold 50px monospace';
  sCtx.fillText(`/ ${cap}`, 680, 175);
  sCtx.shadowBlur = 0; sCtx.shadowOffsetX = 0; sCtx.shadowOffsetY = 0;
  sCtx.fillStyle = '#a8ff78'; sCtx.font = '28px monospace';
  sCtx.fillText(`UNITS  (${Math.round(fillRatio * 100)}% full)`, 512, 230);

  const signTex = new THREE.CanvasTexture(signCanvas);
  whSignMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.3),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  whSignMesh.position.set(0, 8.5, -27.7);
  whScene.add(whSignMesh);

  // ── Fill bar under sign ──
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.45), new THREE.MeshBasicMaterial({ color: 0x1a2535 }));
  barBg.position.set(0, 6.7, -27.7);
  whScene.add(barBg);

  if (fillRatio > 0) {
    const barColor = fillRatio > 0.9 ? 0xe94560 : fillRatio > 0.6 ? 0xf7b731 : 0x4ecdc4;
    whFillBar = new THREE.Mesh(
      new THREE.PlaneGeometry(12 * fillRatio, 0.45),
      new THREE.MeshBasicMaterial({ color: barColor })
    );
    whFillBar.position.set(-6 + (12 * fillRatio) / 2, 6.7, -27.69);
    whScene.add(whFillBar);
  }
}

// ─────────────────────────────────────────────
// GAME LOOP
// ─────────────────────────────────────────────
function whLoop() {
  if (!whActive) return;
  if (!whRenderer || !whScene || !whCamera) {
    whAnimFrame = requestAnimationFrame(whLoop);
    return;
  }
  whAnimFrame = requestAnimationFrame(whLoop);

  const now = performance.now();
  const dt  = Math.min((now - whClock) / 1000, 0.05);
  whClock = now;

  if (whCamera && !whTerminalOpen) {
    // Camera rotation
    const euler = new THREE.Euler(whPitch, whYaw, 0, 'YXZ');
    whCamera.quaternion.setFromEuler(euler);

    // Movement
    const dir = new THREE.Vector3();
    if (whKeys['KeyW'] || whKeys['ArrowUp'])    dir.z -= 1;
    if (whKeys['KeyS'] || whKeys['ArrowDown'])  dir.z += 1;
    if (whKeys['KeyA'] || whKeys['ArrowLeft'])  dir.x -= 1;
    if (whKeys['KeyD'] || whKeys['ArrowRight']) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize().applyEuler(new THREE.Euler(0, whYaw, 0));
      dir.multiplyScalar(WALK_SPEED * dt);
      whCamera.position.add(dir);
      // Keep inside warehouse bounds
      whCamera.position.x = Math.max(-13, Math.min(13, whCamera.position.x));
      whCamera.position.z = Math.max(-26, Math.min(26, whCamera.position.z));
      whCamera.position.y = 1.7;
    }

    // Proximity prompt (terminal > incoming > goal); hide when a panel is open
    const promptEl = document.getElementById('wh-interact-prompt');
    const labelEl = document.getElementById('wh-interact-label');
    if (whInfoPanelOpen) {
      promptEl.style.display = 'none';
    } else {
    const nearTerminal = isNearTerminal();
    const nearIncoming = isNearIncomingBoard();
    const nearGoal = isNearGoalSign();
    if (nearTerminal) {
      promptEl.style.display = 'block';
      if (labelEl) labelEl.textContent = 'Open Terminal';
    } else if (nearIncoming) {
      promptEl.style.display = 'block';
      if (labelEl) labelEl.textContent = 'View Incoming Shipments';
    } else if (nearGoal) {
      promptEl.style.display = 'block';
      if (labelEl) labelEl.textContent = 'View Level Goal';
    } else {
      promptEl.style.display = 'none';
    }
    }
  }

  // Time-of-day: cycle over 20 turns (slightly darker toward "evening", then bright again)
  if (whDirLight && whScene && whScene.fog) {
    const t = typeof turn !== 'undefined' ? turn : 1;
    const phase = ((t - 1) % 20) / 20;
    const intensity = 0.45 + 0.2 * Math.sin(phase * Math.PI);
    whDirLight.intensity = intensity;
    const r = 1, g = 0.96 + 0.04 * (1 - phase), b = 0.91 + 0.09 * (1 - phase);
    whDirLight.color.setRGB(r, g, b);
    const fogR = 0.04 + 0.02 * phase, fogG = 0.06 + 0.02 * phase, fogB = 0.09 + 0.02 * phase;
    whScene.fog.color.setRGB(fogR, fogG, fogB);
  }

  // Event flash (good = green, bad = red) — fade over ~1.5s
  const flashEl = document.getElementById('event-flash');
  if (flashEl && typeof window !== 'undefined' && window.__supplyChainEvent) {
    const ev = window.__supplyChainEvent;
    const elapsed = performance.now() - ev.at;
    if (elapsed < 100) {
      flashEl.classList.remove('event-flash-hidden', 'event-flash-good', 'event-flash-bad');
      flashEl.classList.add(ev.type === 'good' ? 'event-flash-good' : 'event-flash-bad');
    } else if (elapsed > 1500) {
      flashEl.classList.add('event-flash-hidden');
      flashEl.classList.remove('event-flash-good', 'event-flash-bad');
      delete window.__supplyChainEvent;
    }
  }

  if (whRenderer && whScene && whCamera) {
    whRenderer.render(whScene, whCamera);
  }
}
