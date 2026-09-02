// Integer math throughout: levels in tenths, coefficients in hundredths,
// volforce in thousandths. The official formula then reduces to
// level * grade * clear * score / 5e10, truncated.
const SCALE = 5e10;

const GRADES = [
  { name: "D",    coeff:  80, low:       0, high: 6499999 },
  { name: "C",    coeff:  82, low: 6500000, high: 7499999 },
  { name: "B",    coeff:  85, low: 7500000, high: 8699999 },
  { name: "A",    coeff:  88, low: 8700000, high: 8999999 },
  { name: "A+",   coeff:  91, low: 9000000, high: 9299999 },
  { name: "AA",   coeff:  94, low: 9300000, high: 9499999 },
  { name: "AA+",  coeff:  97, low: 9500000, high: 9699999 },
  { name: "AAA",  coeff: 100, low: 9700000, high: 9799999 },
  { name: "AAA+", coeff: 102, low: 9800000, high: 9899999 },
  { name: "S",    coeff: 105, low: 9900000, high: 9999999 }, // 10M is PUC only
];

const CLEARS = [
  { name: "UC",  coeff: 106 },
  { name: "MAX", coeff: 104 },
  { name: "EXC", coeff: 102 },
  { name: "EFF", coeff: 100 },
];

const PUC = { score: 10000000, grade: 105, clear: 110 };

// exact ceil(a / b) for integers
function ceilDiv(a, b) {
  const q = Math.floor(a / b);
  return q * b < a ? q + 1 : q;
}

function songVolforce(level, grade, clear, score) {
  return Math.floor(level * grade * clear * score / SCALE);
}

// Grades are lowest-first, so the first tier that fits is the minimum.
function minScore(level, clear, needed) {
  for (const g of GRADES) {
    const score = Math.max(g.low, ceilDiv(needed * SCALE, level * g.coeff * clear));
    if (score <= g.high) return score;
  }
  return null;
}

function pucReaches(level, needed) {
  return songVolforce(level, PUC.grade, PUC.clear, PUC.score) >= needed;
}

// first three digits, rounded to nearest
function fmtScore(score) {
  return score === null ? "❌" : String(Math.round(score / 10000));
}

// 17 only has a .5; 18+ have every tenth
function levelGroups() {
  const groups = [];
  for (let l = 20; l >= 18; l--) {
    groups.push({ level: l * 10, subs: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => l * 10 + t) });
  }
  groups.push({ level: 170, subs: [175] });
  for (let l = 16; l >= 1; l--) groups.push({ level: l * 10, subs: [] });
  return groups;
}

function makeRow(level, needed, { sub = false, expandable = false } = {}) {
  const tr = document.createElement("tr");
  if (sub) tr.classList.add("sub");
  if (expandable) tr.classList.add("expandable");

  const cells = [
    sub ? (level / 10).toFixed(1) : String(level / 10),
    pucReaches(level, needed) ? "✅" : "❌",
    ...CLEARS.map((c) => fmtScore(minScore(level, c.coeff, needed))),
  ];
  for (const text of cells) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }
  return tr;
}

function render() {
  const tbody = document.querySelector("#results tbody");
  const perSongEl = document.getElementById("perSong");
  tbody.innerHTML = "";

  const target = parseFloat(document.getElementById("target").value);
  if (isNaN(target) || target < 0) {
    perSongEl.textContent = "";
    return;
  }

  const needed = ceilDiv(Math.round(target * 1000), 50); // per song, over the best 50
  perSongEl.innerHTML =
    "Per-song volforce needed: <strong>" + (needed / 1000).toFixed(3) +
    "</strong> (target ÷ 50, rounded up to the nearest 0.001)";

  for (const group of levelGroups()) {
    const parent = makeRow(group.level, needed, { expandable: group.subs.length > 0 });
    tbody.appendChild(parent);
    if (group.subs.length === 0) continue;

    const subRows = group.subs.map((l) => makeRow(l, needed, { sub: true }));
    for (const r of subRows) tbody.appendChild(r);
    parent.addEventListener("click", () => {
      parent.classList.toggle("expanded");
      for (const r of subRows) r.classList.toggle("shown");
    });
  }
}

document.getElementById("calc").addEventListener("click", render);
document.getElementById("target").addEventListener("keydown", (e) => {
  if (e.key === "Enter") render();
});
render();
