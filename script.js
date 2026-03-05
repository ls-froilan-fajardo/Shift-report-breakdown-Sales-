// THEME TOGGLE
document.body.classList.remove('light-mode');
document.getElementById('toggleTheme').onclick = () => document.body.classList.toggle('light-mode');

// HELP MODAL
const modal = document.getElementById("helpModal"), btn = document.getElementById("helpIcon"), span = document.getElementsByClassName("close-btn")[0];
btn.onclick = () => modal.style.display = "block";
span.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }

let allRows = [], paymentsRows = []; 
const columnsToDisplay = ["Account", "Final Price", "Discount", "Loss", "Comp", "Charge"];
const csvColNames = { "Final Price": "FinalPrice", "Discount": "Discount", "Loss": "Loss", "Comp": "Comp", "Charge": "Charge" };

const csvFileInput = document.getElementById('csvFileInput'), paymentsCsvInput = document.getElementById('paymentsCsvInput'), staffFilter = document.getElementById('staffFilter');
const totalSpans = { ownPlusVoids: document.getElementById('ownPlusVoidsTotal') };

function formatNumber(num) { return (!num || num === 0) ? "" : num.toFixed(2); }
function getZeroObj() { let obj = {}; columnsToDisplay.slice(1).forEach(col => obj[col] = 0); return obj; }

function checkFilesAndRender() {
  const sSec = document.getElementById('salesSection'), pSec = document.getElementById('paymentsSection');
  if (allRows.length > 0 && paymentsRows.length > 0) {
    sSec.style.display = 'block'; pSec.style.display = 'block';
    updateStaffFilter();
    const context = renderCombinedTable(allRows, paymentsRows);
    renderPaymentsTable(paymentsRows, context.visibleAccounts);
  } else {
    sSec.style.display = 'none'; pSec.style.display = 'none';
  }
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [], currentValue = '', insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i+1];
    if (char === '"' && insideQuotes && next === '"') { currentValue += '"'; i++; }
    else if (char === '"') insideQuotes = !insideQuotes;
    else if (char === ',' && !insideQuotes) { currentRow.push(currentValue); currentValue = ''; }
    else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentValue || currentRow.length) { currentRow.push(currentValue); rows.push(currentRow); currentRow = []; currentValue = ''; }
    } else currentValue += char;
  }
  if (currentValue || currentRow.length) { currentRow.push(currentValue); rows.push(currentRow); }
  return rows;
}

function updateStaffFilter() {
  const staffSet = new Set();
  const getStaff = (rows) => {
    if (rows.length > 0) {
      const idx = rows[0].indexOf("Staff");
      if (idx !== -1) rows.slice(1).forEach(r => { if (r[idx]) staffSet.add(r[idx]); });
    }
  };
  getStaff(allRows); getStaff(paymentsRows);
  const current = staffFilter.value;
  staffFilter.innerHTML = '<option value="">All Staff</option>';
  Array.from(staffSet).sort().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s.replace(/\s*\([^)]*\)/g, '');
    if (s === current) opt.selected = true;
    staffFilter.appendChild(opt);
  });
  staffFilter.disabled = staffSet.size === 0;
  staffFilter.onchange = () => {
    const context = renderCombinedTable(allRows, paymentsRows);
    renderPaymentsTable(paymentsRows, context.visibleAccounts);
  };
}

function renderCombinedTable(rows, extraPay) {
  const table = document.getElementById('csvTableCombined'); table.innerHTML = '';
  if (!rows.length) return { visibleAccounts: new Set() };
  const accIdx = rows[0].indexOf("Account"), staffIdx = rows[0].indexOf("Staff"), typeIdx = rows[0].indexOf("Type");
  const selectedStaff = staffFilter.value;
  const visibleAccounts = new Set();

  rows.slice(1).forEach(r => {
    let acc = (r[accIdx] || "").trim();
    if (r[typeIdx]?.toUpperCase() === 'VOID') acc = acc || "Unassigned Account";
    if (acc && (!selectedStaff || r[staffIdx] === selectedStaff)) visibleAccounts.add(acc);
  });

  const unfiltered = new Map(), ownSales = new Map(), othersSales = new Map(), voids = new Map();
  visibleAccounts.forEach(acc => {
    unfiltered.set(acc, getZeroObj()); ownSales.set(acc, getZeroObj()); othersSales.set(acc, getZeroObj()); voids.set(acc, 0);
  });

  rows.slice(1).forEach(r => {
    const isVoid = r[typeIdx]?.toUpperCase() === 'VOID';
    let acc = (r[accIdx] || "").trim();
    if (isVoid) acc = acc || "Unassigned Account";
    if (!acc || !visibleAccounts.has(acc)) return;
    if (isVoid) {
      if (!selectedStaff || r[staffIdx] === selectedStaff) voids.set(acc, voids.get(acc) + (parseFloat(r[rows[0].indexOf("FinalPrice")]) || 0));
      return;
    }
    columnsToDisplay.slice(1).forEach(col => {
      const val = parseFloat(r[rows[0].indexOf(csvColNames[col])]) || 0;
      unfiltered.get(acc)[col] += val;
      if (selectedStaff && r[staffIdx] === selectedStaff) ownSales.get(acc)[col] += val;
      else if (selectedStaff) othersSales.get(acc)[col] += val;
    });
  });

  let dayT = 0, ownT = 0, otherT = 0, vT = 0, ownCompT = 0;
  visibleAccounts.forEach(acc => {
    columnsToDisplay.slice(1).forEach(c => { dayT += unfiltered.get(acc)[c]; ownT += ownSales.get(acc)[c]; otherT += othersSales.get(acc)[c]; });
    vT += voids.get(acc); ownCompT += ownSales.get(acc)["Comp"];
  });
  if (totalSpans.ownPlusVoids) totalSpans.ownPlusVoids.textContent = selectedStaff ? formatNumber(ownT + vT - ownCompT) : "";

  const grps = [
    { name: 'Sales of the day', cols: columnsToDisplay.slice(1), total: dayT },
    { name: 'Own Sales', cols: columnsToDisplay.slice(1), total: ownT },
    { name: 'Made by others', cols: columnsToDisplay.slice(1), total: otherT },
    { name: 'Voids', cols: ['Final Price'], total: vT }
  ];

  const thead = document.createElement('thead'), hr1 = document.createElement('tr'), thA = document.createElement('th');
  thA.textContent = 'Account'; thA.rowSpan = 2; hr1.appendChild(thA);
  grps.forEach(g => { const th = document.createElement('th'); th.textContent = `${g.name}: ${formatNumber(g.total)}`; th.colSpan = g.cols.length; hr1.appendChild(th); });
  thead.appendChild(hr1);

  const hr2 = document.createElement('tr');
  grps.forEach((g, gi) => g.cols.forEach((c, ci) => {
    const th = document.createElement('th'); th.textContent = c; th.classList.add('highlight-col');
    if (ci === g.cols.length - 1 && gi !== grps.length - 1) th.classList.add('group-divider');
    hr2.appendChild(th);
  }));
  thead.appendChild(hr2); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const tTr = document.createElement('tr'); tTr.classList.add('totals-row');
  const tdL = document.createElement('td'); tdL.textContent = 'Grand Totals'; tTr.appendChild(tdL);
  
  let colTotals = {};
  grps.forEach(g => g.cols.forEach(c => {
    let sum = 0;
    visibleAccounts.forEach(acc => {
      if (g.name === 'Voids') sum += voids.get(acc);
      else if (g.name === 'Sales of the day') sum += unfiltered.get(acc)[c];
      else if (g.name === 'Own Sales') sum += ownSales.get(acc)[c];
      else sum += othersSales.get(acc)[c];
    });
    const td = document.createElement('td'); td.textContent = formatNumber(sum); td.classList.add('highlight-col');
    if (ci === g.cols.length - 1 && gi !== grps.length - 1) td.classList.add('group-divider');
    tTr.appendChild(td);
  }));
  tbody.appendChild(tTr);

  Array.from(visibleAccounts).sort().forEach(acc => {
    const tr = document.createElement('tr'); const tdAc = document.createElement('td'); tdAc.textContent = acc; tr.appendChild(tdAc);
    const renderBlk = (vals, gi, ca) => ca.forEach((c, ci) => {
      const td = document.createElement('td'); td.textContent = formatNumber(typeof vals === 'number' ? vals : vals[c]);
      td.classList.add('highlight-col'); if (ci === ca.length - 1 && gi !== grps.length - 1) td.classList.add('group-divider');
      tr.appendChild(td);
    });
    renderBlk(unfiltered.get(acc), 0, grps[0].cols); renderBlk(ownSales.get(acc), 1, grps[1].cols); renderBlk(othersSales.get(acc), 2, grps[2].cols); renderBlk(voids.get(acc), 3, grps[3].cols);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); return { visibleAccounts };
}

function renderPaymentsTable(rows, masterAccs) {
  const table = document.getElementById('csvTablePayments'); table.innerHTML = '';
  if (!rows.length || !masterAccs.size) return;
  const accCol = rows[0].indexOf("Account"), amtCol = rows[0].indexOf("Amount"), tipCol = rows[0].indexOf("Tip"), paidCol = rows[0].indexOf("Paid"), staffCol = rows[0].indexOf("Staff");
  const selected = staffFilter.value, ownMap = new Map(), othersMap = new Map();
  let gOwn = 0, gOther = 0;

  Array.from(masterAccs).sort().forEach(acc => { ownMap.set(acc, { a: 0, t: 0, p: 0 }); othersMap.set(acc, { a: 0, t: 0, p: 0 }); });

  rows.slice(1).forEach(r => {
    const acc = (r[accCol] || "").trim(); if (!acc || !ownMap.has(acc)) return;
    const amt = parseFloat(r[amtCol]) || 0, tip = tipCol !== -1 ? parseFloat(r[tipCol]) || 0 : 0, paid = paidCol !== -1 ? parseFloat(r[paidCol]) || 0 : 0;
    const isOwn = !selected || (staffCol !== -1 && r[staffCol] === selected);
    const target = isOwn ? ownMap : othersMap; const data = target.get(acc);
    data.a += amt; data.t += tip; data.p += paid;
    if (isOwn) gOwn += (amt + tip + paid); else gOther += (amt + tip + paid);
  });

  const thead = document.createElement('thead'), hr1 = document.createElement('tr'), thA = document.createElement('th');
  thA.textContent = 'Account'; thA.rowSpan = 2; hr1.appendChild(thA);
  const grps = [{ name: 'Own Payments', map: ownMap, total: gOwn }, { name: 'Payments by others', map: othersMap, total: gOther }];
  grps.forEach(g => { const th = document.createElement('th'); th.textContent = `${g.name}: ${formatNumber(g.total)}`; th.colSpan = 3; hr1.appendChild(th); });
  thead.appendChild(hr1);

  const hr2 = document.createElement('tr');
  grps.forEach((g, gi) => ['Amount', 'Tips', 'Paid'].forEach((sub, si) => {
    const th = document.createElement('th'); th.textContent = sub; if (si === 2 && gi === 0) th.classList.add('group-divider'); hr2.appendChild(th);
  }));
  thead.appendChild(hr2); table.appendChild(thead);

  const tbody = document.createElement('tbody'), tTr = document.createElement('tr');
  tTr.classList.add('totals-row'); const tdTL = document.createElement('td'); tdTL.textContent = 'Totals'; tTr.appendChild(tdTL);

  let totals = { oA: 0, oT: 0, oP: 0, tA: 0, tT: 0, tP: 0 };
  Array.from(masterAccs).forEach(acc => {
    const o = ownMap.get(acc), t = othersMap.get(acc);
    totals.oA += o.a; totals.oT += o.t; totals.oP += o.p; totals.tA += t.a; totals.tT += t.t; totals.tP += t.p;
  });
  [totals.oA, totals.oT, totals.oP, totals.tA, totals.tT, totals.tP].forEach((v, i) => {
    const td = document.createElement('td'); td.textContent = formatNumber(v); if (i === 2) td.classList.add('group-divider'); tTr.appendChild(td);
  });
  tbody.appendChild(tTr);

  Array.from(masterAccs).sort().forEach(acc => {
    const tr = document.createElement('tr'), tdAc = document.createElement('td'); tdAc.textContent = acc; tr.appendChild(tdAc);
    const o = ownMap.get(acc), t = othersMap.get(acc);
    [o.a, o.t, o.p, t.a, t.t, t.p].forEach((v, i) => {
      const td = document.createElement('td'); td.textContent = formatNumber(v); if (i === 2) td.classList.add('group-divider'); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

csvFileInput.addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { allRows = parseCSV(ev.target.result); checkFilesAndRender(); }; r.readAsText(f); });
paymentsCsvInput.addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { paymentsRows = parseCSV(ev.target.result); checkFilesAndRender(); }; r.readAsText(f); });

document.getElementById('clearCsv').onclick = () => {
  if (confirm("Are you sure you want to clear all data?")) {
    allRows = []; paymentsRows = []; csvFileInput.value = ''; paymentsCsvInput.value = '';
    staffFilter.innerHTML = '<option value="">All Staff</option>'; staffFilter.disabled = true;
    checkFilesAndRender();
  }
};

function exportTableToCSV(id, name) {
  const t = document.getElementById(id); if (!t || !t.rows.length) return;
  let c = []; const rs = t.querySelectorAll('tr');
  rs.forEach(r => {
    let rd = []; const cs = r.querySelectorAll('td, th');
    cs.forEach(col => { rd.push(`"${col.textContent.replace(/"/g, '""')}"`); let span = col.getAttribute('colspan'); if (span) for (let i = 1; i < parseInt(span); i++) rd.push('""'); });
    c.push(rd.join(','));
  });
  const b = new Blob([c.join('\n')], { type: 'text/csv' });
  const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = name; l.click();
}
