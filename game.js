// --- Cost Constants ---
const UNIT_COST = 2;
const ORDER_FEE = 10;
const WAREHOUSE_CAPACITY = 100;
const EXTERNAL_STORAGE_COST = 5;
const MISSED_ORDER_PENALTY = 2;
const EXPEDITED_FEE = 20;
const MAX_TURNS = 20;

// --- Difficulty Config ---
const DIFFICULTY_SETTINGS = {
  easy:   { goalCash: 500,  volatility: 0.2, eventImpact: 'mild',     label: 'Easy' },
  medium: { goalCash: 1000, volatility: 0.5, eventImpact: 'moderate', label: 'Medium' },
  hard:   { goalCash: 2000, volatility: 0.9, eventImpact: 'brutal',   label: 'Hard' }
};

// --- Random Events Library ---
// Each event: { msg, type, apply(gameState) }
// type: 'good' or 'bad'
const EVENTS = {
  mild: [
    { type: 'good', msg: '☀️ Great weather boosts foot traffic! Demand +15% this turn.', apply: (s) => { s.demandBoost = 1.15; } },
    { type: 'good', msg: '📣 A local blog mentioned your store! Demand +20% this turn.', apply: (s) => { s.demandBoost = 1.20; } },
    { type: 'bad',  msg: '🌧️ Rainy day keeps customers home. Demand -15% this turn.', apply: (s) => { s.demandBoost = 0.85; } },
    { type: 'bad',  msg: '🚛 Minor delivery delay — incoming shipment pushed back 1 turn.', apply: (s) => { s.shipmentDelay = true; } },
  ],
  moderate: [
    { type: 'good', msg: '🎉 Local event drives a surge! Demand +35% this turn.', apply: (s) => { s.demandBoost = 1.35; } },
    { type: 'good', msg: '💸 Supplier discount this turn — unit cost reduced to $1.', apply: (s) => { s.unitCostOverride = 1; } },
    { type: 'good', msg: '📦 Free bonus shipment of 20 units arrives immediately!', apply: (s) => { s.freeUnits = 20; } },
    { type: 'bad',  msg: '⚠️ Port congestion delays all incoming shipments by 1 turn.', apply: (s) => { s.shipmentDelay = true; } },
    { type: 'bad',  msg: '🏭 Supplier issues — unit cost raised to $4 this turn.', apply: (s) => { s.unitCostOverride = 4; } },
    { type: 'bad',  msg: '📉 Competitor sale nearby. Demand -30% this turn.', apply: (s) => { s.demandBoost = 0.70; } },
  ],
  brutal: [
    { type: 'good', msg: '🚀 You went viral! Demand doubled this turn.', apply: (s) => { s.demandBoost = 2.0; } },
    { type: 'good', msg: '🏆 Won a local business award! Demand +50% for this turn.', apply: (s) => { s.demandBoost = 1.50; } },
    { type: 'good', msg: '🎁 Mystery investor drops $150 cash into your account!', apply: (s) => { s.cashBonus = 150; } },
    { type: 'bad',  msg: '🔥 Warehouse fire! You lose 40% of your current inventory.', apply: (s) => { s.inventoryLossPct = 0.40; } },
    { type: 'bad',  msg: '📦 Supply chain crisis — all incoming shipments cancelled this turn.', apply: (s) => { s.cancelShipment = true; } },
    { type: 'bad',  msg: '💸 Tax audit! You owe $100 immediately.', apply: (s) => { s.cashPenalty = 100; } },
    { type: 'bad',  msg: '📉 Market crash — demand drops 60% this turn.', apply: (s) => { s.demandBoost = 0.40; } },
  ]
};

// --- Game State ---
let cash, inventory, turn, pipeline, difficulty, goalCash;
let stockouts, totalRevenue, turnProfits, pricesCharged;
let history, charts = {};
let gameActive = false;

// --- Start Game ---
function startGame(diff) {
  difficulty = diff;
  const cfg = DIFFICULTY_SETTINGS[diff];
  goalCash = cfg.goalCash;

  cash = 100;
  inventory = 100;
  turn = 1;
  pipeline = [0, 0];
  stockouts = 0;
  totalRevenue = 0;
  turnProfits = [];
  pricesCharged = [];
  gameActive = true;

  history = { turns: [], inventory: [], price: [], demand: [], cash: [] };

  document.getElementById('difficulty-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('goal-display').textContent = goalCash;
  document.getElementById('max-turns').textContent = MAX_TURNS;

  initCharts();
  updateDisplay();
  logMessage(`🎮 Starting on ${cfg.label} mode. Goal: $${goalCash} in ${MAX_TURNS} turns. Good luck!`);
}

// --- Restart ---
function restartGame() {
  document.getElementById('summary-overlay').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('difficulty-screen').style.display = 'flex';

  // Destroy old charts
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  document.getElementById('log').innerHTML = '';
  document.querySelector('button[onclick="endTurn()"]').disabled = false;
}

// --- Init Charts ---
function initCharts() {
  const chartDefaults = (color, fill = false) => ({
    borderColor: color,
    backgroundColor: fill ? color.replace(')', ',0.15)').replace('rgb', 'rgba') : 'transparent',
    fill,
    tension: 0.3,
    pointRadius: 4,
    pointBackgroundColor: color
  });

  charts.inventory = new Chart(document.getElementById('inventoryChart'), {
    type: 'line',
    data: { labels: history.turns, datasets: [{ label: 'Inventory', data: history.inventory, ...chartDefaults('#4ecdc4', true) }] },
    options: chartOptions()
  });

  charts.priceDemand = new Chart(document.getElementById('priceDemandChart'), {
    type: 'line',
    data: {
      labels: history.turns,
      datasets: [
        { label: 'Price ($)', data: history.price, ...chartDefaults('#e94560'), yAxisID: 'yPrice' },
        { label: 'Demand (units)', data: history.demand, ...chartDefaults('#f7b731'), yAxisID: 'yDemand' }
      ]
    },
    options: {
      animation: false,
      scales: {
        x: axisStyle(),
        yPrice: { type: 'linear', position: 'left', ...axisStyle(), beginAtZero: true, title: { display: true, text: 'Price ($)', color: '#e94560' } },
        yDemand: { type: 'linear', position: 'right', ...axisStyle(), beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Demand', color: '#f7b731' } }
      },
      plugins: { legend: { labels: { color: '#eee' } } }
    }
  });

  charts.cash = new Chart(document.getElementById('cashChart'), {
    type: 'line',
    data: { labels: history.turns, datasets: [{ label: 'Cash ($)', data: history.cash, ...chartDefaults('#a8ff78', true) }] },
    options: chartOptions()
  });
}

function chartOptions() {
  return {
    animation: false,
    scales: { x: axisStyle(), y: { ...axisStyle(), beginAtZero: true } },
    plugins: { legend: { labels: { color: '#eee' } } }
  };
}

function axisStyle() {
  return { ticks: { color: '#aaa' }, grid: { color: '#333' } };
}

// --- Update Charts ---
function updateCharts(price, demand) {
  history.turns.push(`T${turn}`);
  history.inventory.push(inventory);
  history.price.push(price);
  history.demand.push(demand);
  history.cash.push(parseFloat(cash.toFixed(2)));

  Object.values(charts).forEach(c => c.update());
}

// --- Update Display ---
function updateDisplay() {
  document.getElementById('cash').textContent = cash.toFixed(2);
  document.getElementById('inventory').textContent = inventory;
  document.getElementById('turn').textContent = turn;
  document.getElementById('incoming').textContent =
    pipeline[0] > 0 ? `${pipeline[0]} units arriving next turn` : 'None';
}

// --- Order cost preview ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('order-qty').addEventListener('input', function () {
    const qty = parseInt(this.value) || 0;
    const expedited = document.getElementById('expedited').checked;
    if (qty > 0) {
      const fee = ORDER_FEE + (expedited ? EXPEDITED_FEE : 0);
      document.getElementById('order-cost-preview').textContent = `(Cost: $${(qty * UNIT_COST + fee).toFixed(2)})`;
    } else {
      document.getElementById('order-cost-preview').textContent = '';
    }
  });

  document.getElementById('expedited').addEventListener('change', function () {
    const qty = parseInt(document.getElementById('order-qty').value) || 0;
    if (qty > 0) {
      const fee = ORDER_FEE + (this.checked ? EXPEDITED_FEE : 0);
      document.getElementById('order-cost-preview').textContent = `(Cost: $${(qty * UNIT_COST + fee).toFixed(2)})`;
    }
  });
});

// --- Demand Calculation ---
function getDemand(price) {
  const cfg = DIFFICULTY_SETTINGS[difficulty];
  const baseDemand = Math.max(0, 50 - price * 6);
  const minFactor = 1 - cfg.volatility;
  const maxFactor = 1 + cfg.volatility;
  const randomFactor = minFactor + Math.random() * (maxFactor - minFactor);
  return Math.round(baseDemand * randomFactor);
}

// --- Random Event ---
function rollEvent() {
  if (Math.random() > 0.25) return null; // 25% chance
  const cfg = DIFFICULTY_SETTINGS[difficulty];
  const pool = EVENTS[cfg.eventImpact];
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Log ---
function logMessage(msg) {
  const log = document.getElementById('log');
  const entry = document.createElement('div');
  entry.textContent = msg;
  log.prepend(entry);
}

// --- End Turn ---
function endTurn() {
  if (!gameActive) return;

  const price = parseFloat(document.getElementById('price').value) || 1;
  const orderQty = parseInt(document.getElementById('order-qty').value) || 0;
  const expedited = document.getElementById('expedited').checked;

  if (price < 1) { alert('Price must be at least $1.'); return; }

  logMessage(`── Turn ${turn} ──`);

  // --- Roll random event ---
  const event = rollEvent();
  const eventState = {
    demandBoost: 1,
    unitCostOverride: null,
    freeUnits: 0,
    cashBonus: 0,
    cashPenalty: 0,
    inventoryLossPct: 0,
    shipmentDelay: false,
    cancelShipment: false
  };

  if (event) {
    event.apply(eventState);
    logMessage(`🎲 EVENT: ${event.msg}`);
    alert(`🎲 Random Event!\n\n${event.msg}`);
  }

  // Apply instant cash effects
  if (eventState.cashBonus > 0) { cash += eventState.cashBonus; logMessage(`💵 Received $${eventState.cashBonus} bonus!`); }
  if (eventState.cashPenalty > 0) { cash -= eventState.cashPenalty; logMessage(`💸 Paid $${eventState.cashPenalty} penalty.`); }
  if (eventState.freeUnits > 0) { inventory += eventState.freeUnits; logMessage(`🎁 Received ${eventState.freeUnits} free units!`); }
  if (eventState.inventoryLossPct > 0) {
    const lost = Math.floor(inventory * eventState.inventoryLossPct);
    inventory -= lost;
    logMessage(`🔥 Lost ${lost} units from inventory!`);
  }

  // 1. Receive arriving inventory (unless cancelled by event)
  const arriving = pipeline[0];
  if (arriving > 0) {
    if (eventState.cancelShipment) {
      logMessage(`❌ Incoming shipment of ${arriving} units was cancelled by event!`);
    } else {
      inventory += arriving;
      logMessage(`📬 Received ${arriving} units.`);
    }
  }

  // 2. Shift pipeline (with optional delay)
  if (eventState.shipmentDelay) {
    logMessage(`🕐 Shipment delayed — pipeline shifted back 1 turn.`);
    // Don't advance pipeline this turn
  } else {
    pipeline[0] = pipeline[1];
    pipeline[1] = 0;
  }

  // 3. Place new order
  if (orderQty > 0) {
    const extraFee = expedited ? EXPEDITED_FEE : 0;
    const effectiveUnitCost = eventState.unitCostOverride !== null ? eventState.unitCostOverride : UNIT_COST;
    const orderCost = orderQty * effectiveUnitCost + ORDER_FEE + extraFee;

    if (orderCost > cash) {
      alert(`Not enough cash! This order costs $${orderCost.toFixed(2)} but you only have $${cash.toFixed(2)}.`);
      logMessage(`⛔ Order skipped — not enough cash.`);
      turn++;
      updateDisplay();
      document.getElementById('order-qty').value = 0;
      document.getElementById('expedited').checked = false;
      document.getElementById('order-cost-preview').textContent = '';
      return;
    }

    cash -= orderCost;

    if (expedited) {
      pipeline[0] = (pipeline[0] || 0) + orderQty; // arrives next turn
      logMessage(`⚡ Expedited order: ${orderQty} units for $${orderCost.toFixed(2)}. Arrives NEXT turn.`);
    } else {
      pipeline[1] = orderQty;
      logMessage(`🛒 Ordered ${orderQty} units for $${orderCost.toFixed(2)}. Arrives in 2 turns.`);
    }
  }

  // 4. Sell
  const preSaleInventory = inventory;
  const rawDemand = getDemand(price);
  const demand = Math.round(rawDemand * eventState.demandBoost);
  const unitsSold = Math.min(demand, inventory);
  const revenue = unitsSold * price;
  const unmetDemand = demand - unitsSold;

  inventory -= unitsSold;
  cash += revenue;
  totalRevenue += revenue;
  pricesCharged.push(price);

  logMessage(`🏷️ Price: $${price} → Demand: ${demand} → Sold: ${unitsSold} → Revenue: $${revenue.toFixed(2)}`);
  if (unmetDemand > 0) logMessage(`⚠️ Lost ${unmetDemand} units of demand (not enough inventory!)`);

  // 5. External storage
  const excess = Math.max(0, inventory - WAREHOUSE_CAPACITY);
  if (excess > 0) {
    const penalty = excess * EXTERNAL_STORAGE_COST;
    cash -= penalty;
    logMessage(`🏗️ External storage: ${excess} units × $${EXTERNAL_STORAGE_COST} = $${penalty.toFixed(2)}`);
  }

  // 6. Missed order penalty
  if (preSaleInventory === 0 && demand > 0) {
    stockouts++;
    const missedPenalty = unmetDemand * MISSED_ORDER_PENALTY;
    cash -= missedPenalty;
    logMessage(`❌ Missed orders penalty: ${unmetDemand} units × $${MISSED_ORDER_PENALTY} = $${missedPenalty.toFixed(2)}`);
  }

  // 7. Track profit this turn
  turnProfits.push(parseFloat(cash.toFixed(2)));

  // 8. Update charts
  updateCharts(price, demand);
  updateDisplay();

  // 9. Win check
  if (cash >= goalCash) {
    gameActive = false;
    logMessage(`🏆 Goal reached! $${cash.toFixed(2)} — You win!`);
    document.querySelector('button[onclick="endTurn()"]').disabled = true;
    setTimeout(showSummary, 800);
    return;
  }

  // 10. Bankruptcy
  if (cash <= 0 && inventory === 0) {
    gameActive = false;
    logMessage('💀 Out of cash and inventory. Game over!');
    document.querySelector('button[onclick="endTurn()"]').disabled = true;
    setTimeout(showSummary, 800);
    return;
  }

  // 11. Last turn
  if (turn >= MAX_TURNS) {
    gameActive = false;
    logMessage(`⏱️ Time's up! Final cash: $${cash.toFixed(2)}.`);
    document.querySelector('button[onclick="endTurn()"]').disabled = true;
    setTimeout(showSummary, 800);
    return;
  }

  turn++;
  updateDisplay();
  document.getElementById('expedited').checked = false;
  document.getElementById('order-cost-preview').textContent = '';
}

// --- End Game Summary ---
function showSummary() {
  const won = cash >= goalCash;
  document.getElementById('summary-title').textContent = won ? '🏆 You Win!' : '💀 Game Over';
  document.getElementById('sum-cash').textContent = `$${cash.toFixed(2)}`;
  document.getElementById('sum-profit').textContent = `$${(cash - 100).toFixed(2)}`;
  document.getElementById('sum-stockouts').textContent = stockouts;
  document.getElementById('sum-avg-price').textContent = pricesCharged.length
    ? `$${(pricesCharged.reduce((a, b) => a + b, 0) / pricesCharged.length).toFixed(2)}`
    : 'N/A';

  // Best and worst turns by cash level
  const maxCash = Math.max(...history.cash);
  const minCash = Math.min(...history.cash);
  const bestTurn = history.turns[history.cash.indexOf(maxCash)];
  const worstTurn = history.turns[history.cash.indexOf(minCash)];
  document.getElementById('sum-best').textContent = `${bestTurn} ($${maxCash.toFixed(2)})`;
  document.getElementById('sum-worst').textContent = `${worstTurn} ($${minCash.toFixed(2)})`;

  // Summary chart
  if (charts.summary) charts.summary.destroy();
  charts.summary = new Chart(document.getElementById('summaryChart'), {
    type: 'line',
    data: {
      labels: history.turns,
      datasets: [{
        label: 'Cash ($)',
        data: history.cash,
        borderColor: '#a8ff78',
        backgroundColor: 'rgba(168,255,120,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#a8ff78'
      }]
    },
    options: {
      animation: false,
      scales: {
        x: { ticks: { color: '#aaa' }, grid: { color: '#333' } },
        y: { ticks: { color: '#aaa' }, grid: { color: '#333' }, beginAtZero: true }
      },
      plugins: { legend: { labels: { color: '#eee' } } }
    }
  });

  document.getElementById('summary-overlay').style.display = 'flex';
}
