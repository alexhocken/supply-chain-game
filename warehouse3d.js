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

// Terminal position in world space (the terminal object)
const TERMINAL_INTERACT_DIST = 5.0;

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
  if (document.pointerLockElement) document.exitPointerLock();
  whPointerLocked = false;
  whKeys = {};
  whTerminalOpen = false;
  whHasStarted = false;
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
    } else {
      // Release pointer lock but stay in warehouse
      if (document.pointerLockElement) document.exitPointerLock();
    }
    return;
  }

  if (e.code === 'KeyE' && !whTerminalOpen) {
    if (isNearTerminal()) openTerminal();
  }
}

function whOnKeyUp(e) { whKeys[e.code] = false; }

function whOnMouseMove(e) {
  if (!whPointerLocked || whTerminalOpen) return;
  whYaw   -= e.movementX * LOOK_SENS;
  whPitch -= e.movementY * LOOK_SENS;
  whPitch  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, whPitch));
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
  whScene.fog = new THREE.Fog(0x0a0f1a, 25, 55);

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

  // ── MATERIALS ──
  const floorMat  = new THREE.MeshLambertMaterial({ color: 0x1e1e2e });
  const wallMat   = new THREE.MeshLambertMaterial({ color: 0x1a2f4a });
  const ceilMat   = new THREE.MeshLambertMaterial({ color: 0x0d1520 });
  const shelfMat  = new THREE.MeshLambertMaterial({ color: 0x3d2e1e });
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x1c2d44 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xe94560 });
  const stripeY   = new THREE.MeshLambertMaterial({ color: 0xf7b731 });
  const darkMat   = new THREE.MeshLambertMaterial({ color: 0x111111 });

  // ── FLOOR ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  S.add(floor);

  // Floor tiles (grid lines)
  for (let x = -14; x <= 14; x += 2) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 60), new THREE.MeshLambertMaterial({ color: 0x252535 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.001, 0);
    S.add(line);
  }
  for (let z = -29; z <= 29; z += 2) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.03), new THREE.MeshLambertMaterial({ color: 0x252535 }));
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
  const wallAccent = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
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
  const beamMat = new THREE.MeshLambertMaterial({ color: 0x162030 });
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
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), new THREE.MeshLambertMaterial({ color: 0xe94560 }));
    base.position.set(x, 0.075, z);
    S.add(base);
  });

  // ── SHELVING UPRIGHTS (static) ──
  buildShelfStructure(S, shelfMat, darkMat);

  // ── ENTRANCE DOOR (back wall) ──
  buildDoor(S, 0, 0, 27.5, Math.PI);

  // ── EXIT SIGN ──
  const exitGeo = new THREE.PlaneGeometry(2, 0.5);
  const exitMat = new THREE.MeshBasicMaterial({ color: 0x00cc55 });
  const exitSign = new THREE.Mesh(exitGeo, exitMat);
  exitSign.position.set(0, 11, -27.8);
  S.add(exitSign);

  // ── TERMINAL (center of warehouse) ──
  buildTerminal(S);

  // ── FORKLIFT ──
  buildForklift(S, 3, 0, 15);

  // ── AMBIENT + LIGHTS ──
  S.add(new THREE.AmbientLight(0x223355, 1.2));

  const lightRows = [[-5,-20],[5,-20],[-5,-10],[5,-10],[-5,0],[5,0],[-5,10],[5,10],[-5,20],[5,20]];
  lightRows.forEach(([x, z]) => {
    const light = new THREE.PointLight(0xfff5dd, 1.0, 22);
    light.position.set(x, 10.5, z);
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256);
    S.add(light);
    // Fixture box
    const fix = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
    fix.position.set(x, 11.9, z);
    S.add(fix);
    // Light cone (downward glow hint)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.08 }));
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
  const deskMat = new THREE.MeshLambertMaterial({ color: 0x1e2d3d });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.0), deskMat);
  desk.position.set(0, 0.45, 0);
  desk.castShadow = true;
  S.add(desk);

  // Desk legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x151f2a });
  [[0.9, -0.4],[0.9, 0.4],[-0.9, -0.4],[-0.9, 0.4]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), legMat);
    leg.position.set(lx, 0.45, lz);
    S.add(leg);
  });

  // Monitor stand
  const standMat = new THREE.MeshLambertMaterial({ color: 0x0f1a24 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), standMat);
  stand.position.set(0, 1.15, -0.1);
  S.add(stand);

  // Monitor screen — canvas texture showing "TERMINAL"
  const monW = 1.6, monH = 1.0;
  const monMat = new THREE.MeshLambertMaterial({ color: 0x0d1117 });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(monW + 0.1, monH + 0.1, 0.06), monMat);
  monitor.position.set(0, 1.9, -0.1);
  S.add(monitor);

  // Screen glow texture
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 512; scrCanvas.height = 320;
  const sCtx = scrCanvas.getContext('2d');
  sCtx.fillStyle = '#0d1117'; sCtx.fillRect(0, 0, 512, 320);
  // Scanlines
  for (let y = 0; y < 320; y += 4) { sCtx.fillStyle = 'rgba(0,0,0,0.15)'; sCtx.fillRect(0, y, 512, 2); }
  sCtx.fillStyle = '#4ecdc4'; sCtx.font = 'bold 28px monospace'; sCtx.textAlign = 'center';
  sCtx.fillText('SUPPLY CHAIN MGMT', 256, 60);
  sCtx.fillStyle = '#a8ff78'; sCtx.font = '20px monospace';
  sCtx.fillText('>> TERMINAL READY <<', 256, 110);
  sCtx.fillStyle = '#f7b731'; sCtx.font = '18px monospace';
  sCtx.fillText('Press [E] to interact', 256, 160);
  sCtx.fillStyle = '#555'; sCtx.font = '14px monospace';
  sCtx.fillText('_', 256 + Math.random() * 4, 200); // cursor blink placeholder
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(monW, monH), new THREE.MeshBasicMaterial({ map: scrTex }));
  screen.position.set(0, 1.9, -0.07);
  S.add(screen);

  // Screen glow light
  const glow = new THREE.PointLight(0x4ecdc4, 0.6, 4);
  glow.position.set(0, 1.9, 0.5);
  S.add(glow);

  // Keyboard
  const kbMat = new THREE.MeshLambertMaterial({ color: 0x1a2535 });
  const kb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.35), kbMat);
  kb.position.set(0, 0.92, 0.25);
  S.add(kb);

  // Chair
  buildChair(S, 0, 0, 1.4);
}

function buildChair(S, x, y, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a1a2e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x111111 });
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
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x243050 });
  const doorMat  = new THREE.MeshLambertMaterial({ color: 0x1a3a5c });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.5, 0.2), frameMat);
  frame.position.set(x, 2.25, z); frame.rotation.y = ry; S.add(frame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.0, 0.1), doorMat);
  door.position.set(x, 2.0, z + (ry === 0 ? 0.06 : -0.06)); door.rotation.y = ry; S.add(door);
  // Door handle
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf7b731 }));
  handle.position.set(x + 0.9, 1.1, z + (ry === 0 ? 0.12 : -0.12)); S.add(handle);
}

function buildForklift(S, x, y, z) {
  const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xf7b731 });
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const redMat   = new THREE.MeshLambertMaterial({ color: 0xe94560 });
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
  const mastMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  [-0.35, 0.35].forEach(mx => {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.0, 0.08), mastMat);
    mast.position.set(x + mx, y + 1.85, z - 1.25); S.add(mast);
  });
  // Forks
  const forkMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
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

  const boxMat   = new THREE.MeshLambertMaterial({ color: 0xf7b731 });
  const emptyMat = new THREE.MeshLambertMaterial({ color: 0x1e1e2e });
  const labelMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });

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

  // ── Back wall sign ──
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024; signCanvas.height = 256;
  const sCtx = signCanvas.getContext('2d');
  // Background
  const grad = sCtx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#0a1628'); grad.addColorStop(1, '#0d1f38');
  sCtx.fillStyle = grad; sCtx.fillRect(0, 0, 1024, 256);
  // Border
  sCtx.strokeStyle = '#4ecdc4'; sCtx.lineWidth = 6;
  sCtx.strokeRect(6, 6, 1012, 244);
  // Title
  sCtx.fillStyle = '#4ecdc4'; sCtx.font = 'bold 38px monospace'; sCtx.textAlign = 'center';
  sCtx.fillText('WAREHOUSE INVENTORY STATUS', 512, 60);
  // Big numbers
  sCtx.fillStyle = '#f7b731'; sCtx.font = 'bold 80px monospace';
  sCtx.fillText(`${inv}`, 320, 175);
  sCtx.fillStyle = '#9aa3b2'; sCtx.font = 'bold 50px monospace';
  sCtx.fillText(`/ ${cap}`, 680, 175);
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

    // Proximity prompt
    const near = isNearTerminal();
    document.getElementById('wh-interact-prompt').style.display = near ? 'block' : 'none';
  }

  if (whRenderer && whScene && whCamera) {
    whRenderer.render(whScene, whCamera);
  }
}