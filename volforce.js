// Grade tiers, sorted from highest to lowest.
const GRADES = [
  { name: "S",    coeff: 1.05, low: 9900000, high: 9999999 },
  { name: "AAA+", coeff: 1.02, low: 9800000, high: 9899999 },
  { name: "AAA",  coeff: 1.00, low: 9700000, high: 9799999 },
  { name: "AA+",  coeff: 0.97, low: 9500000, high: 9699999 },
  { name: "AA",   coeff: 0.94, low: 9300000, high: 9499999 },
  { name: "A+",   coeff: 0.91, low: 9000000, high: 9299999 },
  { name: "A",    coeff: 0.88, low: 8700000, high: 8999999 },
  { name: "B",    coeff: 0.85, low: 7500000, high: 8699999 },
  { name: "C",    coeff: 0.82, low: 6500000, high: 7499999 },
  { name: "D",    coeff: 0.80, low:       0, high: 6499999 },
];

const CLEAR_PUC = 1.10;
const CLEAR_UC  = 1.06;
const CLEAR_MAX = 1.04;
const CLEAR_EXC = 1.02;
const CLEAR_EFF = 1.00;
const CLEAR_CRA = 0.50;

const MAX_NON_PUC_SCORE = 9999999; // a 10,000,000 score is always a PUC

// Per-song volforce, using the official formula and truncating to thousandths.
function songVolforce(level, score, gradeCoeff, clearCoeff) {
  const raw = (level * (score / 10000000) * gradeCoeff * clearCoeff * 20) * 0.001;
  return Math.floor(raw * 1000 + 1e-9) / 1000;
}

// Smallest per-song VF that, summed across 50 songs, reaches the target.
// Truncated VF is always a multiple of 0.001, so we round target/50 up to it.
function perSongVolforceNeeded(target) {
  return Math.ceil(target * 20 - 1e-9) / 1000;
}

// Invert songVolforce algebraically:
//   songVF = level * (score / 10000000) * gradeCoeff * clearCoeff * 20 * 0.001
//   score  = songVF * 10000000 / (level * gradeCoeff * clearCoeff * 20 * 0.001)
function scoreForVolforce(songVF, level, gradeCoeff, clearCoeff) {
  return songVF * 10000000 / (level * gradeCoeff * clearCoeff * 20 * 0.001);
}

// Smallest score in [low, high] whose 50-song total reaches `target`.
// Returns null if even the highest score in the range falls short.
function findMinScoreInTier(level, gradeCoeff, clearCoeff, low, high, target) {
  const needed = perSongVolforceNeeded(target);
  const minScore = Math.ceil(
    scoreForVolforce(needed, level, gradeCoeff, clearCoeff) - 1e-9
  );
  if (minScore > high) return null;
  return Math.max(minScore, low);
}

// Smallest non-PUC score across all grade tiers that reaches the target.
function findMinScoreNonPuc(level, clearCoeff, target) {
  let best = null;
  for (const g of GRADES) {
    const high = Math.min(g.high, MAX_NON_PUC_SCORE);
    if (g.low > high) continue;
    const min = findMinScoreInTier(level, g.coeff, clearCoeff, g.low, high, target);
    if (min !== null && (best === null || min < best)) {
      best = min;
    }
  }
  return best;
}

// PUC always uses score = 10,000,000, S grade (1.05), clear coeff 1.10.
function pucReachable(level, target) {
  return songVolforce(level, 10000000, 1.05, CLEAR_PUC) * 50 + 1e-9 >= target;
}

// Builds the list of rows to render, ordered top-to-bottom (20 -> 1).
// Parent rows (17-20) carry X.0 data and an expandable sub-list of X.1+.
function buildLevels() {
  const groups = [];

  for (let base = 20; base >= 18; base--) {
    const subs = [];
    for (let t = 1; t <= 9; t++) {
      subs.push(Math.round((base + t / 10) * 10) / 10);
    }
    groups.push({ level: base, label: String(base), expandable: true, subs });
  }

  groups.push({ level: 17, label: "17", expandable: true, subs: [17.5] });

  for (let i = 16; i >= 1; i--) {
    groups.push({ level: i, label: String(i), expandable: false });
  }

  return groups;
}

function fmtScoreCell(level, clearCoeff, target) {
  const min = findMinScoreNonPuc(level, clearCoeff, target);
  if (min === null) return "❌";
  // Display the first three digits of the score (score / 10,000, rounded up).
  return String(Math.ceil(min / 10000));
}

function fmtPucCell(level, target) {
  return pucReachable(level, target) ? "✅" : "❌";
}

function makeRow(level, label, target, { isSub = false, expandable = false } = {}) {
  const tr = document.createElement("tr");
  if (isSub) tr.classList.add("sub");
  if (expandable) tr.classList.add("expandable");

  const cells = [
    label,
    fmtPucCell(level, target),
    fmtScoreCell(level, CLEAR_UC,  target),
    fmtScoreCell(level, CLEAR_MAX, target),
    fmtScoreCell(level, CLEAR_EXC, target),
    fmtScoreCell(level, CLEAR_EFF, target),
    fmtScoreCell(level, CLEAR_CRA, target),
  ];
  for (const c of cells) {
    const td = document.createElement("td");
    td.textContent = c;
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
  perSongEl.innerHTML =
    "Per-song volforce needed: <strong>" + (target / 50).toFixed(4) +
    "</strong> (target / 50)";

  const groups = buildLevels();
  for (const lvl of groups) {
    if (!lvl.expandable) {
      tbody.appendChild(makeRow(lvl.level, lvl.label, target));
      continue;
    }
    const parentTr = makeRow(lvl.level, lvl.label, target, { expandable: true });
    tbody.appendChild(parentTr);

    const subRows = [];
    for (const sub of lvl.subs) {
      const subTr = makeRow(sub, sub.toFixed(1), target, { isSub: true });
      tbody.appendChild(subTr);
      subRows.push(subTr);
    }
    parentTr.addEventListener("click", () => {
      parentTr.classList.toggle("expanded");
      for (const r of subRows) r.classList.toggle("shown");
    });
  }
}

document.getElementById("calc").addEventListener("click", render);
document.getElementById("target").addEventListener("keydown", (e) => {
  if (e.key === "Enter") render();
});
render();
