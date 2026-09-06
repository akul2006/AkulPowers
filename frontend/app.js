const byId = id => document.getElementById(id);
const generationValue=byId('generationValue'), consumptionValue=byId('consumptionValue'), reserveValue=byId('reserveValue'), activeNodesValue=byId('activeNodesValue'), priceValue=byId('priceValue'), renewableValue=byId('renewableValue');
const generatedToday=byId('generatedToday'), consumedToday=byId('consumedToday'), pricingCurrent=byId('pricingCurrent'), baseRate=byId('baseRate'), demandFactor=byId('demandFactor'), peakFactor=byId('peakFactor'), weatherFactor=byId('weatherFactor'), pricingExplanation=byId('pricingExplanation');
const gridStatusBadge=byId('gridStatusBadge'), generationBar=byId('generationBar'), consumptionBar=byId('consumptionBar'), generationBarText=byId('generationBarText'), consumptionBarText=byId('consumptionBarText'), stabilityMessage=byId('stabilityMessage'), priorityCards=byId('priorityCards');
const nodeSearch=byId('nodeSearch'), typeFilter=byId('typeFilter'), statusFilter=byId('statusFilter'), priorityFilter=byId('priorityFilter'), nodesTableBody=byId('nodesTableBody');
const sellerSelect=byId('sellerSelect'), buyerSelect=byId('buyerSelect'), tradeAmount=byId('tradeAmount'), tradePrice=byId('tradePrice'), estimatedCost=byId('estimatedCost'), tradeForm=byId('tradeForm'), tradeResult=byId('tradeResult');
const auditList=byId('auditList'), nodeModal=byId('nodeModal'), nodeForm=byId('nodeForm'), openNodeModal=byId('openNodeModal'), closeNodeModal=byId('closeNodeModal'), refreshBtn=byId('refreshBtn');
const newNodeName=byId('newNodeName'), newNodeType=byId('newNodeType'), newNodeLocation=byId('newNodeLocation'), newNodeCapacity=byId('newNodeCapacity'), newNodePriority=byId('newNodePriority');

const state = {
  nodes: [
    { id:'NODE-SOLAR-01', name:'North Ridge Solar', type:'SOLAR_PRODUCER', location:'North Ridge', energy:120, capacity:200, output:18.4, balance:1248.32, priority:2, status:'ONLINE' },
    { id:'NODE-SOLAR-02', name:'Sunward Commons', type:'SOLAR_PRODUCER', location:'East Sector', energy:80, capacity:120, output:21.6, balance:876.14, priority:2, status:'ONLINE' },
    { id:'NODE-CONS-01', name:'Harbor Hospital', type:'CONSUMER', location:'Harbor', energy:0, capacity:0, output:-24.2, balance:2420.58, priority:1, status:'ONLINE' },
    { id:'NODE-EV-01', name:'West Loop Charge', type:'EV_STATION', location:'West Loop', energy:10, capacity:48, output:-12.0, balance:186.40, priority:4, status:'THROTTLED' },
    { id:'NODE-CONS-02', name:'Cedar Heights', type:'CONSUMER', location:'Cedar Heights', energy:0, capacity:0, output:-23.8, balance:594.72, priority:3, status:'ONLINE' },
    { id:'NODE-BAT-01', name:'Community Battery', type:'BATTERY_STORAGE', location:'East Sector', energy:65, capacity:100, output:10.0, balance:760.00, priority:2, status:'ONLINE' },
    { id:'NODE-EV-02', name:'Depot Charging', type:'EV_STATION', location:'South Depot', energy:0, capacity:60, output:0, balance:300, priority:4, status:'OFFLINE' }
  ],
  pricing: { baseRate:5.00, demandFactor:1.20, peakFactor:1.25, weatherFactor:1.10 },
  generatedToday:684.2,
  consumedToday:572.8,
  renewableShare:80,
  audits:[
    {id:'TX-1003', time:'10:12', type:'P2P TRADE', text:'NODE-SOLAR-02 → NODE-EV-01 · 50 kWh · Buyer balance insufficient', status:'ROLLED_BACK'},
    {id:'TX-1002', time:'10:05', type:'P2P TRADE', text:'NODE-SOLAR-01 → NODE-CONS-01 · 20 kWh · ₹120', status:'COMMITTED'},
    {id:'EVT-1001', time:'09:58', type:'LOAD SHEDDING', text:'West Loop Charge throttled. Priority 1 hospital protected.', status:'SUCCESS'}
  ]
};

function currentMetrics(){
  const generation = state.nodes.filter(n=>n.status!=='OFFLINE' && n.output>0).reduce((s,n)=>s+n.output,0);
  const consumption = Math.abs(state.nodes.filter(n=>n.status!=='OFFLINE' && n.output<0).reduce((s,n)=>s+n.output,0));
  const reserve = generation-consumption;
  const active = state.nodes.filter(n=>n.status!=='OFFLINE').length;
  const p = state.pricing;
  const price = p.baseRate*p.demandFactor*p.peakFactor*p.weatherFactor;
  const status = reserve < -10 ? 'LOAD SHEDDING ACTIVE' : reserve < 5 ? 'WARNING' : 'STABLE';
  return {generation,consumption,reserve,active,price,status};
}

const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
const num = (n,d=1)=>Number(n).toFixed(d);

function renderDashboard(){
  const m=currentMetrics();
  generationValue.textContent=num(m.generation); consumptionValue.textContent=num(m.consumption); reserveValue.textContent=(m.reserve>=0?'+':'')+num(m.reserve); activeNodesValue.textContent=m.active; priceValue.textContent=num(m.price,2); renewableValue.textContent=state.renewableShare;
  generatedToday.textContent=num(state.generatedToday)+' kWh'; consumedToday.textContent=num(state.consumedToday)+' kWh';
  pricingCurrent.textContent=money(m.price)+'/kWh'; baseRate.textContent=money(state.pricing.baseRate)+'/kWh'; demandFactor.textContent=num(state.pricing.demandFactor,2)+'×'; peakFactor.textContent=num(state.pricing.peakFactor,2)+'×'; weatherFactor.textContent=num(state.pricing.weatherFactor,2)+'×';
  pricingExplanation.textContent = m.reserve<0 ? 'Demand is higher than available generation, so the current rate is increased.' : 'Generation is sufficient for current demand, so pricing pressure is lower.';
  gridStatusBadge.textContent=m.status; gridStatusBadge.className='badge '+(m.status==='STABLE'?'stable':m.status==='WARNING'?'warning':'danger');
  const max=Math.max(m.generation,m.consumption,1); generationBar.style.width=(m.generation/max*100)+'%'; consumptionBar.style.width=(m.consumption/max*100)+'%'; generationBarText.textContent=num(m.generation)+' kW'; consumptionBarText.textContent=num(m.consumption)+' kW';
  stabilityMessage.textContent = m.reserve<0 ? `GRID DEFICIT DETECTED — ${num(Math.abs(m.reserve))} kW shortfall. Lower-priority loads may be throttled.` : `Grid has a ${num(m.reserve)} kW reserve and is operating normally.`;
  stabilityMessage.className='stability-message'+(m.reserve<0?' danger':'');
  priorityCards.innerHTML=[...state.nodes].sort((a,b)=>a.priority-b.priority).map(n=>`<div class="priority-card"><strong>${n.name}</strong><span>Priority ${n.priority}${n.priority===1?' · Protected':''}</span><span class="status-${n.status.toLowerCase()}">${n.status}</span></div>`).join('');
  tradePrice.textContent=money(m.price)+'/kWh'; updateEstimatedCost();
}

function renderNodes(){
  const search=nodeSearch.value.trim().toLowerCase(), type=typeFilter.value, status=statusFilter.value, priority=priorityFilter.value;
  const list=state.nodes.filter(n=>(!search || `${n.id} ${n.name} ${n.location}`.toLowerCase().includes(search)) && (!type||n.type===type) && (!status||n.status===status) && (!priority||n.priority===Number(priority)));
  nodesTableBody.innerHTML=list.map(n=>`<tr><td><strong>${n.name}</strong><small>${n.id}</small></td><td>${n.type}</td><td>${n.location}</td><td>${num(n.energy)}</td><td>${num(n.capacity)}</td><td>${n.output>0?'+':''}${num(n.output)}</td><td>${money(n.balance)}</td><td>${n.priority}${n.priority===1?' · Protected':''}</td><td class="status-${n.status.toLowerCase()}">${n.status}</td></tr>`).join('');
  populateTradeSelects();
}

function populateTradeSelects(){
  const online=state.nodes.filter(n=>n.status!=='OFFLINE');
  const sellerOld=sellerSelect.value, buyerOld=buyerSelect.value;
  sellerSelect.innerHTML='<option value="">Select seller</option>'+online.map(n=>`<option value="${n.id}">${n.id} - ${n.name}</option>`).join('');
  buyerSelect.innerHTML='<option value="">Select buyer</option>'+online.map(n=>`<option value="${n.id}">${n.id} - ${n.name}</option>`).join('');
  if(online.some(n=>n.id===sellerOld)) sellerSelect.value=sellerOld;
  if(online.some(n=>n.id===buyerOld)) buyerSelect.value=buyerOld;
}

function renderAudits(){
  auditList.innerHTML=state.audits.map(a=>`<div class="audit-item"><div><strong>${a.id}</strong><small>${a.time}</small></div><div><strong>${a.type}</strong><small>${a.text}</small></div><b class="${a.status==='COMMITTED'||a.status==='SUCCESS'?'success-text':'error-text'}">${a.status}</b></div>`).join('');
}

function updateEstimatedCost(){ const m=currentMetrics(), amount=Number(tradeAmount.value)||0; estimatedCost.textContent=money(amount*m.price); }

function executeDemoTrade(e){
  e.preventDefault();
  const seller=state.nodes.find(n=>n.id===sellerSelect.value), buyer=state.nodes.find(n=>n.id===buyerSelect.value), amount=Number(tradeAmount.value), m=currentMetrics();
  let status='COMMITTED', message='Energy trade committed successfully.';
  if(!seller||!buyer||seller.id===buyer.id||amount<=0){status='ROLLED_BACK';message='Invalid seller, buyer, or trade amount.'}
  else if(seller.energy<amount){status='ROLLED_BACK';message='Seller does not have enough stored energy.'}
  else if(buyer.balance<amount*m.price){status='ROLLED_BACK';message='Buyer has insufficient balance.'}
  if(status==='COMMITTED'){
    seller.energy-=amount; buyer.energy+=amount; const cost=amount*m.price; buyer.balance-=cost; seller.balance+=cost;
  }
  const id='TX-'+(1000+state.audits.length+1), cost=amount*m.price;
  state.audits.unshift({id,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),type:'P2P TRADE',text:`${seller?.id||'?'} → ${buyer?.id||'?'} · ${num(amount)} kWh · ${message}`,status});
  tradeResult.innerHTML=`<div class="result-card"><div><span>Transaction ID</span><strong>${id}</strong></div><div><span>Status</span><strong class="${status==='COMMITTED'?'success-text':'error-text'}">${status}</strong></div><div><span>Energy</span><strong>${num(amount)} kWh</strong></div><div><span>Price</span><strong>${money(m.price)}/kWh</strong></div><div><span>Total Cost</span><strong>${money(cost)}</strong></div><p class="muted">${message}</p></div>`;
  renderNodes(); renderAudits(); renderDashboard();
}

function registerDemoNode(e){
  e.preventDefault();
  const type=newNodeType.value, index=state.nodes.length+1;
  const prefix=type==='SOLAR_PRODUCER'?'SOLAR':type==='CONSUMER'?'CONS':type==='EV_STATION'?'EV':'BAT';
  state.nodes.push({id:`NODE-${prefix}-${String(index).padStart(2,'0')}`,name:newNodeName.value.trim(),type,location:newNodeLocation.value.trim(),energy:0,capacity:Number(newNodeCapacity.value),output:0,balance:500,priority:Number(newNodePriority.value),status:'ONLINE'});
  nodeModal.close(); nodeForm.reset(); renderNodes(); renderDashboard();
}

function setupNavigation(){
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active-section'));document.getElementById(btn.dataset.target).classList.add('active-section');window.scrollTo({top:0,behavior:'smooth'});}));
}

setupNavigation();
[nodeSearch,typeFilter,statusFilter,priorityFilter].forEach(el=>el.addEventListener('input',renderNodes));
tradeAmount.addEventListener('input',updateEstimatedCost); tradeForm.addEventListener('submit',executeDemoTrade);
openNodeModal.addEventListener('click',()=>nodeModal.showModal()); closeNodeModal.addEventListener('click',()=>nodeModal.close()); nodeForm.addEventListener('submit',registerDemoNode);
refreshBtn.addEventListener('click',()=>{renderDashboard();renderNodes();renderAudits();});
renderDashboard(); renderNodes(); renderAudits();
