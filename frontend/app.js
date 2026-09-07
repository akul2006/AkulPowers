const state = {
  nodes: [
    {
      id: 'NODE-SOLAR-01',
      name: 'North Ridge Solar Farm',
      type: 'SOLAR_PRODUCER',
      location: 'North Ridge Sector',
      energy: 140.0,
      capacity: 250.0,
      output: 22.5,
      balance: 4850.00,
      priority: 2,
      status: 'ONLINE',
      lastUpdated: 'Just now'
    },
    {
      id: 'NODE-SOLAR-02',
      name: 'Sunward Commons Rooftop',
      type: 'SOLAR_PRODUCER',
      location: 'East Sector',
      energy: 85.0,
      capacity: 150.0,
      output: 17.5,
      balance: 2150.50,
      priority: 2,
      status: 'ONLINE',
      lastUpdated: '1 min ago'
    },
    {
      id: 'NODE-BAT-01',
      name: 'Central Community Storage',
      type: 'BATTERY_STORAGE',
      location: 'Central Substation',
      energy: 95.0,
      capacity: 200.0,
      output: 10.0,
      balance: 3200.00,
      priority: 2,
      status: 'ONLINE',
      lastUpdated: 'Just now'
    },
    {
      id: 'NODE-CONS-01',
      name: 'Harbor Hospital',
      type: 'CONSUMER',
      location: 'Harbor Medical Zone',
      energy: 0.0,
      capacity: 0.0,
      output: -25.0,
      balance: 14500.00,
      priority: 1,
      status: 'ONLINE',
      lastUpdated: 'Just now'
    },
    {
      id: 'NODE-CONS-02',
      name: 'Cedar Heights Residences',
      type: 'CONSUMER',
      location: 'Cedar Heights',
      energy: 0.0,
      capacity: 0.0,
      output: -23.0,
      balance: 2840.75,
      priority: 3,
      status: 'ONLINE',
      lastUpdated: '2 mins ago'
    },
    {
      id: 'NODE-EV-01',
      name: 'West Loop EV Charging Hub',
      type: 'EV_STATION',
      location: 'West Loop Terminal',
      energy: 15.0,
      capacity: 80.0,
      output: -12.0,
      balance: 350.00,
      priority: 4,
      status: 'THROTTLED',
      lastUpdated: 'Just now'
    },
    {
      id: 'NODE-EV-02',
      name: 'South Depot Superchargers',
      type: 'EV_STATION',
      location: 'South Transit Depot',
      energy: 0.0,
      capacity: 100.0,
      output: 0.0,
      balance: 120.00,
      priority: 4,
      status: 'OFFLINE',
      lastUpdated: '10 mins ago'
    }
  ],

  pricing: {
    baseRate: 5.00,
    demandFactor: 1.20,
    peakFactor: 1.25,
    weatherFactor: 1.10
  },

  dailySummary: {
    generatedToday: 684.2,
    consumedToday: 572.8,
    renewableShare: 80,
    netBalance: 111.4
  },

  chartData: [
    { time: '00:00', gen: 10, cons: 28 },
    { time: '04:00', gen: 15, cons: 24 },
    { time: '08:00', gen: 45, cons: 42 },
    { time: '12:00', gen: 75, cons: 50 },
    { time: '16:00', gen: 62, cons: 54 },
    { time: '20:00', gen: 50, cons: 60 }
  ],

  audits: [
    {
      id: 'TX-1003',
      timestamp: '10:12 PM',
      event: 'P2P ENERGY TRADE',
      seller: 'Sunward Commons',
      buyer: 'West Loop EV Hub',
      energy: '50.0 kWh',
      price: '₹8.25/kWh',
      cost: '₹412.50',
      status: 'ROLLED_BACK',
      details: 'Buyer has insufficient account balance (₹350.00 vs ₹412.50 required).'
    },
    {
      id: 'TX-1002',
      timestamp: '10:05 PM',
      event: 'P2P ENERGY TRADE',
      seller: 'North Ridge Solar',
      buyer: 'Harbor Hospital',
      energy: '20.0 kWh',
      price: '₹6.00/kWh',
      cost: '₹120.00',
      status: 'COMMITTED',
      details: 'Atomic energy allocation and fund transfer verified via JDBC transaction.'
    },
    {
      id: 'EVT-1001',
      timestamp: '09:58 PM',
      event: 'LOAD SHEDDING',
      seller: 'FluxGrid Engine',
      buyer: 'West Loop EV Hub',
      energy: '12.0 kW load',
      price: 'N/A',
      cost: '₹0.00',
      status: 'SUCCESS',
      details: 'Priority 4 load throttled automatically. Priority 1 Harbor Hospital fully protected.'
    }
  ]
};


async function loadNodesFromBackend() {

  try {

    const response =
      await fetch("http://localhost:8080/api/nodes");

    if (!response.ok) {
      throw new Error(
        "Backend returned status " + response.status
      );
    }

    const backendNodes =
      await response.json();


    state.nodes = backendNodes.map(node => ({
      id: node.nodeId,
      name: node.name,
      type: node.type,
      location: node.location,

      energy: node.availableEnergyKwh,
      capacity: node.maxCapacityKwh,
      output: node.currentOutputKw,

      balance: node.balance,
      priority: node.priority,
      status: node.status,

      lastUpdated: "Live"
    }));


    console.log(
      "Loaded nodes from PostgreSQL:",
      state.nodes
    );


    renderDashboard();
    renderNodesTable();

  } catch (error) {

    console.error(
      "Could not load nodes from backend:",
      error
    );

    showToast(
      "Could not connect to FluxGrid Java backend.",
      "danger"
    );
  }
}

const $ = (id) => document.getElementById(id);

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatNumber(val, decimals = 1) {
  return Number(val).toFixed(decimals);
}

function getReadableType(type) {
  switch (type) {
    case 'SOLAR_PRODUCER': return 'Solar Producer';
    case 'CONSUMER': return 'Consumer';
    case 'EV_STATION': return 'EV Station';
    case 'BATTERY_STORAGE': return 'Battery Storage';
    default: return type;
  }
}

function getTypeBadgeClass(type) {
  switch (type) {
    case 'SOLAR_PRODUCER': return 'type-solar';
    case 'CONSUMER': return 'type-consumer';
    case 'EV_STATION': return 'type-ev';
    case 'BATTERY_STORAGE': return 'type-battery';
    default: return '';
  }
}

function calculateGridMetrics() {
  const totalGen = state.nodes
    .filter(n => n.status !== 'OFFLINE' && n.output > 0)
    .reduce((sum, n) => sum + n.output, 0);

  const totalCons = Math.abs(
    state.nodes
      .filter(n => n.status !== 'OFFLINE' && n.output < 0)
      .reduce((sum, n) => sum + n.output, 0)
  );

  const netReserve = totalGen - totalCons;
  const activeCount = state.nodes.filter(n => n.status !== 'OFFLINE').length;
  const totalCount = state.nodes.length;

  // Dynamic Price Formula = Base Rate * Supply-Demand * Peak * Weather
  const p = state.pricing;
  const dynamicPrice = p.baseRate * p.demandFactor * p.peakFactor * p.weatherFactor;

  // Grid Status assessment
  let gridStatus = 'GRID STABLE';
  let badgeClass = 'badge-stable';
  if (netReserve < 0) {
    gridStatus = 'LOAD SHEDDING';
    badgeClass = 'badge-danger';
  } else if (netReserve < 8.0) {
    gridStatus = 'WARNING';
    badgeClass = 'badge-warning';
  }

  return {
    generation: totalGen,
    consumption: totalCons,
    reserve: netReserve,
    activeNodes: `${activeCount} / ${totalCount}`,
    dynamicPrice: dynamicPrice,
    status: gridStatus,
    badgeClass: badgeClass
  };
}

// ==========================================
// 4. RENDERING FUNCTIONS
// ==========================================

/** Render Dashboard Top Metrics, Pricing & Load Shedding */
function renderDashboard() {
  const metrics = calculateGridMetrics();

  // 1. Primary Metrics Cards
  $('generationValue').textContent = formatNumber(metrics.generation);
  $('consumptionValue').textContent = formatNumber(metrics.consumption);

  const reserveEl = $('reserveValue');
  reserveEl.textContent = (metrics.reserve > 0 ? '+' : '') + formatNumber(metrics.reserve);

  const reserveCard = $('reserveCard');
  const reserveIcon = $('reserveIconContainer');
  const reserveFooter = $('reserveFooter');

  if (metrics.reserve < 0) {
    reserveCard.className = 'metric-card card-deficit';
    reserveIcon.className = 'metric-icon icon-deficit';
    reserveFooter.innerHTML = '<span class="text-danger">⚠ Deficit: Load Shedding Active</span>';
  } else {
    reserveCard.className = 'metric-card card-teal';
    reserveIcon.className = 'metric-icon icon-teal';
    reserveFooter.innerHTML = '<span class="text-teal">✓ Surplus reserve available</span>';
  }

  $('activeNodesValue').textContent = metrics.activeNodes;
  $('priceValue').textContent = '₹' + formatNumber(metrics.dynamicPrice, 2);
  $('gridStatusText').textContent = metrics.status;

  // Topbar Status & Badges
  const gridStatusBadge = $('gridStatusBadge');
  gridStatusBadge.textContent = metrics.status;
  gridStatusBadge.className = `status-badge ${metrics.badgeClass}`;

  const headerStatusPill = $('headerGridStatusPill');
  const headerStatusText = $('headerGridStatusText');
  headerStatusText.textContent = metrics.status;
  headerStatusPill.className = 'header-status-pill ' + (metrics.reserve < 0 ? 'danger' : metrics.reserve < 8 ? '' : 'stable');

  // 2. Snapshot Bars
  const maxKw = Math.max(metrics.generation, metrics.consumption, 70);
  $('generationBar').style.width = `${(metrics.generation / maxKw) * 100}%`;
  $('consumptionBar').style.width = `${(metrics.consumption / maxKw) * 100}%`;
  $('generationBarText').textContent = `${formatNumber(metrics.generation)} kW`;
  $('consumptionBarText').textContent = `${formatNumber(metrics.consumption)} kW`;

  // 3. Dynamic Pricing Panel
  $('pricingCurrent').textContent = '₹' + formatNumber(metrics.dynamicPrice, 2);
  $('baseRate').textContent = formatCurrency(state.pricing.baseRate) + '/kWh';
  $('demandFactor').textContent = formatNumber(state.pricing.demandFactor, 2) + '×';
  $('peakFactor').textContent = formatNumber(state.pricing.peakFactor, 2) + '×';
  $('weatherFactor').textContent = formatNumber(state.pricing.weatherFactor, 2) + '×';

  const priceAlert = $('priceBadgeAlert');
  if (metrics.reserve < 0) {
    priceAlert.textContent = 'Peak Demand Surcharge Active';
    priceAlert.className = 'price-badge-alert text-amber';
    $('pricingExplanation').textContent =
      '"Current demand exceeds available supply. Peak-hour demand and reduced renewable generation are increasing the energy price."';
  } else {
    priceAlert.textContent = 'Standard Grid Pricing';
    priceAlert.className = 'price-badge-alert text-teal';
    $('pricingExplanation').textContent =
      '"Microgrid generation is currently balanced. Base tariff factors are operating within normal equilibrium thresholds."';
  }

  // 4. Energy Summary Cards
  $('generatedToday').textContent = `${formatNumber(state.dailySummary.generatedToday)} kWh`;
  $('consumedToday').textContent = `${formatNumber(state.dailySummary.consumedToday)} kWh`;
  $('renewableShareVal').textContent = `${state.dailySummary.renewableShare}%`;
  $('netEnergyBalance').textContent = `+${formatNumber(state.dailySummary.netBalance)} kWh`;

  // 5. Grid Stability & Load Shedding
  $('stabGen').textContent = `${formatNumber(metrics.generation)} kW`;
  $('stabCons').textContent = `${formatNumber(metrics.consumption)} kW`;
  const stabDeficit = $('stabDeficit');

  if (metrics.reserve < 0) {
    const deficitVal = Math.abs(metrics.reserve);
    stabDeficit.textContent = `${formatNumber(deficitVal)} kW Shortfall`;
    stabDeficit.className = 'text-danger';
    $('stabilityStatusBadge').textContent = '⚠ GRID DEFICIT DETECTED';
    $('stabilityStatusBadge').className = 'status-badge badge-danger';
    $('stabilityMessage').className = 'stability-alert-box alert-danger';
    $('stabilityMessage').innerHTML = `<strong>⚠ GRID DEFICIT DETECTED:</strong> Current demand exceeds generation by ${formatNumber(deficitVal)} kW. Priority 4 non-essential loads are throttled.`;
  } else {
    stabDeficit.textContent = `${formatNumber(metrics.reserve)} kW Surplus`;
    stabDeficit.className = 'text-teal';
    $('stabilityStatusBadge').textContent = '✓ GRID BALANCED & STABLE';
    $('stabilityStatusBadge').className = 'status-badge badge-stable';
    $('stabilityMessage').className = 'stability-alert-box alert-stable';
    $('stabilityMessage').innerHTML = `<strong>✓ GRID OPERATING OPTIMALLY:</strong> Stable supply buffer of ${formatNumber(metrics.reserve)} kW maintained across all priority sectors.`;
  }

  // Render Priority Node cards
  renderPriorityCards();

  // Draw Energy SVG Chart
  renderEnergySvgChart(metrics.generation, metrics.consumption);

  // Update Trade section tariff display
  $('tradePrice').textContent = `₹${formatNumber(metrics.dynamicPrice, 2)} / kWh`;
  updateEstimatedCost();
}

/** Render Priority Cards under Load Shedding */
function renderPriorityCards() {
  const container = $('priorityCards');
  if (!container) return;

  const sortedNodes = [...state.nodes].sort((a, b) => a.priority - b.priority);

  container.innerHTML = sortedNodes.map(node => {
    let statusBadgeClass = 'badge-online';
    if (node.status === 'THROTTLED') statusBadgeClass = 'badge-throttled';
    if (node.status === 'OFFLINE') statusBadgeClass = 'badge-offline';

    const pClass = node.priority === 1 ? 'p1-badge' : node.priority === 2 ? 'p2-badge' : node.priority === 3 ? 'p3-badge' : 'p4-badge';
    const pTag = node.priority === 1 ? 'Protected Essential Service' : node.priority === 4 ? 'Throttled during deficit' : 'Normal Grid Operation';

    return `
      <div class="node-status-card">
        <div class="node-status-head">
          <strong>${node.name}</strong>
          <span class="node-badge ${statusBadgeClass}">${node.status}</span>
        </div>
        <div class="node-status-meta">
          <span class="p-badge ${pClass}">Priority ${node.priority}</span>
          <span>${node.output > 0 ? '+' + node.output + ' kW' : node.output + ' kW'}</span>
        </div>
        <small style="color: var(--text-dim); font-size: 0.7rem;">${pTag}</small>
      </div>
    `;
  }).join('');
}

/** Draw SVG Energy Flow Chart with Smooth Paths and Gradients */
function renderEnergySvgChart(currentGen, currentCons) {
  // Chart dimensions in viewBox coordinates
  const width = 600;
  const height = 240;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 55;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxY = 85; // Max kW on scale

  // Assemble dynamic points using chartData history + current live metric
  const points = [...state.chartData];
  // Replace the last point with live metrics
  points[points.length - 1] = { time: 'Now', gen: currentGen, cons: currentCons };

  function getX(index) {
    return paddingLeft + (index / (points.length - 1)) * plotWidth;
  }

  function getY(value) {
    const clamped = Math.max(0, Math.min(value, maxY));
    return paddingTop + plotHeight - (clamped / maxY) * plotHeight;
  }

  // Build SVG Paths for Generation & Consumption
  let genLineD = `M ${getX(0)} ${getY(points[0].gen)}`;
  let consLineD = `M ${getX(0)} ${getY(points[0].cons)}`;

  for (let i = 1; i < points.length; i++) {
    const prevX = getX(i - 1);
    const prevYGen = getY(points[i - 1].gen);
    const currX = getX(i);
    const currYGen = getY(points[i].gen);

    const prevYCons = getY(points[i - 1].cons);
    const currYCons = getY(points[i].cons);

    // Smooth Bezier curve control points
    const cp1x = prevX + (currX - prevX) / 2;
    const cp2x = cp1x;

    genLineD += ` C ${cp1x} ${prevYGen}, ${cp2x} ${currYGen}, ${currX} ${currYGen}`;
    consLineD += ` C ${cp1x} ${prevYCons}, ${cp2x} ${currYCons}, ${currX} ${currYCons}`;
  }

  const baselineY = paddingTop + plotHeight;
  const genAreaD = `${genLineD} L ${getX(points.length - 1)} ${baselineY} L ${getX(0)} ${baselineY} Z`;
  const consAreaD = `${consLineD} L ${getX(points.length - 1)} ${baselineY} L ${getX(0)} ${baselineY} Z`;

  const genLineEl = $('chartGenLine');
  const consLineEl = $('chartConsLine');
  const genAreaEl = $('chartGenArea');
  const consAreaEl = $('chartConsArea');

  if (genLineEl) genLineEl.setAttribute('d', genLineD);
  if (consLineEl) consLineEl.setAttribute('d', consLineD);
  if (genAreaEl) genAreaEl.setAttribute('d', genAreaD);
  if (consAreaEl) consAreaEl.setAttribute('d', consAreaD);
}

/** Render Node Registry Table */
function renderNodesTable() {
  const tbody = $('nodesTableBody');
  if (!tbody) return;

  const searchQuery = ($('nodeSearch')?.value || '').trim().toLowerCase();
  const typeFilter = $('typeFilter')?.value || '';
  const statusFilter = $('statusFilter')?.value || '';
  const priorityFilter = $('priorityFilter')?.value || '';

  const filtered = state.nodes.filter(node => {
    const matchesSearch = !searchQuery ||
      node.id.toLowerCase().includes(searchQuery) ||
      node.name.toLowerCase().includes(searchQuery) ||
      node.location.toLowerCase().includes(searchQuery);

    const matchesType = !typeFilter || node.type === typeFilter;
    const matchesStatus = !statusFilter || node.status === statusFilter;
    const matchesPriority = !priorityFilter || node.priority === Number(priorityFilter);

    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No microgrid nodes match the selected search or filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(node => {
    let statusClass = 'badge-online';
    if (node.status === 'THROTTLED') statusClass = 'badge-throttled';
    if (node.status === 'OFFLINE') statusClass = 'badge-offline';

    const pClass = node.priority === 1 ? 'p1-badge' : node.priority === 2 ? 'p2-badge' : node.priority === 3 ? 'p3-badge' : 'p4-badge';
    const typeClass = getTypeBadgeClass(node.type);
    const readableType = getReadableType(node.type);

    return `
      <tr>
        <td>
          <div class="node-cell-name">
            <strong>${node.name}</strong>
            <small>${node.id}</small>
          </div>
        </td>
        <td>
          <span class="type-pill ${typeClass}">${readableType}</span>
        </td>
        <td>${node.location}</td>
        <td><strong>${formatNumber(node.energy)}</strong> <span style="color:var(--text-dim)">kWh</span></td>
        <td>${formatNumber(node.capacity)} <span style="color:var(--text-dim)">kWh</span></td>
        <td>
          <strong class="${node.output > 0 ? 'text-teal' : node.output < 0 ? 'text-amber' : ''}">
            ${node.output > 0 ? '+' : ''}${formatNumber(node.output)} kW
          </strong>
        </td>
        <td><strong style="font-family: var(--font-mono);">${formatCurrency(node.balance)}</strong></td>
        <td>
          <span class="p-badge ${pClass}">P${node.priority}${node.priority === 1 ? ' · Prot' : ''}</span>
        </td>
        <td>
          <span class="node-badge ${statusClass}">${node.status}</span>
        </td>
        <td style="color: var(--text-dim); font-size: 0.78rem;">${node.lastUpdated}</td>
      </tr>
    `;
  }).join('');

  // Also synchronize trade dropdown options with latest node list
  populateTradeDropdowns();
}

/** Populate Seller and Buyer Dropdown Selects */
function populateTradeDropdowns() {
  const sellerSelect = $('sellerSelect');
  const buyerSelect = $('buyerSelect');
  if (!sellerSelect || !buyerSelect) return;

  const currentSeller = sellerSelect.value;
  const currentBuyer = buyerSelect.value;

  const onlineNodes = state.nodes.filter(n => n.status !== 'OFFLINE');

  // Sellers: Nodes with energy > 0 or solar/battery
  const sellers = onlineNodes.filter(n => n.type === 'SOLAR_PRODUCER' || n.type === 'BATTERY_STORAGE' || n.energy > 0);

  // Buyers: Any active node
  const buyers = onlineNodes;

  sellerSelect.innerHTML = '<option value="">Select Seller (Energy Available)</option>' +
    sellers.map(s => `<option value="${s.id}">${s.name} (${s.id}) — Avail: ${formatNumber(s.energy)} kWh</option>`).join('');

  buyerSelect.innerHTML = '<option value="">Select Buyer (Account Balance)</option>' +
    buyers.map(b => `<option value="${b.id}">${b.name} (${b.id}) — Bal: ${formatCurrency(b.balance)}</option>`).join('');

  if (currentSeller && sellers.some(s => s.id === currentSeller)) {
    sellerSelect.value = currentSeller;
  }
  if (currentBuyer && buyers.some(b => b.id === currentBuyer)) {
    buyerSelect.value = currentBuyer;
  }

  updateNodeTradeInfo();
}

/** Update small info hints below trade selects */
function updateNodeTradeInfo() {
  const sellerId = $('sellerSelect')?.value;
  const buyerId = $('buyerSelect')?.value;
  const sellerInfo = $('sellerInfo');
  const buyerInfo = $('buyerInfo');

  if (sellerInfo) {
    const sNode = state.nodes.find(n => n.id === sellerId);
    sellerInfo.textContent = sNode
      ? `Available Energy: ${formatNumber(sNode.energy)} kWh | Location: ${sNode.location}`
      : 'Select a node with available energy';
  }

  if (buyerInfo) {
    const bNode = state.nodes.find(n => n.id === buyerId);
    buyerInfo.textContent = bNode
      ? `Current Account Balance: ${formatCurrency(bNode.balance)} | Priority: P${bNode.priority}`
      : 'Select a buyer with sufficient balance';
  }
}

/** Render Audit Logs Table */
function renderAuditLogs() {
  const tbody = $('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.audits.map(log => {
    let statusClass = 'audit-committed';
    if (log.status === 'ROLLED_BACK') statusClass = 'audit-rollback';
    if (log.status === 'SUCCESS') statusClass = 'audit-success';

    return `
      <tr>
        <td><strong style="font-family: var(--font-mono); color: var(--teal);">${log.id}</strong></td>
        <td style="color: var(--text-dim); font-size: 0.78rem; white-space: nowrap;">${log.timestamp}</td>
        <td><strong>${log.event}</strong></td>
        <td>${log.seller}</td>
        <td>${log.buyer}</td>
        <td>${log.energy}</td>
        <td>${log.price}</td>
        <td><strong style="font-family: var(--font-mono);">${log.cost}</strong></td>
        <td><span class="audit-status-badge ${statusClass}">${log.status}</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${log.details}</td>
      </tr>
    `;
  }).join('');
}

/** Recalculate Estimated Transaction Cost */
function updateEstimatedCost() {
  const amount = Number($('tradeAmount')?.value) || 0;
  const metrics = calculateGridMetrics();
  const estimated = amount * metrics.dynamicPrice;
  const costEl = $('estimatedCost');
  if (costEl) costEl.textContent = formatCurrency(estimated);
}

// ==========================================
// 5. USER INTERACTION & HANDLERS
// ==========================================

/** Handle P2P Trade Execution */
function handleTradeExecution(e) {
  e.preventDefault();

  const sellerId = $('sellerSelect').value;
  const buyerId = $('buyerSelect').value;
  const amount = Number($('tradeAmount').value) || 0;
  const metrics = calculateGridMetrics();
  const cost = amount * metrics.dynamicPrice;

  const seller = state.nodes.find(n => n.id === sellerId);
  const buyer = state.nodes.find(n => n.id === buyerId);

  let status = 'COMMITTED';
  let rollbackReason = '';
  const txId = `TX-${1000 + state.audits.length + 1}`;
  const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Atomic Validation (Mocking the future Java/JDBC layer validation)
  if (!seller || !buyer) {
    status = 'ROLLED_BACK';
    rollbackReason = 'Invalid node selection. Both seller and buyer must be active nodes.';
  } else if (seller.id === buyer.id) {
    status = 'ROLLED_BACK';
    rollbackReason = 'Seller and Buyer cannot be the same node.';
  } else if (amount <= 0) {
    status = 'ROLLED_BACK';
    rollbackReason = 'Trade volume must be greater than 0 kWh.';
  } else if (seller.energy < amount) {
    status = 'ROLLED_BACK';
    rollbackReason = `Seller has insufficient energy reserve (${formatNumber(seller.energy)} kWh available vs ${formatNumber(amount)} kWh requested).`;
  } else if (buyer.balance < cost) {
    status = 'ROLLED_BACK';
    rollbackReason = `Buyer has insufficient account balance (${formatCurrency(buyer.balance)} vs ${formatCurrency(cost)} required).`;
  }

  // If COMMITTED, update state balances and energy
  if (status === 'COMMITTED') {
    seller.energy -= amount;
    buyer.energy += amount;
    seller.balance += cost;
    buyer.balance -= cost;
    seller.lastUpdated = 'Just now';
    buyer.lastUpdated = 'Just now';

    // Add to Audit Log
    state.audits.unshift({
      id: txId,
      timestamp: nowTime,
      event: 'P2P ENERGY TRADE',
      seller: seller.name,
      buyer: buyer.name,
      energy: `${formatNumber(amount)} kWh`,
      price: `₹${formatNumber(metrics.dynamicPrice, 2)}/kWh`,
      cost: formatCurrency(cost),
      status: 'COMMITTED',
      details: 'Atomic transaction committed: funds debited and energy credited via simulated JDBC layer.'
    });

    renderTradeReceiptSuccess(txId, seller.name, buyer.name, amount, metrics.dynamicPrice, cost);
    showToast(`✓ Trade ${txId} committed successfully!`, 'success');
  } else {
    // ROLLED BACK
    state.audits.unshift({
      id: txId,
      timestamp: nowTime,
      event: 'P2P ENERGY TRADE',
      seller: seller ? seller.name : 'Unknown',
      buyer: buyer ? buyer.name : 'Unknown',
      energy: `${formatNumber(amount)} kWh`,
      price: `₹${formatNumber(metrics.dynamicPrice, 2)}/kWh`,
      cost: formatCurrency(cost),
      status: 'ROLLED_BACK',
      details: rollbackReason
    });

    renderTradeReceiptRollback(txId, rollbackReason);
    showToast(`✕ Trade ${txId} rolled back: ${rollbackReason}`, 'danger');
  }

  // Re-render UI
  renderDashboard();
  renderNodesTable();
  renderAuditLogs();
}

/** Render Success Receipt */
function renderTradeReceiptSuccess(id, seller, buyer, energy, price, total) {
  const container = $('tradeResultContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="receipt-card">
      <div class="receipt-header">
        <div class="receipt-status-title committed">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>TRANSACTION COMMITTED</span>
        </div>
        <span class="status-badge badge-stable">COMMITTED</span>
      </div>

      <div class="receipt-rows">
        <div class="receipt-row">
          <span class="receipt-label">Transaction ID:</span>
          <span class="receipt-val text-teal">${id}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Seller Node:</span>
          <span class="receipt-val">${seller}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Buyer Node:</span>
          <span class="receipt-val">${buyer}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Energy Transferred:</span>
          <span class="receipt-val">${formatNumber(energy)} kWh</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Dynamic Unit Tariff:</span>
          <span class="receipt-val">₹${formatNumber(price, 2)} / kWh</span>
        </div>
      </div>

      <div class="receipt-total-box">
        <span style="font-weight: 600; color: var(--text-muted);">Total Transaction Cost:</span>
        <strong style="font-size: 1.25rem; font-family: var(--font-mono); color: var(--teal);">${formatCurrency(total)}</strong>
      </div>
    </div>
  `;
}

/** Render Rollback Receipt */
function renderTradeReceiptRollback(id, reason) {
  const container = $('tradeResultContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="receipt-card">
      <div class="receipt-header">
        <div class="receipt-status-title rollback">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <span>TRANSACTION ROLLED BACK</span>
        </div>
        <span class="status-badge badge-danger">ROLLED BACK</span>
      </div>

      <div class="receipt-rows">
        <div class="receipt-row">
          <span class="receipt-label">Transaction ID:</span>
          <span class="receipt-val text-danger">${id}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Status:</span>
          <span class="receipt-val text-danger">ROLLED BACK</span>
        </div>
      </div>

      <div class="receipt-reason-box">
        <strong>Reason for Rollback:</strong>
        <p style="margin-top: 4px;">${reason}</p>
      </div>
    </div>
  `;
}

/** Register New Node Submission */
function handleRegisterNode(e) {
  e.preventDefault();

  const name = $('newNodeName').value.trim();
  const type = $('newNodeType').value;
  const location = $('newNodeLocation').value.trim();
  const capacity = Number($('newNodeCapacity').value) || 50;
  const output = Number($('newNodeOutput').value) || 0;
  const priority = Number($('newNodePriority').value) || 3;
  const balance = Number($('newNodeBalance').value) || 500;

  // Generate ID based on Type
  const prefixMap = {
    'SOLAR_PRODUCER': 'SOLAR',
    'CONSUMER': 'CONS',
    'EV_STATION': 'EV',
    'BATTERY_STORAGE': 'BAT'
  };
  const prefix = prefixMap[type] || 'NODE';
  const index = state.nodes.length + 1;
  const newId = `NODE-${prefix}-${String(index).padStart(2, '0')}`;

  const newNode = {
    id: newId,
    name,
    type,
    location,
    energy: output > 0 ? 25.0 : 0.0,
    capacity,
    output,
    balance,
    priority,
    status: 'ONLINE',
    lastUpdated: 'Just now'
  };

  state.nodes.push(newNode);

  // Close modal & reset form
  const modal = $('nodeModal');
  if (modal) modal.close();
  $('nodeForm').reset();

  // Add system audit
  state.audits.unshift({
    id: `EVT-${1000 + state.audits.length + 1}`,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    event: 'NODE REGISTRATION',
    seller: 'Grid Operator',
    buyer: name,
    energy: `${formatNumber(capacity)} kWh cap`,
    price: 'N/A',
    cost: formatCurrency(balance),
    status: 'SUCCESS',
    details: `New ${getReadableType(type)} registered at ${location} with Priority P${priority}.`
  });

  showToast(`✓ Node ${name} (${newId}) registered successfully!`, 'success');

  renderDashboard();
  renderNodesTable();
  renderAuditLogs();
}

/** Theme Toggle Handler */
function initTheme() {
  const savedTheme = localStorage.getItem('fluxgrid_theme') || 'dark';
  setTheme(savedTheme);

  $('themeToggleBtn')?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fluxgrid_theme', theme);

  const sunIcon = $('themeIconSun');
  const moonIcon = $('themeIconMoon');

  if (theme === 'dark') {
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }
}

/** Setup Tab Navigation */
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.page-section');
  const titles = {
    'dashboard': { title: 'Smart Micro-Grid Control Room', subtitle: 'Local renewable energy monitoring and trading' },
    'nodes': { title: 'Micro-Grid Node Registry', subtitle: 'Active producer and consumer node ledger' },
    'trade': { title: 'P2P Energy Trading Engine', subtitle: 'Direct peer-to-peer decentralized energy market' },
    'audit': { title: 'System History & Audit Ledger', subtitle: 'Immutable log of micro-grid transactions and events' }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => s.classList.remove('active-section'));
      const targetSec = $(target);
      if (targetSec) targetSec.classList.add('active-section');

      // Update Topbar Title
      if (titles[target]) {
        $('topbarTitle').textContent = titles[target].title;
        document.querySelector('.topbar-subtitle').textContent = titles[target].subtitle;
      }

      // Close mobile sidebar if open
      $('sidebar')?.classList.remove('open');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Mobile menu toggle
  $('menuToggle')?.addEventListener('click', () => {
    $('sidebar')?.classList.toggle('open');
  });
}

/** Toast Notifications helper */
function showToast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.25s ease-out';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

/** Update Live Clock in Header */
function updateTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const timeEl = $('lastUpdatedTime');
  if (timeEl) timeEl.textContent = timeStr;
}

// ==========================================
// 6. INITIALIZATION & EVENT LISTENERS
// ==========================================
function initApp() {
  // Theme & Navigation
  initTheme();
  initNavigation();
  updateTimestamp();

  // Modal handlers
  const modal = $('nodeModal');
  $('openNodeModal')?.addEventListener('click', () => modal?.showModal());
  $('closeNodeModal')?.addEventListener('click', () => modal?.close());
  $('cancelNodeModal')?.addEventListener('click', () => modal?.close());
  $('nodeForm')?.addEventListener('submit', handleRegisterNode);

  // Filter Listeners
  ['nodeSearch', 'typeFilter', 'statusFilter', 'priorityFilter'].forEach(id => {
    $(id)?.addEventListener('input', renderNodesTable);
    $(id)?.addEventListener('change', renderNodesTable);
  });

  // Trade Form Listeners
  $('tradeForm')?.addEventListener('submit', handleTradeExecution);
  $('tradeAmount')?.addEventListener('input', updateEstimatedCost);
  $('sellerSelect')?.addEventListener('change', updateNodeTradeInfo);
  $('buyerSelect')?.addEventListener('change', updateNodeTradeInfo);

  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = btn.dataset.amt;
      $('tradeAmount').value = amt;
      updateEstimatedCost();
    });
  });

  // Refresh Button
  $('refreshBtn')?.addEventListener('click', () => {
    updateTimestamp();
    renderDashboard();
    renderNodesTable();
    renderAuditLogs();
    showToast('Telemetry updated with latest micro-grid metrics.', 'info');
  });

  // Initial Full Render
  renderDashboard();
  renderNodesTable();
  renderAuditLogs();

  // Replace demo nodes with the records from the Java backend.
  loadNodesFromBackend();
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
