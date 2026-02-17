// --- Game State ---
let cash = 100;
let inventory = 100;
let turn = 1;
let pipeline = [0, 0];

// --- Cost Constants ---
const UNIT_COST = 2;
const ORDER_FEE = 10;
// --- Warehouse / external storage ---
const WAREHOUSE_CAPACITY = 100;
const EXTERNAL_STORAGE_COST = 5; // per unit per turn

// --- Chart History ---
let history = {
  turns: [],
  inventory: [],
  price: [],
  demand: [],
  cash: []
};

// --- Setup Charts ---
const inventoryChart = new Chart(document.getElementById("inventoryChart"), {
  type: "line",
  data: {
    labels: history.turns,
    datasets: [{
      label: "Inventory",
      data: history.inventory,
      borderColor: "#4ecdc4",
      backgroundColor: "rgba(78,205,196,0.15)",
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: "#4ecdc4"
    }]
  },
  options: {
    animation: false,
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "#333" } },
      y: { ticks: { color: "#aaa" }, grid: { color: "#333" }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: "#eee" } }
    }
  }
});

const priceDemandChart = new Chart(document.getElementById("priceDemandChart"), {
  type: "line",
  data: {
    labels: history.turns,
    datasets: [
      {
        label: "Price ($)",
        data: history.price,
        borderColor: "#e94560",
        backgroundColor: "rgba(233,69,96,0.1)",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#e94560",
        yAxisID: "yPrice"
      },
      {
        label: "Demand (units)",
        data: history.demand,
        borderColor: "#f7b731",
        backgroundColor: "rgba(247,183,49,0.1)",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#f7b731",
        yAxisID: "yDemand"
      }
    ]
  },
  options: {
    animation: false,
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "#333" } },
      yPrice: {
        type: "linear",
        position: "left",
        ticks: { color: "#e94560" },
        grid: { color: "#333" },
        beginAtZero: true,
        title: { display: true, text: "Price ($)", color: "#e94560" }
      },
      yDemand: {
        type: "linear",
        position: "right",
        ticks: { color: "#f7b731" },
        grid: { drawOnChartArea: false },
        beginAtZero: true,
        title: { display: true, text: "Demand (units)", color: "#f7b731" }
      }
    },
    plugins: {
      legend: { labels: { color: "#eee" } }
    }
  }
});
const cashChart = new Chart(document.getElementById("cashChart"), {
  type: "line",
  data: {
    labels: history.turns,
    datasets: [{
      label: "Cash ($)",
      data: history.cash,
      borderColor: "#a8ff78",
      backgroundColor: "rgba(168,255,120,0.15)",
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: "#a8ff78"
    }]
  },
  options: {
    animation: false,
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "#333" } },
      y: { ticks: { color: "#aaa" }, grid: { color: "#333" }, beginAtZero: true }
    },
    plugins: {
      legend: { labels: { color: "#eee" } }
    }
  }
});

// --- Update Charts ---
function updateCharts(price, demand) {
  history.turns.push(`T${turn}`);
  history.inventory.push(inventory);
  history.price.push(price);
  history.demand.push(demand);
  history.cash.push(cash);

  inventoryChart.update();
  priceDemandChart.update();
  cashChart.update();
}

// --- Update the display ---
function updateDisplay() {
  document.getElementById("cash").textContent = cash.toFixed(2);
  document.getElementById("inventory").textContent = inventory;
  document.getElementById("turn").textContent = turn;
  document.getElementById("incoming").textContent =
    pipeline[0] > 0 ? `${pipeline[0]} units arriving next turn` : "None";
}

// --- Show order cost preview as player types ---
document.getElementById("order-qty").addEventListener("input", function () {
  const qty = parseInt(this.value) || 0;
  const cost = qty > 0 ? `(Cost: $${(qty * UNIT_COST + ORDER_FEE).toFixed(2)})` : "";
  document.getElementById("order-cost-preview").textContent = cost;
});

// --- Calculate demand based on price ---
function getDemand(price) {
  const baseDemand = Math.max(0, 50 - (price * 6));
  const randomFactor = 0.5 + Math.random();
  return Math.round(baseDemand * randomFactor);
}

// --- Log a message ---
function logMessage(msg) {
  const log = document.getElementById("log");
  const entry = document.createElement("div");
  entry.textContent = msg;
  log.prepend(entry);
}

// --- Main turn logic ---
function endTurn() {
  const price = parseFloat(document.getElementById("price").value) || 1;
  const orderQty = parseInt(document.getElementById("order-qty").value) || 0;

  if (price < 1) { alert("Price must be at least $1."); return; }

  logMessage(`── Turn ${turn} ──`);

  // 1. Receive arriving inventory
  const arriving = pipeline[0];
  if (arriving > 0) {
    inventory += arriving;
    logMessage(`📬 Received ${arriving} units from earlier order.`);
  }

  // 2. Shift pipeline
  pipeline[0] = pipeline[1];
  pipeline[1] = 0;

  // 3. Place new order
  if (orderQty > 0) {
    const orderCost = orderQty * UNIT_COST + ORDER_FEE;
    if (orderCost > cash) {
      alert(`Not enough cash! This order costs $${orderCost.toFixed(2)} but you only have $${cash.toFixed(2)}.`);
      return;
    }
    cash -= orderCost;
    pipeline[1] = orderQty;
    logMessage(`🛒 Ordered ${orderQty} units for $${orderCost.toFixed(2)}. Arrives in 2 turns.`);
  }

  // 4. Calculate demand & sell
  const demand = getDemand(price);
  const unitsSold = Math.min(demand, inventory);
  const revenue = unitsSold * price;
  const unmetDemand = demand - unitsSold;

  inventory -= unitsSold;
  cash += revenue;

  logMessage(`🏷️ Price: $${price} → Demand: ${demand} → Sold: ${unitsSold} → Revenue: $${revenue.toFixed(2)}`);
  if (unmetDemand > 0) logMessage(`⚠️ Lost ${unmetDemand} units of demand (not enough inventory!)`);

  // 5. External storage penalty (if inventory exceeds warehouse capacity)
  const excess = Math.max(0, inventory - WAREHOUSE_CAPACITY);
  if (excess > 0) {
    const penalty = excess * EXTERNAL_STORAGE_COST;
    cash -= penalty;
    logMessage(`🏚️ External storage: ${excess} units × $${EXTERNAL_STORAGE_COST} = $${penalty.toFixed(2)}`);
  }

  // 6. Update charts AFTER this turn's inventory & cash are settled
  updateCharts(price, demand);

  // 7. Bankruptcy check
  if (cash <= 0 && inventory === 0) {
    updateDisplay();
    logMessage("💀 Out of cash and inventory. Game over!");
    document.querySelector("button").disabled = true;
    return;
  }

  // 8. Advance turn
  turn++;
  updateDisplay();
}

// --- Initialize ---
updateDisplay();
