// ============================================================
// PIXEL ART SCENE
// ============================================================
const SCENE_W = 800;
const SCENE_H = 160;

let sceneCanvas, ctx;
let sceneAnimations = [];
let sceneFrame = 0;
let sceneInterval = null;

function initScene() {
  sceneCanvas = document.getElementById('scene-canvas');
  ctx = sceneCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawScene([]);
  startSceneLoop();
}

function startSceneLoop() {
  if (sceneInterval) clearInterval(sceneInterval);
  sceneInterval = setInterval(() => {
    sceneFrame++;
    sceneAnimations = sceneAnimations.filter(a => { a.x += a.vx; a.y += a.vy; a.life--; return a.life > 0; });
    drawScene(sceneAnimations);
  }, 50);
}

function triggerSceneAnimation(hasInbound, unitsSold, isExpedited) {
  if (hasInbound) sceneAnimations.push({ type: isExpedited ? 'truck_fast' : 'truck', x: -80, y: SCENE_H - 48, vx: isExpedited ? 10 : 5, vy: 0, life: isExpedited ? 16 : 28 });
  if (unitsSold > 0) {
    const count = Math.min(5, Math.ceil(unitsSold / 4));
    for (let i = 0; i < count; i++) sceneAnimations.push({ type: 'box', x: SCENE_W / 2 + 20, y: SCENE_H - 44 - i * 6, vx: 6 + i, vy: -0.5, life: 22 - i * 2 });
  }
}

function drawScene(anims) {
  if (!ctx) return;
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);
  const sky = ctx.createLinearGradient(0, 0, 0, SCENE_H);
  sky.addColorStop(0, '#0a0f1a'); sky.addColorStop(1, '#111827');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  ctx.fillStyle = '#ffffff';
  [[40,12],[120,8],[200,20],[320,6],[450,14],[600,9],[700,18],[760,5],[80,30],[500,28]].forEach(([sx,sy]) => ctx.fillRect(sx,sy,2,2));
  ctx.fillStyle = '#1a2540'; ctx.fillRect(0, SCENE_H - 20, SCENE_W, 20);
  ctx.fillStyle = '#243050'; ctx.fillRect(0, SCENE_H - 22, SCENE_W, 4);
  ctx.fillStyle = '#f7b731';
  for (let rx = 0; rx < SCENE_W; rx += 60) ctx.fillRect(rx + ((sceneFrame * 3) % 60), SCENE_H - 14, 30, 3);
  drawWarehouse(180, SCENE_H - 20);
  drawShop(620, SCENE_H - 20);
  anims.forEach(a => {
    if (a.type === 'truck' || a.type === 'truck_fast') drawTruck(a.x, a.y, a.type === 'truck_fast');
    if (a.type === 'box') drawBox(a.x, a.y);
  });
  ctx.fillStyle = '#4ecdc4'; ctx.font = 'bold 11px monospace'; ctx.fillText('WAREHOUSE', 148, SCENE_H - 88);
  ctx.fillStyle = '#f7b731'; ctx.fillText('CUSTOMERS', 593, SCENE_H - 88);
}

function drawWarehouse(x, y) {
  ctx.fillStyle = '#1e3a5f'; ctx.fillRect(x - 60, y - 70, 120, 70);
  ctx.fillStyle = '#e94560'; ctx.fillRect(x - 64, y - 76, 128, 10);
  ctx.fillStyle = '#c73652';
  ctx.beginPath(); ctx.moveTo(x - 70, y - 76); ctx.lineTo(x, y - 96); ctx.lineTo(x + 70, y - 76); ctx.fill();
  ctx.fillStyle = '#0a1628'; ctx.fillRect(x - 18, y - 36, 36, 36);
  ctx.fillStyle = '#4ecdc4'; ctx.fillRect(x - 16, y - 34, 14, 32); ctx.fillRect(x + 2, y - 34, 14, 32);
  ctx.fillStyle = '#f7b731'; ctx.fillRect(x - 50, y - 58, 18, 14); ctx.fillRect(x + 32, y - 58, 18, 14);
  if (sceneFrame % 20 < 10) { ctx.fillStyle = 'rgba(247,183,49,0.15)'; ctx.fillRect(x - 50, y - 58, 18, 14); }
  ctx.fillStyle = '#2d4a6e'; ctx.fillRect(x + 40, y - 100, 12, 28);
  const smokeOff = sceneFrame % 30;
  ctx.fillStyle = 'rgba(150,160,180,0.4)'; ctx.beginPath(); ctx.arc(x + 46, y - 104 - smokeOff * 0.8, 5 + smokeOff * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(150,160,180,0.2)'; ctx.beginPath(); ctx.arc(x + 50, y - 110 - smokeOff * 0.6, 7, 0, Math.PI * 2); ctx.fill();
}

function drawShop(x, y) {
  ctx.fillStyle = '#2a1f4e'; ctx.fillRect(x - 50, y - 65, 100, 65);
  ctx.fillStyle = '#7c3aed'; ctx.fillRect(x - 54, y - 71, 108, 10);
  ctx.fillStyle = '#6d28d9';
  ctx.beginPath(); ctx.moveTo(x - 58, y - 71); ctx.lineTo(x, y - 88); ctx.lineTo(x + 58, y - 71); ctx.fill();
  ctx.fillStyle = '#0a1628'; ctx.fillRect(x - 14, y - 32, 28, 32);
  ctx.fillStyle = '#a78bfa'; ctx.fillRect(x - 12, y - 30, 10, 28); ctx.fillRect(x + 2, y - 30, 10, 28);
  ctx.fillStyle = '#f7b731'; ctx.fillRect(x - 30, y - 55, 60, 14);
  ctx.fillStyle = '#0a1628'; ctx.font = 'bold 9px monospace'; ctx.fillText('SHOP', x - 13, y - 45);
  ctx.fillStyle = sceneFrame % 24 < 12 ? '#fbbf24' : '#f59e0b';
  ctx.fillRect(x - 42, y - 56, 16, 12); ctx.fillRect(x + 26, y - 56, 16, 12);
  const personBob = Math.sin(sceneFrame * 0.15) * 2;
  ctx.fillStyle = '#e94560'; ctx.fillRect(x - 68, y - 20 + personBob, 8, 16);
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x - 64, y - 24 + personBob, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4ecdc4'; ctx.fillRect(x - 80, y - 18 + Math.sin(sceneFrame * 0.12) * 2, 8, 14);
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x - 76, y - 22 + Math.sin(sceneFrame * 0.12) * 2, 5, 0, Math.PI * 2); ctx.fill();
}

function drawTruck(x, y, fast) {
  const col = fast ? '#f7b731' : '#4ecdc4';
  ctx.fillStyle = col; ctx.fillRect(x + 44, y - 28, 28, 28);
  ctx.fillStyle = '#0a1628'; ctx.fillRect(x + 48, y - 24, 18, 12);
  ctx.fillStyle = fast ? '#b45309' : '#1e5f8e'; ctx.fillRect(x, y - 28, 46, 28);
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.arc(x + 12, y + 2, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 56, y + 2, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#555';
  ctx.beginPath(); ctx.arc(x + 12, y + 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 56, y + 2, 4, 0, Math.PI * 2); ctx.fill();
  if (fast) {
    ctx.strokeStyle = 'rgba(247,183,49,0.4)'; ctx.lineWidth = 2;
    for (let li = 0; li < 3; li++) { ctx.beginPath(); ctx.moveTo(x-10-li*14,y-10-li*4); ctx.lineTo(x-30-li*14,y-10-li*4); ctx.stroke(); }
  }
  ctx.fillStyle = '#f7b731'; ctx.fillRect(x + 6, y - 40, 20, 14);
  ctx.fillStyle = '#b45309'; ctx.fillRect(x + 6, y - 40, 20, 3); ctx.fillRect(x + 14, y - 40, 3, 14);
}

function drawBox(x, y) {
  ctx.fillStyle = '#f7b731'; ctx.fillRect(x, y, 16, 14);
  ctx.fillStyle = '#b45309'; ctx.fillRect(x, y, 16, 3); ctx.fillRect(x + 6, y, 3, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 2, y + 14, 16, 3);
}

// ============================================================
// CONSTANTS & CONFIG
// ============================================================
const BASE_UNIT_COST = 2;
const ORDER_FEE = 10;
const EXTERNAL_STORAGE_COST = 5;
const MISSED_ORDER_PENALTY = 2;
const EXPEDITED_FEE = 20;
const MAX_TURNS = 20;

const LEVELS = [
  { level: 1, goalCash: 500,   label: 'Getting Started',  unlocksUpgrades: [] },
  { level: 2, goalCash: 1000,  label: 'Growing Fast',     unlocksUpgrades: ['warehouse','marketing','forecast','supplier_contract'] },
  { level: 3, goalCash: 2500,  label: 'Regional Player',  unlocksUpgrades: ['fast_shipping','insurance'] },
  { level: 4, goalCash: 5000,  label: 'Market Leader',    unlocksUpgrades: [] },
  { level: 5, goalCash: 10000, label: 'Supply Chain Pro', unlocksUpgrades: [] },
];

const DIFFICULTY_SETTINGS = {
  easy:   { volatility: 0.2, eventImpact: 'mild',     label: 'Easy' },
  medium: { volatility: 0.5, eventImpact: 'moderate', label: 'Medium' },
  hard:   { volatility: 0.9, eventImpact: 'brutal',   label: 'Hard' }
};

// ============================================================
// UPGRADES
// ============================================================
const UPGRADE_DEFS = {
  warehouse:         { id:'warehouse',         icon:'🏭', name:'🏭 Warehouse Expansion',  desc:'Increase warehouse capacity.', repeatable:false, unlockedAt:2, tiers:[{cost:150,label:'Tier 1',effect:'Capacity: 100→200'},{cost:300,label:'Tier 2',effect:'Capacity: 200→300'},{cost:500,label:'Tier 3',effect:'Capacity: 300→500'}] },
  marketing:         { id:'marketing',         icon:'📣', name:'📣 Marketing Campaign',   desc:'Demand +40% for 3 turns. Repeatable.', repeatable:true, unlockedAt:2, tiers:[{cost:100,label:'Launch',effect:'Demand +40% for 3 turns'},{cost:100,label:'Launch',effect:'Demand +40% for 3 turns'},{cost:100,label:'Launch',effect:'Demand +40% for 3 turns'}] },
  forecast:          { id:'forecast',          icon:'🔮', name:'🔮 Forecasting Tool',     desc:'See predicted demand 2 turns ahead.', repeatable:false, unlockedAt:2, tiers:[{cost:200,label:'Unlock',effect:'Demand forecast shown each turn'}] },
  fast_shipping:     { id:'fast_shipping',     icon:'⚡', name:'⚡ Fast Shipping Lane',   desc:'Reduce standard lead time to 1 turn permanently.', repeatable:false, unlockedAt:3, tiers:[{cost:400,label:'Unlock',effect:'Lead time: 2 turns→1 turn'}] },
  insurance:         { id:'insurance',         icon:'🛡️', name:'🛡️ Event Insurance',      desc:'Block bad random events each level.', repeatable:false, unlockedAt:3, tiers:[{cost:150,label:'Basic',effect:'Block 1 bad event/level'},{cost:250,label:'Premium',effect:'Block 2 bad events/level'},{cost:400,label:'Platinum',effect:'Block 3 bad events/level'}] },
  supplier_contract: { id:'supplier_contract', icon:'🤝', name:'🤝 Supplier Contract', desc:'Lock in a lower unit cost AND unlock bulk order discounts (25+, 50+, 75+ units).', repeatable:false, unlockedAt:2, tiers:[{cost:300,label:'Silver',effect:'Unit cost: $2→$1.50 + bulk discounts'},{cost:500,label:'Gold',effect:'Unit cost: $1.50→$1.00 + bulk discounts'}] },
};

// ============================================================
// GAME STATE
// ============================================================
let cash, inventory, turn, pipeline, difficulty, goalCash, currentLevel;
let stockouts, totalRevenue, turnProfits, pricesCharged;
let history, charts = {};
let gameActive = false;

let upgrades = {};

function resetUpgrades() {
  upgrades = {
    warehouse:         { tier: 0 },
    marketing:         { tier: 0, turnsLeft: 0 },
    forecast:          { tier: 0 },
    fast_shipping:     { tier: 0 },
    insurance:         { tier: 0, blocksLeft: 0 },
    supplier_contract: { tier: 0 },
  };
}

// Derived effects
function warehouseCapacity()  { return [100,200,300,500][upgrades.warehouse.tier]; }
function effectiveUnitCost()  { return [2,2,1.5,1.0][upgrades.supplier_contract.tier]; }
function hasForecasting()     { return upgrades.forecast.tier >= 1; }
function hasFastShipping()    { return upgrades.fast_shipping.tier >= 1; }
function insuranceBlocks()    { return [0,1,2,3][upgrades.insurance.tier]; }
function marketingActive()    { return upgrades.marketing.turnsLeft > 0; }
function hasSupplierContract(){ return upgrades.supplier_contract.tier >= 1; }

// Bulk discount tiers - only available with Supplier Contract upgrade
function getBulkUnitCost(qty) {
  const base = effectiveUnitCost();
  if (!hasSupplierContract()) return { cost: base, label: null };
  if (qty >= 75) return { cost: +(base * 0.70).toFixed(2), label: '30% bulk discount (75+ units)' };
  if (qty >= 50) return { cost: +(base * 0.80).toFixed(2), label: '20% bulk discount (50+ units)' };
  if (qty >= 25) return { cost: +(base * 0.90).toFixed(2), label: '10% bulk discount (25+ units)' };
  return { cost: base, label: null };
}
// ============================================================
// LEADERBOARD (JSONBin.io)
// ============================================================
const JSONBIN_KEY = '$2a$10$O2eobAdq7kf6upqFVUvuWOwetzxmDrL1U8svCeM35BqGhYa.8DK76';
const JSONBIN_BASE = 'https://api.jsonbin.io/v3';
let JSONBIN_BIN_ID = null;

async function getOrCreateBin() {
  if (JSONBIN_BIN_ID) return JSONBIN_BIN_ID;
  // Try to find existing bin by name
  try {
    const res = await fetch(`${JSONBIN_BASE}/b`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Name': 'supply-chain-leaderboard', 'X-Bin-Private': 'false' },
      body: JSON.stringify({ scores: [] })
    });
    const data = await res.json();
    if (data.metadata && data.metadata.id) {
      JSONBIN_BIN_ID = data.metadata.id;
      localStorage.setItem('scg_bin_id', JSONBIN_BIN_ID);
      return JSONBIN_BIN_ID;
    }
  } catch(e) { console.error('Bin create error', e); }
  return null;
}

async function ensureBinId() {
  // Cache bin ID in localStorage so we don't create a new bin every time
  const cached = localStorage.getItem('scg_bin_id');
  if (cached) { JSONBIN_BIN_ID = cached; return JSONBIN_BIN_ID; }
  return await getOrCreateBin();
}

async function loadLeaderboard() {
  try {
    const binId = await ensureBinId();
    if (!binId) return [];
    const res = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    const data = await res.json();
    return data.record?.scores || [];
  } catch(e) { console.error('Load leaderboard failed', e); return []; }
}

async function saveScore(name, score, level) {
  try {
    const binId = await ensureBinId();
    if (!binId) return;
    const existing = await loadLeaderboard();
    existing.push({ name, score, level, date: new Date().toLocaleDateString() });
    existing.sort((a, b) => b.score - a.score);
    const top10 = existing.slice(0, 10);
    await fetch(`${JSONBIN_BASE}/b/${binId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
      body: JSON.stringify({ scores: top10 })
    });
  } catch(e) { console.error('Save score failed', e); }
}

async function renderLeaderboard() {
  const el = document.getElementById('leaderboard-list');
  el.innerHTML = '<div style="color:#9aa3b2;font-size:13px">Loading...</div>';
  try {
    const scores = await loadLeaderboard();
    if (!scores.length) { el.innerHTML = '<div style="color:#9aa3b2;font-size:13px">No scores yet. Be the first!</div>'; return; }
    el.innerHTML = scores.map((s, i) => `
      <div class="lb-row">
        <span class="lb-rank">#${i+1}</span>
        <span class="lb-name">${s.name}</span>
        <span class="lb-level">Lvl ${s.level}</span>
        <span class="lb-score">$${Number(s.score).toLocaleString()}</span>
        <span class="lb-date">${s.date}</span>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:#e94560;font-size:13px">Could not load leaderboard.</div>';
  }
}

// ============================================================
// START / RESTART
// ============================================================
function startGame(diff) {
  difficulty = diff;
  currentLevel = 1;
  resetUpgrades();
  cash = 100;
  inventory = 100;
  startLevel();
}

function startLevel() {
  const lvlDef = LEVELS[Math.min(currentLevel-1, LEVELS.length-1)];
  if (currentLevel > 5) {
    goalCash = Math.round(10000 * Math.pow(1.8, currentLevel-5));
  } else {
    goalCash = lvlDef.goalCash;
  }

  turn = 1;
  pipeline = hasFastShipping() ? [0] : [0,0];
  stockouts = 0; totalRevenue = 0; turnProfits = []; pricesCharged = [];
  gameActive = true;
  upgrades.insurance.blocksLeft = insuranceBlocks();
  history = { turns:[], inventory:[], price:[], demand:[], cash:[] };

  document.getElementById('difficulty-screen').style.display = 'none';
  document.getElementById('upgrade-shop').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';

  document.getElementById('goal-display').textContent = goalCash.toLocaleString();
  document.getElementById('max-turns').textContent = MAX_TURNS;
  document.getElementById('level-display').textContent = currentLevel;
  document.getElementById('level-name-display').textContent = currentLevel > 5 ? `Endless Lv${currentLevel}` : (lvlDef.label);
  document.getElementById('lead-time-display').textContent = hasFastShipping() ? '1 turn ⚡' : '2 turns';

  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} });
  charts = {};
  document.getElementById('log').innerHTML = '';

  initCharts(); initScene(); updateDisplay(); updateUpgradeBtn();

  document.querySelector('button[onclick="endTurn()"]').disabled = false;
  logMessage(`🚀 Level ${currentLevel}: Goal $${goalCash.toLocaleString()} in ${MAX_TURNS} turns.`);
  if (currentLevel > 1) logMessage(`💰 Carrying $${cash.toFixed(2)} and ${inventory} units into this level!`);
}

function restartGame() {
  document.getElementById('summary-overlay').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('upgrade-shop').style.display = 'none';
  document.getElementById('difficulty-screen').style.display = 'flex';
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} });
  charts = {};
}

// ============================================================
// UPGRADE SHOP
// ============================================================
function openShop() { renderShop(); document.getElementById('upgrade-shop').style.display = 'flex'; }
function closeShop() { document.getElementById('upgrade-shop').style.display = 'none'; }

function renderShop() {
  const container = document.getElementById('shop-items');
  container.innerHTML = '';
  Object.values(UPGRADE_DEFS).forEach(def => {
    const state = upgrades[def.id];
    const currentTier = state.tier;
    const nextTier = def.tiers[currentTier];
    const maxed = !def.repeatable && currentTier >= def.tiers.length;
    const locked = currentLevel < def.unlockedAt;
    let statusHtml = '';
    if (locked) {
      statusHtml = `<span class="shop-locked">🔒 Unlocks at Level ${def.unlockedAt}</span>`;
    } else if (maxed) {
      statusHtml = `<span class="shop-maxed">✅ Maxed Out</span>`;
    } else if (def.id === 'marketing' && upgrades.marketing.turnsLeft > 0) {
      statusHtml = `<span class="shop-active">📣 Active: ${upgrades.marketing.turnsLeft} turns left</span>
        <button class="shop-buy-btn" onclick="buyUpgrade('marketing')">Re-buy — $${nextTier.cost}</button>`;
    } else {
      const canAfford = cash >= nextTier.cost;
      statusHtml = `<button class="shop-buy-btn ${canAfford?'':'cant-afford'}" onclick="buyUpgrade('${def.id}')" ${canAfford?'':'disabled'}>
        Buy ${nextTier.label} — $${nextTier.cost}</button>
        <div class="shop-effect">${nextTier.effect}</div>`;
    }
    let tierPips = def.tiers.length > 1
      ? '<div class="shop-tiers">' + def.tiers.map((_,i) => `<span class="tier-pip ${i<currentTier?'filled':''}"></span>`).join('') + '</div>'
      : '';
    container.innerHTML += `
      <div class="shop-item ${locked?'shop-item-locked':''}">
        <div class="shop-item-header"><span class="shop-icon">${def.icon}</span><span class="shop-name">${def.name}</span>${tierPips}</div>
        <div class="shop-desc">${def.desc}</div>
        ${statusHtml}
      </div>`;
  });
}

function buyUpgrade(id) {
  const def = UPGRADE_DEFS[id];
  const state = upgrades[id];
  const tier = def.tiers[state.tier];
  if (!tier || cash < tier.cost) return;
  cash -= tier.cost;
  if (id === 'marketing') {
    upgrades.marketing.turnsLeft = 3;
    upgrades.marketing.tier = Math.min(state.tier+1, def.tiers.length-1);
    logMessage(`📣 Marketing campaign launched! Demand +40% for 3 turns.`);
  } else {
    upgrades[id].tier++;
  }
  if (id === 'fast_shipping') { pipeline = [pipeline[0]||0]; logMessage(`⚡ Fast shipping unlocked! Lead time: 1 turn.`); document.getElementById('lead-time-display').textContent = '1 turn ⚡'; }
  if (id === 'warehouse') logMessage(`🏭 Warehouse expanded to ${warehouseCapacity()} units!`);
  if (id === 'forecast') logMessage(`🔮 Forecasting tool unlocked!`);
  if (id === 'insurance') { upgrades.insurance.blocksLeft = insuranceBlocks(); logMessage(`🛡️ Insurance upgraded — ${insuranceBlocks()} blocks this level.`); }
  if (id === 'supplier_contract') logMessage(`🤝 Supplier contract signed! Unit cost: $${effectiveUnitCost().toFixed(2)}.`);
  updateDisplay(); updateUpgradeBtn(); renderShop();
}

function updateUpgradeBtn() {
  document.getElementById('shop-btn').style.display = currentLevel >= 2 ? 'inline-block' : 'none';
  document.getElementById('warehouse-cap-display').textContent = warehouseCapacity();
  document.getElementById('unit-cost-display').textContent = effectiveUnitCost().toFixed(2);
}

// ============================================================
// CHARTS
// ============================================================
function initCharts() {
  const cd = (color, fill=false) => ({ borderColor:color, backgroundColor: fill?color.replace(')',',.15)').replace('rgb','rgba'):'transparent', fill, tension:.3, pointRadius:4, pointBackgroundColor:color });
  charts.inventory = new Chart(document.getElementById('inventoryChart'), { type:'line', data:{labels:history.turns,datasets:[{label:'Inventory',data:history.inventory,...cd('#4ecdc4',true)}]}, options:chartOptions() });
  charts.priceDemand = new Chart(document.getElementById('priceDemandChart'), { type:'line', data:{labels:history.turns,datasets:[{label:'Price ($)',data:history.price,...cd('#e94560'),yAxisID:'yPrice'},{label:'Demand',data:history.demand,...cd('#f7b731'),yAxisID:'yDemand'}]}, options:{animation:false,scales:{x:axisStyle(),yPrice:{type:'linear',position:'left',...axisStyle(),beginAtZero:true,title:{display:true,text:'Price ($)',color:'#e94560'}},yDemand:{type:'linear',position:'right',...axisStyle(),beginAtZero:true,grid:{drawOnChartArea:false},title:{display:true,text:'Demand',color:'#f7b731'}}},plugins:{legend:{labels:{color:'#eee'}}}} });
  charts.cash = new Chart(document.getElementById('cashChart'), { type:'line', data:{labels:history.turns,datasets:[{label:'Cash ($)',data:history.cash,...cd('#a8ff78',true)}]}, options:chartOptions() });
}
function chartOptions() { return {animation:false,scales:{x:axisStyle(),y:{...axisStyle(),beginAtZero:true}},plugins:{legend:{labels:{color:'#eee'}}}}; }
function axisStyle() { return {ticks:{color:'#aaa'},grid:{color:'#333'}}; }
function updateCharts(price, demand) {
  history.turns.push(`T${turn}`); history.inventory.push(inventory); history.price.push(price); history.demand.push(demand); history.cash.push(parseFloat(cash.toFixed(2)));
  Object.values(charts).forEach(c => c.update());
}

// ============================================================
// DISPLAY
// ============================================================
function updateDisplay() {
  document.getElementById('cash').textContent = cash.toFixed(2);
  document.getElementById('inventory').textContent = inventory;
  document.getElementById('turn').textContent = turn;
  document.getElementById('warehouse-cap-display').textContent = warehouseCapacity();
  document.getElementById('unit-cost-display').textContent = effectiveUnitCost().toFixed(2);
  document.getElementById('incoming').textContent = pipeline[0] > 0 ? `${pipeline[0]} units arriving next turn` : 'None';

  const forecastEl = document.getElementById('forecast-box');
  if (hasForecasting()) {
    const price = parseFloat(document.getElementById('price').value) || 3;
    forecastEl.style.display = 'block';
    document.getElementById('forecast-val').textContent = `~${getForecastDemand(price)} units`;
  } else { forecastEl.style.display = 'none'; }

  const mktEl = document.getElementById('marketing-status');
  if (upgrades.marketing.turnsLeft > 0) { mktEl.style.display='block'; mktEl.textContent=`📣 Marketing active: ${upgrades.marketing.turnsLeft} turns left`; }
  else { mktEl.style.display='none'; }
}

// ============================================================
// DEMAND
// ============================================================
function getDemand(price) {
  const cfg = DIFFICULTY_SETTINGS[difficulty];
  const base = Math.max(0, 50 - price * 6);
  const min = 1 - cfg.volatility, max = 1 + cfg.volatility;
  let d = Math.round(base * (min + Math.random() * (max - min)));
  if (marketingActive()) d = Math.round(d * 1.4);
  return d;
}
function getForecastDemand(price) {
  const base = Math.max(0, 50 - price * 6);
  let d = Math.round(base);
  if (marketingActive() && upgrades.marketing.turnsLeft > 1) d = Math.round(d * 1.4);
  return d;
}

// ============================================================
// EVENTS
// ============================================================
const EVENTS = {
  mild: [
    { type:'good', msg:'☀️ Great weather boosts foot traffic! Demand +15% this turn.', apply:s=>{s.demandBoost=1.15;} },
    { type:'good', msg:'📣 A local blog mentioned your store! Demand +20% this turn.', apply:s=>{s.demandBoost=1.20;} },
    { type:'bad',  msg:'🌧️ Rainy day keeps customers home. Demand -15% this turn.', apply:s=>{s.demandBoost=0.85;} },
    { type:'bad',  msg:'🚛 Minor delivery delay — incoming shipment pushed back 1 turn.', apply:s=>{s.shipmentDelay=true;} },
  ],
  moderate: [
    { type:'good', msg:'🎉 Local event drives a surge! Demand +35% this turn.', apply:s=>{s.demandBoost=1.35;} },
    { type:'good', msg:'💸 Supplier discount — unit cost halved this turn!', apply:s=>{s.unitCostOverride=effectiveUnitCost()*0.5;} },
    { type:'good', msg:'📦 Free bonus shipment of 20 units arrives immediately!', apply:s=>{s.freeUnits=20;} },
    { type:'bad',  msg:'⚠️ Port congestion delays incoming shipments by 1 turn.', apply:s=>{s.shipmentDelay=true;} },
    { type:'bad',  msg:'🏭 Supplier issues — unit cost doubled this turn.', apply:s=>{s.unitCostOverride=effectiveUnitCost()*2;} },
    { type:'bad',  msg:'📉 Competitor sale nearby. Demand -30% this turn.', apply:s=>{s.demandBoost=0.70;} },
  ],
  brutal: [
    { type:'good', msg:'🚀 You went viral! Demand doubled this turn.', apply:s=>{s.demandBoost=2.0;} },
    { type:'good', msg:'🏆 Won a local business award! Demand +50% this turn.', apply:s=>{s.demandBoost=1.50;} },
    { type:'good', msg:'🎁 Mystery investor drops $150 cash into your account!', apply:s=>{s.cashBonus=150;} },
    { type:'bad',  msg:'🔥 Warehouse fire! You lose 40% of your current inventory.', apply:s=>{s.inventoryLossPct=0.40;} },
    { type:'bad',  msg:'📦 Supply chain crisis — all incoming shipments cancelled!', apply:s=>{s.cancelShipment=true;} },
    { type:'bad',  msg:'💸 Tax audit! You owe $100 immediately.', apply:s=>{s.cashPenalty=100;} },
    { type:'bad',  msg:'📉 Market crash — demand drops 60% this turn.', apply:s=>{s.demandBoost=0.40;} },
  ]
};

function rollEvent() {
  if (Math.random() > 0.25) return null;
  const pool = EVENTS[DIFFICULTY_SETTINGS[difficulty].eventImpact];
  return pool[Math.floor(Math.random() * pool.length)];
}

function logMessage(msg) {
  const log = document.getElementById('log');
  const entry = document.createElement('div');
  entry.textContent = msg;
  log.prepend(entry);
}

// ============================================================
// ORDER PREVIEW
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  function updatePreview() {
    const qty = parseInt(document.getElementById('order-qty').value)||0;
    const exp = document.getElementById('expedited').checked;
    const previewEl = document.getElementById('order-cost-preview');
    if (qty > 0) {
      const { cost, label } = getBulkUnitCost(qty);
      const totalCost = qty * cost + ORDER_FEE + (exp ? EXPEDITED_FEE : 0);
      let text = `(Cost: $${totalCost.toFixed(2)} — $${cost.toFixed(2)}/unit`;
      if (label) text += ` · 🏷️ ${label}`;
      text += ')';
      previewEl.textContent = text;
    } else {
      previewEl.textContent = '';
    }
  }
  document.getElementById('order-qty').addEventListener('input', updatePreview);
  document.getElementById('expedited').addEventListener('change', updatePreview);
  document.getElementById('price').addEventListener('input', () => { if (hasForecasting()) updateDisplay(); });
});

// ============================================================
// END TURN
// ============================================================
function endTurn() {
  if (!gameActive) return;
  const price = parseFloat(document.getElementById('price').value)||1;
  const orderQty = parseInt(document.getElementById('order-qty').value)||0;
  const expedited = document.getElementById('expedited').checked;
  if (price < 1) { alert('Price must be at least $1.'); return; }

  logMessage(`── Turn ${turn} ──`);
  if (upgrades.marketing.turnsLeft > 0) upgrades.marketing.turnsLeft--;

  // Event
  const event = rollEvent();
  const es = { demandBoost:1, unitCostOverride:null, freeUnits:0, cashBonus:0, cashPenalty:0, inventoryLossPct:0, shipmentDelay:false, cancelShipment:false };
  if (event) {
    if (event.type === 'bad' && upgrades.insurance.blocksLeft > 0) {
      upgrades.insurance.blocksLeft--;
      logMessage(`🛡️ Insurance blocked: "${event.msg}"`);
    } else {
      event.apply(es);
      logMessage(`🎲 EVENT: ${event.msg}`);
      alert(`🎲 Random Event!\n\n${event.msg}`);
    }
  }

  if (es.cashBonus > 0) { cash += es.cashBonus; logMessage(`💵 Received $${es.cashBonus} bonus!`); }
  if (es.cashPenalty > 0) { cash -= es.cashPenalty; logMessage(`💸 Paid $${es.cashPenalty} penalty.`); }
  if (es.freeUnits > 0) { inventory += es.freeUnits; logMessage(`🎁 Received ${es.freeUnits} free units!`); }
  if (es.inventoryLossPct > 0) { const lost=Math.floor(inventory*es.inventoryLossPct); inventory-=lost; logMessage(`🔥 Lost ${lost} units!`); }

  // 1. Receive
  const arriving = pipeline[0];
  if (arriving > 0) {
    if (es.cancelShipment) logMessage(`❌ Incoming shipment of ${arriving} units cancelled!`);
    else { inventory += arriving; logMessage(`📬 Received ${arriving} units.`); }
  }

  // 2. Shift pipeline
  if (es.shipmentDelay) { logMessage(`🕐 Shipment delayed 1 turn.`); }
  else { if (hasFastShipping()) pipeline[0]=0; else { pipeline[0]=pipeline[1]; pipeline[1]=0; } }

  // 3. Order
  if (orderQty > 0) {
    const extraFee = expedited ? EXPEDITED_FEE : 0;
    const { cost: bulkCost, label: bulkLabel } = getBulkUnitCost(orderQty);
    const unitCost = es.unitCostOverride !== null ? es.unitCostOverride : bulkCost;
    const orderCost = orderQty * unitCost + ORDER_FEE + extraFee;
    if (orderCost > cash) {
      alert(`Not enough cash! Order costs $${orderCost.toFixed(2)}, you have $${cash.toFixed(2)}.`);
      logMessage(`⛔ Order skipped — not enough cash.`);
      turn++; updateDisplay();
      document.getElementById('expedited').checked = false;
      document.getElementById('order-cost-preview').textContent = '';
      return;
    }
    cash -= orderCost;
    if (bulkLabel && !es.unitCostOverride) logMessage(`🏷️ ${bulkLabel} applied — $${unitCost.toFixed(2)}/unit`);
    if (expedited || hasFastShipping()) {
      pipeline[0] = (pipeline[0]||0) + orderQty;
      logMessage(`⚡ ${expedited?'Expedited':'Fast lane'}: ${orderQty} units for $${orderCost.toFixed(2)}. Arrives NEXT turn.`);
    } else {
      pipeline[1] = orderQty;
      logMessage(`🛒 Ordered ${orderQty} units for $${orderCost.toFixed(2)}. Arrives in 2 turns.`);
    }
  }

  // 4. Sell
  const preSaleInventory = inventory;
  const demand = Math.round(getDemand(price) * es.demandBoost);
  const unitsSold = Math.min(demand, inventory);
  const revenue = unitsSold * price;
  const unmetDemand = demand - unitsSold;
  inventory -= unitsSold; cash += revenue; totalRevenue += revenue; pricesCharged.push(price);
  logMessage(`🏷️ Price: $${price} → Demand: ${demand} → Sold: ${unitsSold} → Revenue: $${revenue.toFixed(2)}`);
  if (unmetDemand > 0) logMessage(`⚠️ Lost ${unmetDemand} units of demand!`);

  // 5. External storage
  const excess = Math.max(0, inventory - warehouseCapacity());
  if (excess > 0) { const p=excess*EXTERNAL_STORAGE_COST; cash-=p; logMessage(`🏗️ External storage: ${excess}×$${EXTERNAL_STORAGE_COST}=$${p.toFixed(2)}`); }

  // 6. Missed order penalty
  if (preSaleInventory === 0 && demand > 0) {
    stockouts++;
    const p=unmetDemand*MISSED_ORDER_PENALTY; cash-=p;
    logMessage(`❌ Missed orders penalty: ${unmetDemand}×$${MISSED_ORDER_PENALTY}=$${p.toFixed(2)}`);
  }

  // 7. Animate
  triggerSceneAnimation(arriving > 0 && !es.cancelShipment, unitsSold, expedited);

  // 8. Charts + display
  turnProfits.push(parseFloat(cash.toFixed(2)));
  updateCharts(price, demand);
  updateDisplay();

  // 9. Win
  if (cash >= goalCash) {
    gameActive = false;
    logMessage(`🏆 Level ${currentLevel} complete! Cash: $${cash.toFixed(2)}`);
    document.querySelector('button[onclick="endTurn()"]').disabled = true;
    setTimeout(() => showSummary(true), 800);
    return;
  }

  // 10. Bankrupt
  if (cash <= 0 && inventory === 0) {
    gameActive = false;
    logMessage('💀 Out of cash and inventory. Game over!');
    document.querySelector('button[onclick="endTurn()"]').disabled = true;
    setTimeout(() => showSummary(false), 800);
    return;
  }

  // 11. Time up
  if (turn >= MAX_TURNS) {
    gameActive = false;
    logMessage(`⏱️ Time's up! Final cash: $${cash.toFixed(2)}.`);
    document.querySelector('button[onclick="endTurn()"]').disabled = true;
    setTimeout(() => showSummary(cash >= goalCash), 800);
    return;
  }

  turn++;
  updateDisplay();
  document.getElementById('expedited').checked = false;
  document.getElementById('order-cost-preview').textContent = '';
}

// ============================================================
// SUMMARY
// ============================================================
function showSummary(won) {
  document.getElementById('summary-title').textContent = won ? `🏆 Level ${currentLevel} Complete!` : '💀 Game Over';
  document.getElementById('sum-cash').textContent = `$${cash.toFixed(2)}`;
  document.getElementById('sum-profit').textContent = `$${(cash-100).toFixed(2)}`;
  document.getElementById('sum-stockouts').textContent = stockouts;
  document.getElementById('sum-avg-price').textContent = pricesCharged.length
    ? `$${(pricesCharged.reduce((a,b)=>a+b,0)/pricesCharged.length).toFixed(2)}` : 'N/A';
  const maxCash=Math.max(...history.cash), minCash=Math.min(...history.cash);
  document.getElementById('sum-best').textContent = `${history.turns[history.cash.indexOf(maxCash)]} ($${maxCash.toFixed(2)})`;
  document.getElementById('sum-worst').textContent = `${history.turns[history.cash.indexOf(minCash)]} ($${minCash.toFixed(2)})`;

  const nextBtn = document.getElementById('next-level-btn');
  if (won) {
    const isEndless = currentLevel >= 5;
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = isEndless ? `▶ Continue Endless (Level ${currentLevel+1})` : `▶ Next Level`;
  } else { nextBtn.style.display = 'none'; }

  if (charts.summary) { try { charts.summary.destroy(); } catch(e){} }
  charts.summary = new Chart(document.getElementById('summaryChart'), {
    type:'line', data:{labels:history.turns,datasets:[{label:'Cash ($)',data:history.cash,borderColor:'#a8ff78',backgroundColor:'rgba(168,255,120,0.15)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#a8ff78'}]},
    options:{animation:false,scales:{x:{ticks:{color:'#aaa'},grid:{color:'#333'}},y:{ticks:{color:'#aaa'},grid:{color:'#333'},beginAtZero:true}},plugins:{legend:{labels:{color:'#eee'}}}}
  });

  document.getElementById('lb-submit-btn').disabled = false;
  document.getElementById('lb-submit-btn').textContent = '📤 Submit Score';
  renderLeaderboard();
  document.getElementById('summary-overlay').style.display = 'flex';
}

function advanceLevel() {
  currentLevel++;
  document.getElementById('summary-overlay').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  renderShop();
  document.getElementById('upgrade-shop').style.display = 'flex';
  const lvlDef = LEVELS[Math.min(currentLevel-1, LEVELS.length-1)];
  document.getElementById('shop-level-info').textContent = `Heading into Level ${currentLevel}. You have $${cash.toFixed(2)} to spend on upgrades!`;
  const newUnlocks = currentLevel <= 5 ? (lvlDef.unlocksUpgrades||[]) : [];
  document.getElementById('shop-new-unlocks').textContent = newUnlocks.length
    ? `🔓 Newly unlocked: ${newUnlocks.map(u=>UPGRADE_DEFS[u]?.name).join(', ')}` : '';
}

function beginNextLevel() {
  document.getElementById('upgrade-shop').style.display = 'none';
  startLevel();
}

async function submitScore() {
  const name = document.getElementById('lb-name-input').value.trim() || 'Anonymous';
  await saveScore(name, Math.round(cash), currentLevel);
  renderLeaderboard();
  document.getElementById('lb-submit-btn').textContent = '✅ Submitted!';
  document.getElementById('lb-submit-btn').disabled = true;
}
