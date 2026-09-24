// Generates 550 mathematical/calculation textile-engineering MCQs with
// solutions, computed directly from real formulas (never hand-typed), and
// emits a single SQL file ready to run against qb_questions.
'use strict';
const fs = require('fs');

// ---------- deterministic RNG (reproducible run-to-run) ----------
let seed = 20260924;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function round(x, d = 2) {
  const f = Math.pow(10, d);
  return Math.round((x + Number.EPSILON) * f) / f;
}
function fmt(x, d = 2) {
  const r = round(x, d);
  return Number.isInteger(r) && d === 0 ? String(r) : r.toFixed(d);
}

const SUBJECTS = {
  fabric: '22222222-2222-2222-2222-222222222222',
  yarn: '11111111-1111-1111-1111-111111111111',
  apparel: '44444444-4444-4444-4444-444444444444',
  dyeing: '9e3b3072-3153-414d-b2d7-1bf0789002ac',
};

const NE_SET = Array.from({ length: 97 }, (_, i) => i + 4); // 4s to 100s Ne, every count

// ---------- MCQ assembly ----------
function makeOptions(correctVal, wrongVals, d) {
  const correct = fmt(correctVal, d);
  const seen = new Set([correct]);
  const opts = [correct];
  for (const w of wrongVals) {
    const s = fmt(w, d);
    if (!seen.has(s)) { seen.add(s); opts.push(s); }
    if (opts.length === 4) break;
  }
  // top up if any collided away
  let bump = 1;
  while (opts.length < 4) {
    const s = fmt(correctVal * (1 + 0.05 * bump) + bump, d);
    if (!seen.has(s)) { seen.add(s); opts.push(s); }
    bump++;
  }
  // shuffle
  for (let i = opts.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return { options: opts, correct_answer: correct };
}

const Q = []; // { subject, difficulty, points, question_text, options, correct_answer, explanation, tags }

function diffFor(i, n) {
  // ~40% basic, 35% intermediate, 25% advanced
  const r = i / n;
  if (r < 0.40) return { difficulty: 'basic', points: 1 };
  if (r < 0.75) return { difficulty: 'intermediate', points: 2 };
  return { difficulty: 'advanced', points: 3 };
}

function push(subject, i, n, text, correctVal, wrongVals, d, explanation, tag) {
  const { difficulty, points } = diffFor(i, n);
  const { options, correct_answer } = makeOptions(correctVal, wrongVals, d);
  Q.push({ subject, difficulty, points, question_text: text, options, correct_answer, explanation, tags: ['math', 'calculation', tag] });
}

// =====================================================================
// YARN -- 10 templates x 15 = 150
// =====================================================================
(function yarn() {
  const sub = SUBJECTS.yarn;
  const per = 15;
  let i = 0;

  // T1: Ne -> Tex
  for (let k = 0; k < per; k++, i++) {
    const Ne = pick(NE_SET);
    const ans = 590.5 / Ne;
    push(sub, i, 150,
      `A cotton yarn has an English count of ${Ne}s Ne. What is its count in Tex (Tex = 590.5 / Ne)?`,
      ans, [Ne * 590.5 / 1000, ans * 1.1, 1000 / Ne, ans * 0.9], 2,
      `Tex = 590.5 / Ne = 590.5 / ${Ne} = ${fmt(ans, 2)} tex.`, 'yarn-count-conversion');
  }
  // T2: Tex -> Ne
  for (let k = 0; k < per; k++, i++) {
    const Tex = round(randInt(80, 1400) / 10, 1);
    const ans = 590.5 / Tex;
    push(sub, i, 150,
      `A yarn has a linear density of ${Tex} Tex. What is its equivalent English cotton count (Ne = 590.5 / Tex)?`,
      ans, [Tex / 590.5, ans * 1.15, ans * 0.85, 1000 / Tex], 2,
      `Ne = 590.5 / Tex = 590.5 / ${Tex} = ${fmt(ans, 2)} Ne.`, 'yarn-count-conversion');
  }
  // T3: Ne -> Denier
  for (let k = 0; k < per; k++, i++) {
    const Ne = pick(NE_SET);
    const ans = 5315 / Ne;
    push(sub, i, 150,
      `Find the Denier of a yarn whose English count is ${Ne}s Ne (Denier = 5315 / Ne).`,
      ans, [Ne * 5315 / 1000, ans * 1.1, ans * 0.9, 5315 * Ne], 2,
      `Denier = 5315 / Ne = 5315 / ${Ne} = ${fmt(ans, 2)} denier.`, 'yarn-count-conversion');
  }
  // T4: Denier -> Ne
  for (let k = 0; k < per; k++, i++) {
    const De = randInt(40, 4000);
    const ans = 5315 / De;
    push(sub, i, 150,
      `A filament yarn is ${De} denier. What is its equivalent English cotton count (Ne = 5315 / Denier)?`,
      ans, [De / 5315, ans * 1.2, ans * 0.8, 5315 * De / 1000], 2,
      `Ne = 5315 / Denier = 5315 / ${De} = ${fmt(ans, 2)} Ne.`, 'yarn-count-conversion');
  }
  // T5: Tex -> Denier
  for (let k = 0; k < per; k++, i++) {
    const Tex = randInt(8, 150);
    const ans = 9 * Tex;
    push(sub, i, 150,
      `Convert ${Tex} Tex into Denier (Denier = 9 x Tex).`,
      ans, [Tex / 9, ans + 10, ans - 10, ans * 1.1], 1,
      `Denier = 9 x Tex = 9 x ${Tex} = ${fmt(ans, 1)} denier.`, 'yarn-count-conversion');
  }
  // T6: Denier -> Tex
  for (let k = 0; k < per; k++, i++) {
    const De = randInt(40, 900);
    const ans = De / 9;
    push(sub, i, 150,
      `Convert ${De} Denier into Tex (Tex = Denier / 9).`,
      ans, [De * 9, ans + 5, ans - 5, ans * 1.2], 2,
      `Tex = Denier / 9 = ${De} / 9 = ${fmt(ans, 2)} tex.`, 'yarn-count-conversion');
  }
  // T7: TPI from TM & Ne
  for (let k = 0; k < per; k++, i++) {
    const Ne = pick(NE_SET);
    const TM = round(randInt(280, 480) / 10, 1);
    const ans = TM * Math.sqrt(Ne);
    push(sub, i, 150,
      `A ${Ne}s Ne cotton yarn is spun with a twist multiplier (TM) of ${TM}. Find the twist per inch (TPI = TM x sqrt(Ne)).`,
      ans, [TM * Ne, ans * 1.15, ans * 0.85, TM + Math.sqrt(Ne)], 2,
      `TPI = TM x sqrt(Ne) = ${TM} x sqrt(${Ne}) = ${TM} x ${fmt(Math.sqrt(Ne), 3)} = ${fmt(ans, 2)} turns/inch.`, 'yarn-twist');
  }
  // T8: TM from TPI & Ne
  for (let k = 0; k < per; k++, i++) {
    const Ne = pick(NE_SET);
    const TPI = randInt(12, 30);
    const ans = TPI / Math.sqrt(Ne);
    push(sub, i, 150,
      `A ${Ne}s Ne yarn has ${TPI} turns per inch (TPI). Find its twist multiplier (TM = TPI / sqrt(Ne)).`,
      ans, [TPI * Math.sqrt(Ne), ans * 1.2, ans * 0.8, TPI / Ne], 2,
      `TM = TPI / sqrt(Ne) = ${TPI} / sqrt(${Ne}) = ${TPI} / ${fmt(Math.sqrt(Ne), 3)} = ${fmt(ans, 2)}.`, 'yarn-twist');
  }
  // T9: Resultant count of 2-ply yarn (Ne system)
  for (let k = 0; k < per; k++, i++) {
    const N1 = pick(NE_SET);
    const N2 = pick(NE_SET);
    const ans = (N1 * N2) / (N1 + N2);
    push(sub, i, 150,
      `Two single yarns of ${N1}s Ne and ${N2}s Ne are twisted together. Find the resultant count of the doubled yarn (1/Nr = 1/N1 + 1/N2).`,
      ans, [(N1 + N2) / 2, N1 + N2, ans * 1.15, ans * 0.85], 2,
      `1/Nr = 1/N1 + 1/N2 = 1/${N1} + 1/${N2}, so Nr = (N1 x N2)/(N1 + N2) = (${N1} x ${N2})/(${N1} + ${N2}) = ${fmt(ans, 2)}s Ne.`, 'yarn-count-conversion');
  }
  // T10: Count from hank length & weight
  for (let k = 0; k < per; k++, i++) {
    const lengthYd = randInt(2, 10) * 840; // whole hanks
    const hanks = lengthYd / 840;
    const weightLb = round(randInt(2, 20) / 10, 1);
    const ans = hanks / weightLb;
    push(sub, i, 150,
      `A bundle of cotton yarn measuring ${lengthYd} yards weighs ${weightLb} lb. Find its English count (Ne = number of 840-yard hanks / weight in lb).`,
      ans, [weightLb / hanks, ans * 1.2, ans * 0.8, lengthYd / weightLb], 2,
      `Hanks = ${lengthYd} / 840 = ${fmt(hanks, 0)}. Ne = Hanks / Weight(lb) = ${fmt(hanks, 0)} / ${weightLb} = ${fmt(ans, 2)}s Ne.`, 'yarn-count-conversion');
  }
})();

// =====================================================================
// FABRIC -- 10 templates x 20 = 200
// =====================================================================
(function fabric() {
  const sub = SUBJECTS.fabric;
  const per = 20;
  let i = 0;
  const K = 1.4715; // standard Ne-system GSM approximation constant

  // F1: GSM from EPI, PPI, warp/weft Ne
  for (let k = 0; k < per; k++, i++) {
    const EPI = randInt(40, 120);
    const PPI = randInt(40, 100);
    const Nw = pick(NE_SET);
    const Nf = pick(NE_SET);
    const ans = ((EPI / Nw) + (PPI / Nf)) * K;
    push(sub, i, 200,
      `A woven fabric has EPI = ${EPI}, PPI = ${PPI}, warp count = ${Nw}s Ne and weft count = ${Nf}s Ne. Estimate the fabric weight in GSM using GSM = [(EPI/Ne_warp) + (PPI/Ne_weft)] x 1.4715.`,
      ans, [ans * 1.15, ans * 0.85, (EPI + PPI) * K, ans + 20], 1,
      `GSM = [(${EPI}/${Nw}) + (${PPI}/${Nf})] x 1.4715 = [${fmt(EPI / Nw, 3)} + ${fmt(PPI / Nf, 3)}] x 1.4715 = ${fmt(EPI / Nw + PPI / Nf, 3)} x 1.4715 = ${fmt(ans, 1)} g/m².`, 'fabric-gsm');
  }
  // F2: Fabric weight (kg) from GSM, width, length
  for (let k = 0; k < per; k++, i++) {
    const GSM = randInt(100, 300);
    const width = round(randInt(10, 20) / 10, 1);
    const length = randInt(50, 500);
    const ans = (GSM * width * length) / 1000;
    push(sub, i, 200,
      `A fabric roll is ${length} m long and ${width} m wide, with a fabric weight of ${GSM} GSM. Find the total weight of the roll in kg (Weight = GSM x Width x Length / 1000).`,
      ans, [ans * 1.2, ans * 0.8, GSM * width * length, ans + 5], 2,
      `Weight = GSM x Width x Length / 1000 = ${GSM} x ${width} x ${length} / 1000 = ${fmt(ans, 2)} kg.`, 'fabric-weight');
  }
  // F3: Fabric cost
  for (let k = 0; k < per; k++, i++) {
    const weightKg = round(randInt(50, 500) / 10, 1);
    const price = randInt(280, 650);
    const ans = weightKg * price;
    push(sub, i, 200,
      `A buyer orders ${weightKg} kg of fabric at a price of ৳${price} per kg. What is the total fabric cost?`,
      ans, [ans * 1.1, ans * 0.9, weightKg + price, ans + 500], 0,
      `Total cost = Weight x Price/kg = ${weightKg} x ${price} = ৳${fmt(ans, 0)}.`, 'fabric-costing');
  }
  // F4: EPI from reed count & denting
  for (let k = 0; k < per; k++, i++) {
    const reed = randInt(35, 220);
    const denting = pick([2, 3, 4]);
    const ans = reed * denting;
    push(sub, i, 200,
      `A loom is set with reed count ${reed} and denting order of ${denting} ends per dent. Find the ends per inch (EPI = Reed count x Denting).`,
      ans, [reed / denting, ans + 8, ans - 8, reed + denting], 0,
      `EPI = Reed count x Denting = ${reed} x ${denting} = ${ans}.`, 'fabric-construction');
  }
  // F5: Total warp ends
  for (let k = 0; k < per; k++, i++) {
    const EPI = randInt(50, 110);
    const widthIn = pick([40, 44, 48, 52, 56, 60, 63, 72]);
    const ans = EPI * widthIn;
    push(sub, i, 200,
      `A fabric has ${EPI} EPI and a loom width of ${widthIn} inches. Find the total number of warp ends required (Total ends = EPI x Width).`,
      ans, [EPI + widthIn, ans + 100, ans - 100, EPI * widthIn / 2], 0,
      `Total ends = EPI x Width(inch) = ${EPI} x ${widthIn} = ${ans} ends.`, 'fabric-construction');
  }
  // F6: GSM -> oz/yd^2
  for (let k = 0; k < per; k++, i++) {
    const GSM = randInt(100, 350);
    const ans = GSM / 33.9;
    push(sub, i, 200,
      `Convert a fabric weight of ${GSM} GSM into ounces per square yard (1 oz/yd² ≈ 33.9 g/m²).`,
      ans, [GSM * 33.9, ans * 1.15, ans * 0.85, GSM / 28.3], 2,
      `oz/yd² = GSM / 33.9 = ${GSM} / 33.9 = ${fmt(ans, 2)} oz/yd².`, 'fabric-gsm');
  }
  // F7: oz/yd^2 -> GSM
  for (let k = 0; k < per; k++, i++) {
    const oz = round(randInt(300, 1200) / 100, 2);
    const ans = oz * 33.9;
    push(sub, i, 200,
      `A fabric is specified as ${oz} oz/yd². Convert this to GSM (GSM = oz/yd² x 33.9).`,
      ans, [oz / 33.9, ans + 15, ans - 15, oz * 28.3], 1,
      `GSM = oz/yd² x 33.9 = ${oz} x 33.9 = ${fmt(ans, 1)} g/m².`, 'fabric-gsm');
  }
  // F8: Warp cover factor
  for (let k = 0; k < per; k++, i++) {
    const EPI = randInt(50, 110);
    const Nw = pick(NE_SET);
    const ans = EPI / Math.sqrt(Nw);
    push(sub, i, 200,
      `A fabric has EPI = ${EPI} and warp count = ${Nw}s Ne. Find the warp cover factor (CF = EPI / sqrt(Ne)).`,
      ans, [EPI * Math.sqrt(Nw), ans * 1.2, ans * 0.8, EPI / Nw], 2,
      `Warp CF = EPI / sqrt(Ne) = ${EPI} / sqrt(${Nw}) = ${EPI} / ${fmt(Math.sqrt(Nw), 3)} = ${fmt(ans, 2)}.`, 'fabric-construction');
  }
  // F9: Shrinkage %
  for (let k = 0; k < per; k++, i++) {
    const L0 = randInt(100, 200);
    const shrinkPct = round(randInt(20, 90) / 10, 1);
    const L1 = round(L0 * (1 - shrinkPct / 100), 1);
    const ans = ((L0 - L1) / L0) * 100;
    push(sub, i, 200,
      `A fabric sample measuring ${L0} cm shrinks to ${L1} cm after washing. Find the shrinkage percentage (Shrinkage% = (L0 - L1)/L0 x 100).`,
      ans, [(L1 / L0) * 100, ans + 2, ans - 2, ((L0 - L1) / L1) * 100], 2,
      `Shrinkage% = (${L0} - ${L1}) / ${L0} x 100 = ${fmt(L0 - L1, 1)} / ${L0} x 100 = ${fmt(ans, 2)}%.`, 'fabric-shrinkage');
  }
  // F10: Total fabric weight for N rolls
  for (let k = 0; k < per; k++, i++) {
    const GSM = randInt(120, 280);
    const width = round(randInt(12, 18) / 10, 1);
    const length = randInt(80, 300);
    const rolls = randInt(3, 12);
    const ans = (rolls * GSM * width * length) / 1000;
    push(sub, i, 200,
      `A dyeing unit needs ${rolls} rolls of fabric, each ${length} m long and ${width} m wide, at ${GSM} GSM. Find the total fabric weight required in kg.`,
      ans, [ans / rolls, ans * 1.15, ans * 0.85, ans + 30], 2,
      `Weight per roll = GSM x Width x Length / 1000 = ${GSM} x ${width} x ${length} / 1000 = ${fmt((GSM * width * length) / 1000, 2)} kg. Total = ${fmt((GSM * width * length) / 1000, 2)} x ${rolls} = ${fmt(ans, 2)} kg.`, 'fabric-weight');
  }
})();

// =====================================================================
// APPAREL & MANAGEMENT -- 10 templates x 10 = 100
// =====================================================================
(function apparel() {
  const sub = SUBJECTS.apparel;
  const per = 10;
  let i = 0;

  // A1: Line output from SAM & efficiency
  for (let k = 0; k < per; k++, i++) {
    const workMin = pick([420, 450, 480, 500, 540]);
    const eff = randInt(50, 85);
    const SAM = round(randInt(80, 300) / 10, 1);
    const ans = (workMin * (eff / 100)) / SAM;
    push(sub, i, 100,
      `A sewing line works ${workMin} minutes with ${eff}% line efficiency, producing a garment with SAM = ${SAM} minutes. Find the expected output (pcs = Working min x Efficiency% / SAM).`,
      ans, [workMin / SAM, ans * 1.2, ans * 0.8, (workMin * eff) / SAM], 0,
      `Output = (Working min x Efficiency%) / SAM = (${workMin} x ${eff}%) / ${SAM} = ${fmt(workMin * eff / 100, 1)} / ${SAM} = ${fmt(ans, 0)} pcs.`, 'apparel-line-output');
  }
  // A2: Line efficiency %
  for (let k = 0; k < per; k++, i++) {
    const output = randInt(200, 900);
    const SAM = round(randInt(80, 250) / 10, 1);
    const totalMin = randInt(400, 550);
    const ans = ((output * SAM) / totalMin) * 100;
    push(sub, i, 100,
      `A line produced ${output} pieces of a garment with SAM = ${SAM} minutes, in ${totalMin} total working minutes. Find the line efficiency % (Efficiency% = (Output x SAM)/Total minutes x 100).`,
      ans, [ans / 2, ans * 1.15, ans * 0.85, (output / SAM) * 100 / totalMin], 2,
      `Efficiency% = (Output x SAM)/Total minutes x 100 = (${output} x ${SAM}) / ${totalMin} x 100 = ${fmt(output * SAM, 1)} / ${totalMin} x 100 = ${fmt(ans, 2)}%.`, 'apparel-efficiency');
  }
  // A3: Marker efficiency %
  for (let k = 0; k < per; k++, i++) {
    const patternArea = round(randInt(150, 400) / 10, 1);
    const markerArea = round(patternArea * (1 + randInt(10, 40) / 100), 1);
    const ans = (patternArea / markerArea) * 100;
    push(sub, i, 100,
      `A marker has a total area of ${markerArea} m², and the total pattern piece area on it is ${patternArea} m². Find the marker efficiency % (Marker efficiency = Pattern area / Marker area x 100).`,
      ans, [(markerArea / patternArea) * 100, ans + 5, ans - 5, ans * 0.9], 2,
      `Marker efficiency% = (${patternArea} / ${markerArea}) x 100 = ${fmt(ans, 2)}%.`, 'apparel-marker');
  }
  // A4: Fabric wastage %
  for (let k = 0; k < per; k++, i++) {
    const issued = randInt(500, 2000);
    const used = issued - randInt(20, 150);
    const ans = ((issued - used) / issued) * 100;
    push(sub, i, 100,
      `A cutting section was issued ${issued} m of fabric and actually used ${used} m. Find the fabric wastage % (Wastage% = (Issued - Used)/Issued x 100).`,
      ans, [((issued - used) / used) * 100, ans + 1, ans - 1, ans * 1.5], 2,
      `Wastage% = (${issued} - ${used}) / ${issued} x 100 = ${issued - used} / ${issued} x 100 = ${fmt(ans, 2)}%.`, 'apparel-wastage');
  }
  // A5: Selling price from cost + margin
  for (let k = 0; k < per; k++, i++) {
    const cp = randInt(150, 600);
    const margin = randInt(10, 40);
    const ans = cp * (1 + margin / 100);
    push(sub, i, 100,
      `The cost price of a garment is ৳${cp}, and the factory wants a profit margin of ${margin}%. Find the selling price (SP = CP x (1 + margin%)).`,
      ans, [cp * (margin / 100), ans + 20, ans - 20, cp + margin], 2,
      `SP = CP x (1 + margin%) = ${cp} x (1 + ${margin}/100) = ${cp} x ${fmt(1 + margin / 100, 2)} = ৳${fmt(ans, 2)}.`, 'apparel-costing');
  }
  // A6: CM per piece
  for (let k = 0; k < per; k++, i++) {
    const totalLabor = randInt(50000, 300000);
    const pieces = randInt(1000, 6000);
    const ans = totalLabor / pieces;
    push(sub, i, 100,
      `A factory spends ৳${totalLabor} in total labor cost to produce ${pieces} pieces of a garment. Find the CM (cost of making) per piece.`,
      ans, [totalLabor * pieces, ans * 1.2, ans * 0.8, ans + 5], 2,
      `CM/piece = Total labor cost / Pieces produced = ${totalLabor} / ${pieces} = ৳${fmt(ans, 2)}.`, 'apparel-costing');
  }
  // A7: Total garments from a lay
  for (let k = 0; k < per; k++, i++) {
    const plies = randInt(40, 150);
    const perMarker = randInt(2, 8);
    const ans = plies * perMarker;
    push(sub, i, 100,
      `A cutting lay has ${plies} plies of fabric, and the marker contains ${perMarker} garments per layer. Find the total number of garments cut from this lay.`,
      ans, [plies + perMarker, ans + 10, ans - 10, plies / perMarker], 0,
      `Total garments = Plies x Garments per marker = ${plies} x ${perMarker} = ${ans} pieces.`, 'apparel-cutting');
  }
  // A8: Man-hours
  for (let k = 0; k < per; k++, i++) {
    const workers = randInt(15, 60);
    const hrs = randInt(8, 10);
    const days = randInt(20, 26);
    const ans = workers * hrs * days;
    push(sub, i, 100,
      `A sewing line has ${workers} workers, each working ${hrs} hours a day for ${days} days in a month. Find the total man-hours for the month.`,
      ans, [workers * hrs + days, ans + 50, ans - 50, workers + hrs + days], 0,
      `Man-hours = Workers x Hours/day x Days = ${workers} x ${hrs} x ${days} = ${ans} man-hours.`, 'apparel-planning');
  }
  // A9: Fabric requirement from consumption/dozen
  for (let k = 0; k < per; k++, i++) {
    const perDozen = round(randInt(150, 400) / 10, 1);
    const orderQty = pick([600, 1200, 2400, 3600, 6000, 12000]);
    const ans = perDozen * (orderQty / 12);
    push(sub, i, 100,
      `A garment style has a fabric consumption of ${perDozen} m per dozen. For an order quantity of ${orderQty} pieces, find the total fabric required in meters.`,
      ans, [perDozen * orderQty, ans + 100, ans - 100, perDozen / (orderQty / 12)], 1,
      `Dozens = ${orderQty} / 12 = ${fmt(orderQty / 12, 0)}. Total fabric = Consumption/dozen x Dozens = ${perDozen} x ${fmt(orderQty / 12, 0)} = ${fmt(ans, 1)} m.`, 'apparel-consumption');
  }
  // A10: Total profit
  for (let k = 0; k < per; k++, i++) {
    const cp = randInt(150, 500);
    const sp = cp + randInt(30, 150);
    const qty = pick([500, 1000, 2000, 5000, 10000]);
    const ans = (sp - cp) * qty;
    push(sub, i, 100,
      `A garment costs ৳${cp} to produce and sells for ৳${sp}. For an order of ${qty} pieces, find the total profit.`,
      ans, [(sp + cp) * qty, ans + 1000, ans - 1000, (sp - cp) / qty], 0,
      `Profit per piece = SP - CP = ${sp} - ${cp} = ৳${sp - cp}. Total profit = ${sp - cp} x ${qty} = ৳${fmt(ans, 0)}.`, 'apparel-costing');
  }
})();

// =====================================================================
// DYEING & FINISHING -- 10 templates x 10 = 100
// =====================================================================
(function dyeing() {
  const sub = SUBJECTS.dyeing;
  const per = 10;
  let i = 0;

  // D1: Dye required from shade %
  for (let k = 0; k < per; k++, i++) {
    const shadePct = round(randInt(5, 40) / 10, 1);
    const fabricKg = randInt(50, 500);
    const ans = (shadePct * fabricKg * 1000) / 100;
    push(sub, i, 100,
      `A shade of ${shadePct}% is required for ${fabricKg} kg of fabric. Find the amount of dye required in grams (Dye(g) = Shade% x Fabric weight(kg) x 1000 / 100).`,
      ans, [ans / 10, ans * 1.2, ans * 0.8, shadePct * fabricKg], 0,
      `Dye required = Shade% x Fabric weight(kg) x 1000 / 100 = ${shadePct} x ${fabricKg} x 1000 / 100 = ${fmt(ans, 0)} g.`, 'dyeing-recipe');
  }
  // D2: Liquor volume
  for (let k = 0; k < per; k++, i++) {
    const fabricKg = randInt(20, 300);
    const ml = pick([1, 1.5, 2, 4, 6, 8, 10, 15, 20]);
    const ans = fabricKg * ml;
    push(sub, i, 100,
      `A dyeing machine uses a liquor ratio (M:L) of 1:${ml} for ${fabricKg} kg of fabric. Find the total liquor volume required in litres.`,
      ans, [fabricKg / ml, ans + 20, ans - 20, fabricKg + ml], 0,
      `Liquor volume = Fabric weight(kg) x M:L = ${fabricKg} x ${ml} = ${fmt(ans, 0)} L.`, 'dyeing-liquor-ratio');
  }
  // D3: Chemical dosage total
  for (let k = 0; k < per; k++, i++) {
    const dosage = round(randInt(5, 50) / 10, 1);
    const liquorL = randInt(200, 3000);
    const ans = dosage * liquorL;
    push(sub, i, 100,
      `A dye recipe calls for a chemical dosage of ${dosage} g/L, and the dye bath has ${liquorL} L of liquor. Find the total chemical quantity required in grams.`,
      ans, [liquorL / dosage, ans + 100, ans - 100, dosage + liquorL], 1,
      `Total chemical = Dosage(g/L) x Liquor volume(L) = ${dosage} x ${liquorL} = ${fmt(ans, 1)} g.`, 'dyeing-recipe');
  }
  // D4: Dye cost
  for (let k = 0; k < per; k++, i++) {
    const dyeKg = round(randInt(5, 100) / 10, 1);
    const price = randInt(800, 3500);
    const ans = dyeKg * price;
    push(sub, i, 100,
      `A batch requires ${dyeKg} kg of reactive dye at ৳${price} per kg. Find the total dye cost.`,
      ans, [dyeKg + price, ans + 500, ans - 500, dyeKg * price / 2], 1,
      `Total dye cost = Dye required(kg) x Price/kg = ${dyeKg} x ${price} = ৳${fmt(ans, 1)}.`, 'dyeing-costing');
  }
  // D5: Color yield / exhaustion %
  for (let k = 0; k < per; k++, i++) {
    const initial = round(randInt(20, 60) / 10, 1);
    const residual = round(initial * (randInt(5, 25) / 100), 2);
    const ans = ((initial - residual) / initial) * 100;
    push(sub, i, 100,
      `A dye bath starts with an initial dye concentration of ${initial} g/L, and after dyeing the residual concentration is ${residual} g/L. Find the dye exhaustion % (Exhaustion% = (Initial - Residual)/Initial x 100).`,
      ans, [(residual / initial) * 100, ans + 3, ans - 3, ans * 0.9], 2,
      `Exhaustion% = (${initial} - ${residual}) / ${initial} x 100 = ${fmt(initial - residual, 2)} / ${initial} x 100 = ${fmt(ans, 2)}%.`, 'dyeing-exhaustion');
  }
  // D6: Salt requirement
  for (let k = 0; k < per; k++, i++) {
    const fabricKg = randInt(50, 400);
    const saltPct = randInt(20, 80);
    const ans = (saltPct * fabricKg) / 100;
    push(sub, i, 100,
      `A dyeing recipe requires Glauber's salt at ${saltPct}% of fabric weight, for a batch of ${fabricKg} kg fabric. Find the total salt required in kg.`,
      ans, [fabricKg / saltPct, ans + 5, ans - 5, saltPct - fabricKg], 1,
      `Salt required = (Salt% x Fabric weight(kg)) / 100 = (${saltPct} x ${fabricKg}) / 100 = ${fmt(ans, 1)} kg.`, 'dyeing-recipe');
  }
  // D7: GSM after area shrinkage
  for (let k = 0; k < per; k++, i++) {
    const oldGSM = randInt(140, 280);
    const shrinkPct = randInt(3, 12);
    const ans = oldGSM / (1 - shrinkPct / 100);
    push(sub, i, 100,
      `A knit fabric has a GSM of ${oldGSM} before finishing. After processing it undergoes an area shrinkage of ${shrinkPct}%. Find the new GSM after finishing (New GSM = Old GSM / (1 - Shrinkage%)).`,
      ans, [oldGSM * (1 - shrinkPct / 100), ans + 10, ans - 10, oldGSM + shrinkPct], 1,
      `New GSM = Old GSM / (1 - Shrinkage%) = ${oldGSM} / (1 - ${shrinkPct}/100) = ${oldGSM} / ${fmt(1 - shrinkPct / 100, 2)} = ${fmt(ans, 1)} g/m².`, 'dyeing-gsm-shrinkage');
  }
  // D8: Cost per kg fabric processed
  for (let k = 0; k < per; k++, i++) {
    const totalCost = randInt(20000, 150000);
    const fabricKg = randInt(200, 2000);
    const ans = totalCost / fabricKg;
    push(sub, i, 100,
      `A dyeing unit spends ৳${totalCost} in total chemical cost to process ${fabricKg} kg of fabric. Find the dyeing cost per kg of fabric.`,
      ans, [totalCost * fabricKg, ans + 5, ans - 5, fabricKg / totalCost], 2,
      `Cost/kg = Total chemical cost / Fabric weight(kg) = ${totalCost} / ${fabricKg} = ৳${fmt(ans, 2)}/kg.`, 'dyeing-costing');
  }
  // D9: Water consumption for batch
  for (let k = 0; k < per; k++, i++) {
    const batchKg = randInt(100, 1000);
    const ml = pick([4, 6, 8, 10, 12, 15]);
    const ans = batchKg * ml;
    push(sub, i, 100,
      `A dyeing batch of ${batchKg} kg fabric is processed at a liquor ratio of 1:${ml}. Find the total water consumption in litres.`,
      ans, [batchKg / ml, ans + 50, ans - 50, batchKg + ml], 0,
      `Water consumption = Batch weight(kg) x M:L = ${batchKg} x ${ml} = ${fmt(ans, 0)} L.`, 'dyeing-liquor-ratio');
  }
  // D10: Total recipe chemical for batch
  for (let k = 0; k < per; k++, i++) {
    const batchKg = randInt(80, 600);
    const dosagePct = round(randInt(5, 30) / 10, 1);
    const ans = (dosagePct * batchKg) / 100;
    push(sub, i, 100,
      `A finishing recipe requires a softener at ${dosagePct}% (owf, on weight of fabric) for a batch of ${batchKg} kg. Find the total softener required in kg.`,
      ans, [batchKg / dosagePct, ans + 2, ans - 2, dosagePct - batchKg], 2,
      `Softener required = (Dosage% x Batch weight(kg)) / 100 = (${dosagePct} x ${batchKg}) / 100 = ${fmt(ans, 2)} kg.`, 'dyeing-recipe');
  }
})();

// ---------- sanity checks ----------
const counts = {};
for (const q of Q) counts[q.subject] = (counts[q.subject] || 0) + 1;
console.error('Counts by subject:', JSON.stringify(counts, null, 2));
console.error('Total:', Q.length);
const dupes = new Set();
let dupeCount = 0;
const deduped = [];
for (const q of Q) {
  if (dupes.has(q.question_text)) { dupeCount++; console.error('DUP[' + q.tags[2] + '] dropped: ' + q.question_text); continue; }
  dupes.add(q.question_text);
  deduped.push(q);
}
console.error('Duplicate question_text count (dropped):', dupeCount);
console.error('Final unique question count:', deduped.length);
Q.length = 0;
Q.push(...deduped);
for (const q of Q) {
  if (!q.options.includes(q.correct_answer)) {
    throw new Error('correct_answer not in options: ' + q.question_text);
  }
  if (new Set(q.options).size !== 4) {
    throw new Error('options not 4 unique values: ' + q.question_text + ' -> ' + JSON.stringify(q.options));
  }
}
console.error('All correctness checks passed.');

// Every explanation must literally contain the stored correct_answer string
// -- catches any future d/rounding mismatch between the option shown and
// the worked solution's final line.
let mismatchCount = 0;
for (const q of Q) {
  if (!q.explanation.includes(q.correct_answer)) {
    mismatchCount++;
    console.error('ROUNDING MISMATCH [' + q.tags[2] + ']: answer="' + q.correct_answer + '" not found in explanation: ' + q.explanation);
  }
}
if (mismatchCount > 0) throw new Error(mismatchCount + ' explanation/answer rounding mismatches -- fix before deploying.');
console.error('Explanation/answer consistency check passed (0 mismatches).');

// ---------- emit SQL ----------
function sqlStr(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
function sqlJsonb(arr) { return "'" + JSON.stringify(arr).replace(/'/g, "''") + "'::jsonb"; }
function sqlArr(arr) { return "ARRAY[" + arr.map(sqlStr).join(',') + "]::text[]"; }

const lines = [];
lines.push('-- 550 generated mathematical/calculation textile-engineering questions.');
lines.push('-- Every correct_answer is computed directly from the stated formula (see gen_math_questions.cjs), not hand-typed.');
lines.push("SELECT set_config('request.jwt.claim.role','service_role',false);");
lines.push('BEGIN;');
const CHUNK = 50;
for (let start = 0; start < Q.length; start += CHUNK) {
  const chunk = Q.slice(start, start + CHUNK);
  lines.push('INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES');
  const rows = chunk.map((q) =>
    `  (${sqlStr(q.subject)}::uuid, ${sqlStr(q.difficulty)}::qb_difficulty, 'multiple_choice'::qb_question_type, ${sqlStr(q.question_text)}, ${sqlJsonb(q.options)}, ${sqlStr(q.correct_answer)}, ${sqlStr(q.explanation)}, ${q.points}, ${sqlArr(q.tags)})`
  );
  lines.push(rows.join(',\n') + ';');
}
lines.push('COMMIT;');

fs.writeFileSync(__dirname + '/math_questions.sql', lines.join('\n'));
console.error('Wrote ' + __dirname + '/math_questions.sql');
