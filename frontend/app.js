const state = {
  nodes: [],
  grid: null,
  pricing: null,
  connected: false,

  audits: []
};

const API_BASE = 'http://localhost:8080/api';
let refreshPromise = null;
let emptyTradeReceiptHtml = '';

async function apiRequest(path, form) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method: form === undefined ? 'GET' : 'POST',
      ...(form === undefined ? {} : { body: new URLSearchParams(form) }),
      signal: AbortSignal.timeout(15000)
    });
  } catch (cause) {
    throw new Error(form === undefined
      ? 'Cannot reach the Java backend. Displayed data may be stale.'
      : 'No response received. The operation may have completed; refresh and inspect audit logs before retrying.');
  }
  const data = await response.json();
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Backend request failed.');
    error.httpStatus = response.status;
    throw error;
  }
  return data;
}

async function loadNodesFromBackend() {
  const nodes = await apiRequest('/nodes');
  return nodes.map(n => ({ id: n.nodeId, name: n.name, type: n.type, location: n.location,
    energy: n.availableEnergyKwh, capacity: n.maxCapacityKwh, output: n.currentOutputKw,
    balance: n.balance, priority: n.priority, status: n.status, lastUpdated: 'Last refresh' }));
}
async function loadGridStatusFromBackend() { return apiRequest('/grid-status'); }
async function loadPricingFromBackend() { return apiRequest('/pricing'); }
async function loadAuditLogsFromBackend() {
  const logs = await apiRequest('/audit-logs');
  return logs.map(log => ({ ...log, seller: log.seller || '—',
    buyer: log.buyer || log.relatedNodeId || '—',
    energy: log.energyKwh == null ? '—' : formatNumber(log.energyKwh, 2) + ' kWh',
    price: log.pricePerKwh == null ? '—' : formatCurrency(log.pricePerKwh) + '/kWh',
    cost: log.totalCost == null ? '—' : formatCurrency(log.totalCost) }));
}

async function refreshAllData(afterMutation = false) {
  while (refreshPromise) {
    if (!afterMutation) return refreshPromise;
    await refreshPromise;
  }
  refreshPromise = (async () => {
    $('refreshBtn').disabled = true;
    try {
      
      const [nodes, grid, pricing, audits] = await Promise.all([
        loadNodesFromBackend(), loadGridStatusFromBackend(), loadPricingFromBackend(), loadAuditLogsFromBackend()
      ]);
      Object.assign(state, { nodes, grid, pricing, audits, connected: true });
      document.querySelector('.conn-state').textContent = 'Connected';
      document.querySelector('.conn-sub').textContent = 'Java API / PostgreSQL';
      updateTimestamp();
      renderDashboard(); renderNodesTable(); renderAuditLogs();
      return true;
    } catch (error) {
      state.connected = false;
      document.querySelector('.conn-state').textContent = 'Unavailable';
      document.querySelector('.conn-sub').textContent = 'Last values may be stale';
      $('headerGridStatusText').textContent = 'DATA UNAVAILABLE';
      $('lastUpdatedTime').textContent = 'Refresh failed';
      $('loadSheddingBtn').disabled = true;
      showToast(error.message, 'danger');
      return false;
    } finally { $('refreshBtn').disabled = false; }
  })();
  try { return await refreshPromise; } finally { refreshPromise = null; }
}

const $ = (id) => document.getElementById(id);

function formatCurrency(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatNumber(val, decimals = 1) {
  return val == null || !Number.isFinite(Number(val)) ? '—' : Number(val).toFixed(decimals);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  
  const grid = state.grid;
  const status = grid?.status || 'LOADING';
  return {
    generation: grid?.generation ?? NaN, consumption: grid?.consumption ?? NaN,
    reserve: grid?.netReserve ?? NaN,
    activeNodes: state.nodes.filter(n => n.status === 'ONLINE').length + ' / ' + state.nodes.length,
    dynamicPrice: state.pricing?.pricePerKwh ?? NaN,
    status, badgeClass: status === 'STABLE' ? 'badge-stable' : status === 'DEFICIT' ? 'badge-danger' : 'badge-warning'
  };
}






function renderDashboard() {
  const metrics = calculateGridMetrics();

  
  $('generationValue').textContent = formatNumber(metrics.generation);
  $('consumptionValue').textContent = formatNumber(metrics.consumption);

  const reserveEl = $('reserveValue');
  reserveEl.textContent = (metrics.reserve > 0 ? '+' : '') + formatNumber(metrics.reserve);

  const reserveCard = $('reserveCard');
  const reserveIcon = $('reserveIconContainer');

  if (metrics.status === 'DEFICIT') {
    reserveCard.className = 'metric-card card-deficit';
    reserveIcon.className = 'metric-icon icon-deficit';
  } else {
    reserveCard.className = 'metric-card card-teal';
    reserveIcon.className = 'metric-icon icon-teal';
  }

  $('activeNodesValue').textContent = metrics.activeNodes;
  $('priceValue').textContent = '₹' + formatNumber(metrics.dynamicPrice, 2);
  $('gridStatusText').textContent = metrics.status;

  
  const gridStatusBadge = $('gridStatusBadge');
  gridStatusBadge.textContent = metrics.status;
  gridStatusBadge.className = `status-badge ${metrics.badgeClass}`;

  const headerStatusPill = $('headerGridStatusPill');
  const headerStatusText = $('headerGridStatusText');
  headerStatusText.textContent = metrics.status;
  headerStatusPill.className = 'header-status-pill ' + (metrics.status === 'DEFICIT' ? 'danger' : metrics.status !== 'STABLE' ? '' : 'stable');

  
  $('pricingCurrent').textContent = '₹' + formatNumber(metrics.dynamicPrice, 2);
  $('baseRate').textContent = formatCurrency(state.pricing?.basePrice) + '/kWh';
  $('demandFactor').textContent = formatNumber(state.pricing?.supplyDemandFactor, 2) + '×';
  $('peakFactor').textContent = formatNumber(state.pricing?.peakFactor, 2) + '×';
  $('weatherFactor').textContent = formatNumber(state.pricing?.weatherFactor, 2) + '×';

  $('priceBadgeAlert').textContent = state.pricing ? 'Current backend tariff' : 'Waiting for pricing';
  $('pricingExplanation').textContent = 'Tariff uses live supply and demand, a local evening peak factor (18:00-22:00), and neutral simulated weather (1.00). The final trade receipt uses the execution-time price.';

  $('stabGen').textContent = `${formatNumber(metrics.generation)} kW`;
  $('stabCons').textContent = `${formatNumber(metrics.consumption)} kW`;
  const stabDeficit = $('stabDeficit');

  stabDeficit.textContent = formatNumber(metrics.reserve) + ' kW reserve';
  stabDeficit.className = metrics.status === 'DEFICIT' ? 'text-danger' : 'text-teal';
  $('stabilityStatusBadge').textContent = metrics.status;
  $('stabilityStatusBadge').className = 'status-badge ' + metrics.badgeClass;
  $('stabilityMessage').className = 'stability-alert-box ' + (metrics.status === 'DEFICIT' ? 'alert-danger' : 'alert-stable');
  $('stabilityMessage').textContent = metrics.status === 'DEFICIT'
    ? 'Demand exceeds generation. Run load shedding to shed Priority 4, then 3, then 2 consumers; Priority 1 remains protected.'
    : metrics.status === 'WARNING' ? 'Supply covers demand, but the reserve is low.'
    : metrics.status === 'STABLE' ? 'The grid has a stable supply reserve.' : 'Waiting for the Java backend.';
  $('reserveFooter').textContent = state.grid ? metrics.status + ': ' + formatNumber(metrics.reserve) + ' kW reserve' : 'Waiting for grid data';
  $('gridStatusFooter').textContent = state.nodes.filter(n => n.status === 'THROTTLED').length + ' nodes throttled';
  $('loadSheddingBtn').disabled = !state.connected;

  
  renderPriorityCards();

  
  $('tradePrice').textContent = `₹${formatNumber(metrics.dynamicPrice, 2)} / kWh`;
  updateEstimatedCost();
}


function renderPriorityCards() {
  const container = $('priorityCards');
  if (!container) return;

  const sortedNodes = [...state.nodes].sort((a, b) => a.priority - b.priority);

  container.innerHTML = sortedNodes.map(node => {
    let statusBadgeClass = 'badge-online';
    if (node.status === 'THROTTLED') statusBadgeClass = 'badge-throttled';
    if (node.status === 'OFFLINE') statusBadgeClass = 'badge-offline';

    const pClass = node.priority === 1 ? 'p1-badge' : node.priority === 2 ? 'p2-badge' : node.priority === 3 ? 'p3-badge' : 'p4-badge';
    const pTag = node.priority === 1 ? 'Protected from load shedding' : node.status === 'THROTTLED' ? 'Excluded from active demand'
      : node.status === 'ONLINE' && node.output < 0 ? 'Eligible for shedding during deficit' : 'Not an active consuming node';

    return `
      <div class="node-status-card">
        <div class="node-status-head">
          <strong>${escapeHtml(node.name)}</strong>
          <span class="node-badge ${statusBadgeClass}">${escapeHtml(node.status)}</span>
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


function renderNodesTable() {
  const tbody = $('nodesTableBody');
  if (!tbody) return;
  
  populateTradeDropdowns();

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
            <strong>${escapeHtml(node.name)}</strong>
            <small>${escapeHtml(node.id)}</small>
          </div>
        </td>
        <td>
          <span class="type-pill ${typeClass}">${escapeHtml(readableType)}</span>
        </td>
        <td>${escapeHtml(node.location)}</td>
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
          <span class="node-badge ${statusClass}">${escapeHtml(node.status)}</span>
        </td>
        <td style="color: var(--text-dim); font-size: 0.78rem;">${escapeHtml(node.lastUpdated)}</td>
      </tr>
    `;
  }).join('');

}


function populateTradeDropdowns() {
  const sellerSelect = $('sellerSelect');
  const buyerSelect = $('buyerSelect');
  if (!sellerSelect || !buyerSelect) return;

  const currentSeller = sellerSelect.value;
  const currentBuyer = buyerSelect.value;

  const onlineNodes = state.nodes.filter(n => n.status === 'ONLINE');

  
  const sellers = onlineNodes.filter(n => n.type === 'SOLAR_PRODUCER' || n.type === 'BATTERY_STORAGE' || n.energy > 0);

  
  const buyers = onlineNodes;

  sellerSelect.innerHTML = '<option value="">Select Seller (Energy Available)</option>' +
    sellers.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.id)}) — Avail: ${formatNumber(s.energy)} kWh</option>`).join('');

  buyerSelect.innerHTML = '<option value="">Select Buyer (Account Balance)</option>' +
    buyers.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.id)}) — Bal: ${formatCurrency(b.balance)}</option>`).join('');

  if (currentSeller && sellers.some(s => s.id === currentSeller)) {
    sellerSelect.value = currentSeller;
  }
  if (currentBuyer && buyers.some(b => b.id === currentBuyer)) {
    buyerSelect.value = currentBuyer;
  }

  updateNodeTradeInfo();
}


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


function hasCommittedReceipt(log) {
  return log.event === 'ENERGY_TRADE' && log.status === 'COMMITTED'
    && [log.id, log.relatedTradeId, log.seller, log.buyer].every(value =>
      typeof value === 'string' && value.trim() !== '' && value !== '—')
    && [log.energyKwh, log.pricePerKwh, log.totalCost].every(value =>
      value != null && String(value).trim() !== '' && Number.isFinite(Number(value)))
    && Number(log.energyKwh) > 0 && Number(log.pricePerKwh) > 0 && Number(log.totalCost) >= 0;
}

function renderAuditLogs() {
  const tbody = $('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.audits.map(log => {
    let statusClass = 'audit-committed';
    if (log.status === 'ROLLED_BACK' || log.status === 'FAILED') statusClass = 'audit-rollback';
    if (log.status === 'SUCCESS') statusClass = 'audit-success';

    return `
      <tr>
        <td><strong style="font-family: var(--font-mono); color: var(--teal);">${escapeHtml(log.id)}</strong></td>
        <td style="color: var(--text-dim); font-size: 0.78rem; white-space: nowrap;">${escapeHtml(log.timestamp)}</td>
        <td><strong>${escapeHtml(log.event)}</strong></td>
        <td>${escapeHtml(log.seller)}</td>
        <td>${escapeHtml(log.buyer)}</td>
        <td>${escapeHtml(log.energy)}</td>
        <td>${escapeHtml(log.price)}</td>
        <td><strong style="font-family: var(--font-mono);">${escapeHtml(log.cost)}</strong></td>
        <td><span class="audit-status-badge ${statusClass}">${escapeHtml(log.status)}</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(log.details)}</td>
        <td>${hasCommittedReceipt(log) ? `<button type="button" class="btn btn-secondary receipt-action" data-audit-id="${escapeHtml(log.id)}">View Receipt</button>` : ''}</td>
      </tr>
    `;
  }).join('');
}

function handleAuditReceiptClick(event) {
  const button = event.target.closest('button[data-audit-id]');
  if (!button) return;
  const log = state.audits.find(entry => entry.id === button.dataset.auditId);
  if (!log || !hasCommittedReceipt(log)) return;
  renderTradeReceiptSuccess(log.relatedTradeId, log.seller, log.buyer,
    log.energyKwh, log.pricePerKwh, log.totalCost);
  document.querySelector('.nav-btn[data-target="trade"]').click();
  requestAnimationFrame(() => {
    const receipt = $('tradeResultContainer');
    receipt.focus({ preventScroll: true });
    receipt.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
}

function resetTradeForm({ clearReceipt = false } = {}) {
  $('sellerSelect').value = '';
  $('buyerSelect').value = '';
  $('tradeAmount').value = '';
  updateNodeTradeInfo();
  updateEstimatedCost();
  if (clearReceipt) $('tradeResultContainer').innerHTML = emptyTradeReceiptHtml;
}


function updateEstimatedCost() {
  const amount = Number($('tradeAmount')?.value) || 0;
  const metrics = calculateGridMetrics();
  const estimated = amount === 0 ? 0 : amount * metrics.dynamicPrice;
  const costEl = $('estimatedCost');
  if (costEl) costEl.textContent = formatCurrency(estimated);
}






async function handleTradeExecution(e) {
  e.preventDefault();
  const button = e.currentTarget.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const result = await apiRequest('/trade', { sellerNodeId: $('sellerSelect').value,
      buyerNodeId: $('buyerSelect').value, energyKwh: $('tradeAmount').value });
    renderTradeReceiptSuccess(result.tradeId, result.sellerNodeId, result.buyerNodeId,
      result.energyKwh, result.pricePerKwh, result.totalCost);
    resetTradeForm();
    showToast(result.message, 'success');
  } catch (error) {
    renderTradeReceiptRollback('Not assigned', error.message, error.httpStatus === 400 || error.httpStatus === 404);
    showToast(error.message, 'danger');
  } finally {
    await refreshAllData(true);
    button.disabled = false;
  }
}


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
          <span class="receipt-val text-teal">${escapeHtml(id)}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Seller Node:</span>
          <span class="receipt-val">${escapeHtml(seller)}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Buyer Node:</span>
          <span class="receipt-val">${escapeHtml(buyer)}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Energy Transferred:</span>
          <span class="receipt-val">${formatNumber(energy, 2)} kWh</span>
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


function renderTradeReceiptRollback(id, reason, rejected = true) {
  const container = $('tradeResultContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="receipt-card">
      <div class="receipt-header">
        <div class="receipt-status-title rollback">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <span>${rejected ? 'TRADE REJECTED / ROLLED BACK' : 'TRANSACTION STATUS UNCONFIRMED'}</span>
        </div>
        <span class="status-badge badge-danger">${rejected ? 'REJECTED' : 'UNCONFIRMED'}</span>
      </div>

      <div class="receipt-rows">
        <div class="receipt-row">
          <span class="receipt-label">Transaction ID:</span>
          <span class="receipt-val text-danger">${escapeHtml(id)}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Status:</span>
          <span class="receipt-val text-danger">${rejected ? 'REJECTED' : 'UNCONFIRMED'}</span>
        </div>
      </div>

      <div class="receipt-reason-box">
        <strong>Details:</strong>
        <p style="margin-top: 4px;">${escapeHtml(reason)}</p>
      </div>
    </div>
  `;
}


async function handleRegisterNode(e) {
  e.preventDefault();
  const button = e.currentTarget.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const result = await apiRequest('/nodes', {
      name: $('newNodeName').value.trim(), type: $('newNodeType').value,
      location: $('newNodeLocation').value.trim(), maxCapacityKwh: $('newNodeCapacity').value,
      availableEnergyKwh: $('newNodeEnergy').value, currentOutputKw: $('newNodeOutput').value,
      priority: $('newNodePriority').value, balance: $('newNodeBalance').value
    });
    $('nodeModal').close(); $('nodeForm').reset();
    showToast('Node ' + result.nodeId + ' registered.', 'success');
    await refreshAllData(true);
  } catch (error) { showToast(error.message, 'danger'); }
  finally { button.disabled = false; }
}

async function handleLoadShedding() {
  const button = $('loadSheddingBtn');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const result = await apiRequest('/load-shedding', {});
    showToast(result.message, 'info');
  } catch (error) { showToast(error.message, 'danger'); }
  finally { await refreshAllData(true); button.disabled = !state.connected; }
}


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


function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.page-section');
  const titles = {
    'dashboard': { title: 'Smart Micro-Grid Control Room', subtitle: 'Local renewable energy monitoring and trading' },
    'nodes': { title: 'Micro-Grid Node Registry', subtitle: 'Active producer and consumer node ledger' },
    'trade': { title: 'P2P Energy Trading Engine', subtitle: 'Direct peer-to-peer decentralized energy market' },
    'audit': { title: 'System History & Audit Ledger', subtitle: 'Operational history of micro-grid transactions and events' }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => s.classList.remove('active-section'));
      const targetSec = $(target);
      if (targetSec) targetSec.classList.add('active-section');

      
      if (titles[target]) {
        $('topbarTitle').textContent = titles[target].title;
        document.querySelector('.topbar-subtitle').textContent = titles[target].subtitle;
      }

      
      $('sidebar')?.classList.remove('open');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  
  $('menuToggle')?.addEventListener('click', () => {
    $('sidebar')?.classList.toggle('open');
  });
}


function showToast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.25s ease-out';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}


function updateTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const timeEl = $('lastUpdatedTime');
  if (timeEl) timeEl.textContent = timeStr;
}




function initApp() {
  emptyTradeReceiptHtml = $('tradeResultContainer').innerHTML;
  
  initTheme();
  initNavigation();
  $('lastUpdatedTime').textContent = 'Not loaded';

  
  const modal = $('nodeModal');
  $('openNodeModal')?.addEventListener('click', () => modal?.showModal());
  $('closeNodeModal')?.addEventListener('click', () => modal?.close());
  $('cancelNodeModal')?.addEventListener('click', () => modal?.close());
  $('nodeForm')?.addEventListener('submit', handleRegisterNode);

  
  ['nodeSearch', 'typeFilter', 'statusFilter', 'priorityFilter'].forEach(id => {
    $(id)?.addEventListener('input', renderNodesTable);
    $(id)?.addEventListener('change', renderNodesTable);
  });

  
  $('tradeForm')?.addEventListener('submit', handleTradeExecution);
  $('tradeAmount')?.addEventListener('input', updateEstimatedCost);
  $('sellerSelect')?.addEventListener('change', updateNodeTradeInfo);
  $('buyerSelect')?.addEventListener('change', updateNodeTradeInfo);

  
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = btn.dataset.amt;
      $('tradeAmount').value = amt;
      updateEstimatedCost();
    });
  });

  
  $('refreshBtn')?.addEventListener('click', () => {
    resetTradeForm({ clearReceipt: true });
    refreshAllData();
  });
  $('auditTableBody')?.addEventListener('click', handleAuditReceiptClick);
  $('loadSheddingBtn')?.addEventListener('click', handleLoadShedding);

  
  renderDashboard();
  renderNodesTable();
  renderAuditLogs();

  refreshAllData();
}


document.addEventListener('DOMContentLoaded', initApp);
