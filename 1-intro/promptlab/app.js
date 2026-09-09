const dataset = [
  { id: "MC-01", name: "Ana", income: 4200, debt: 22, employment: "Indefinido", late: 0, savings: 12000, approved: 1 },
  { id: "MC-02", name: "Bruno", income: 2100, debt: 48, employment: "Temporal", late: 2, savings: 700, approved: 0 },
  { id: "MC-03", name: "Carla", income: 3100, debt: 35, employment: "Indefinido", late: 0, savings: 4500, approved: 1 },
  { id: "MC-04", name: "David", income: 5800, debt: 52, employment: "Autónomo", late: 1, savings: 9000, approved: 0 },
  { id: "MC-05", name: "Elena", income: 1900, debt: 28, employment: "Indefinido", late: 0, savings: 3000, approved: 1 },
  { id: "MC-06", name: "Farid", income: 2600, debt: 61, employment: "Temporal", late: 3, savings: 300, approved: 0 },
  { id: "MC-07", name: "Gabriela", income: 4700, debt: 18, employment: "Autónomo", late: 0, savings: 8000, approved: 1 },
  { id: "MC-08", name: "Hugo", income: 3300, debt: 44, employment: "Indefinido", late: 1, savings: 2000, approved: 0 },
  { id: "MC-09", name: "Irene", income: 2400, debt: 31, employment: "Temporal", late: 0, savings: 6000, approved: 1 },
  { id: "MC-10", name: "Javier", income: 6200, debt: 39, employment: "Indefinido", late: 0, savings: 16000, approved: 1 },
  { id: "MC-11", name: "Kiara", income: 2900, debt: 56, employment: "Autónomo", late: 2, savings: 1100, approved: 0 },
  { id: "MC-12", name: "Luis", income: 3600, debt: 26, employment: "Temporal", late: 1, savings: 5000, approved: 1 },
  { id: "MC-13", name: "Marta", income: 1800, debt: 67, employment: "Indefinido", late: 4, savings: 0, approved: 0 },
  { id: "MC-14", name: "Nabil", income: 5100, debt: 33, employment: "Autónomo", late: 0, savings: 2500, approved: 1 },
  { id: "MC-15", name: "Olga", income: 2700, debt: 42, employment: "Indefinido", late: 0, savings: 900, approved: 0 },
  { id: "MC-16", name: "Pablo", income: 4300, debt: 47, employment: "Temporal", late: 0, savings: 7000, approved: 1 }
];

const prompts = {
  vague: `Clasifica cada solicitud de microcrédito como APROBADA o RECHAZADA. Usa los datos disponibles y responde brevemente.`,
  balanced: `Actúa como analista de riesgo. Clasifica cada solicitud como APROBADA o RECHAZADA. Valora conjuntamente ingresos, ratio de deuda, estabilidad laboral, impagos y ahorros. Prioriza capacidad de pago, pero no rechaces automáticamente por un único indicador. Justifica la decisión en una frase.`,
  strict: `Actúa como analista de riesgo conservador. Aprueba solo si hay evidencia clara de capacidad de pago: deuda contenida, pocos o ningún impago y colchón de ahorro suficiente. Ante señales contradictorias, elige RECHAZADA. Justifica la decisión.`
};

const state = { preset: "balanced", engine: "local", classic: [], prompt: [], promptRun: 0, selected: null };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function seededNoise(id, run) {
  let x = (id * 9301 + run * 49297 + 233280) % 233280;
  return x / 233280 - 0.5;
}

function classicPrediction(row) {
  const employment = row.employment === "Indefinido" ? 0.48 : row.employment === "Autónomo" ? 0.12 : -0.08;
  const raw = -0.85 + row.income / 3300 - row.debt / 47 + employment - row.late * 0.56 + Math.min(row.savings, 12000) / 15000;
  const probability = sigmoid(raw * 2.15);
  return {
    label: probability >= 0.5 ? 1 : 0,
    confidence: Math.abs(probability - 0.5) * 2,
    probability,
    reason: `Probabilidad estimada ${(probability * 100).toFixed(0)}%. La combinación lineal pondera ingresos, deuda, empleo, impagos y ahorros.`
  };
}

function inferPromptStyle(text) {
  const t = text.toLowerCase();
  let strictness = state.preset === "strict" ? 0.55 : state.preset === "vague" ? -0.3 : 0;
  if (/conservador|solo si|ante señales|riesgo bajo|rechaza/.test(t)) strictness += 0.35;
  if (/no rechaces automáticamente|conjuntamente|compensa|flexible/.test(t)) strictness -= 0.2;
  const criteria = ["ingres", "deuda", "emple", "impago", "ahorro"].filter(k => t.includes(k)).length;
  return { strictness, criteria };
}

function promptPrediction(row, index) {
  const { strictness, criteria } = inferPromptStyle($("#promptText").value);
  const examples = $("#examplesToggle").checked;
  const schema = $("#schemaToggle").checked;
  const temperature = Number($("#temperature").value) / 10;
  let raw;

  if (criteria <= 1) {
    raw = -0.9 + row.income / 2800 - row.late * 0.55 - strictness;
  } else {
    const employment = row.employment === "Indefinido" ? 0.35 : row.employment === "Autónomo" ? 0.12 : -0.04;
    raw = -0.72 + row.income / 3500 - row.debt / 52 + employment - row.late * 0.5 + Math.min(row.savings, 12000) / 16500 - strictness;
  }
  if (examples) {
    raw += row.debt < 35 && row.late === 0 ? 0.18 : 0;
    raw -= row.debt > 50 || row.late >= 2 ? 0.22 : 0;
  }
  raw += seededNoise(index + 1, state.promptRun) * temperature * 2.6;
  const probability = sigmoid(raw * 2.05);
  let label = probability >= 0.5 ? 1 : 0;
  const missing = !schema && ((index + state.promptRun) % 7 === 3 || (temperature > .7 && (index + state.promptRun) % 5 === 1));
  if (missing) label = null;

  const positive = [];
  const negative = [];
  if (row.income >= 4200) positive.push("ingresos por encima de la mediana del dataset");
  else if (row.income < 2500) negative.push("ingresos inferiores a la mediana del dataset (€3.200)");
  if (row.debt <= 35) positive.push("deuda contenida"); else if (row.debt > 48) negative.push("deuda elevada");
  if (row.employment === "Indefinido") positive.push("empleo estable");
  else if (row.employment === "Temporal") negative.push("empleo temporal");
  if (row.late === 0) positive.push("sin impagos"); else negative.push(`${row.late} impago${row.late > 1 ? "s" : ""}`);
  if (row.savings >= 5000) positive.push("colchón de ahorro"); else if (row.savings < 1200) negative.push("poco ahorro");
  let reason;
  if (missing) {
    reason = "La respuesta fue discursiva y no incluyó una etiqueta que el sistema pudiera interpretar.";
  } else if (label === 1) {
    reason = `Aprueba por ${positive.slice(0, 2).join(" y ") || "el balance global de indicadores"}${negative.length ? `, aunque detecta ${negative[0]}` : ""}.`;
  } else if (negative.length === 1 && positive.length >= 2) {
    reason = `Rechaza al ponderar más ${negative[0]} que señales favorables como ${positive.slice(0, 2).join(" y ")}.`;
  } else {
    reason = `Rechaza por ${negative.slice(0, 2).join(" y ") || "el balance global de indicadores"}${positive.length ? `, pese a ${positive[0]}` : ""}.`;
  }
  return { label, probability, confidence: Math.abs(probability - .5) * 2, reason, positive, negative };
}

function calculateMetrics(predictions) {
  const valid = predictions.map((p, i) => ({ p: p.label, y: dataset[i].approved })).filter(x => x.p !== null);
  if (!valid.length) return { accuracy: 0, precision: 0, recall: 0, f1: 0, coverage: 0 };
  const tp = valid.filter(x => x.p === 1 && x.y === 1).length;
  const tn = valid.filter(x => x.p === 0 && x.y === 0).length;
  const fp = valid.filter(x => x.p === 1 && x.y === 0).length;
  const fn = valid.filter(x => x.p === 0 && x.y === 1).length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { accuracy: (tp + tn) / valid.length, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0, coverage: valid.length / predictions.length };
}

function renderDataset() {
  $("#datasetBody").innerHTML = dataset.map(r => `<tr><td>${r.id}</td><td>€ ${r.income.toLocaleString("es-ES")}</td><td>${r.debt}%</td><td>${r.employment}</td><td>${r.late}</td><td>€ ${r.savings.toLocaleString("es-ES")}</td><td>${pill(r.approved)}</td></tr>`).join("");
}

function pill(value) {
  if (value === null || value === undefined) return `<span class="class-pill missing">No parseado</span>`;
  return `<span class="class-pill ${value ? "" : "no"}">${value ? "Aprobada" : "Rechazada"}</span>`;
}

function renderComparisonMetrics() {
  const classic = calculateMetrics(state.classic);
  const prompt = calculateMetrics(state.prompt);
  const metrics = [
    ["Exactitud (<em>Accuracy</em>)", "Porcentaje total de aciertos", "accuracy"],
    ["Precision", "De las aprobadas, cuántas eran correctas", "precision"],
    ["Exhaustividad (<em>Recall</em>)", "Cuántas aprobadas reales detecta", "recall"],
    ["F1", "Equilibrio entre precision y recall", "f1"]
  ];
  $("#metricRows").innerHTML = metrics.map(([name, description, key]) => `
    <div class="metric-comparison-row" role="row">
      <div class="metric-name" role="rowheader"><b>${name}</b><small>${description}</small></div>
      <div class="comparison-value classic-value" role="cell"><b>${(classic[key] * 100).toFixed(0)}<small>%</small></b><span><i style="width:${classic[key] * 100}%"></i></span></div>
      <div class="comparison-value prompt-value" role="cell"><b>${(prompt[key] * 100).toFixed(0)}<small>%</small></b><span><i style="width:${prompt[key] * 100}%"></i></span></div>
    </div>`).join("");
  return { classic, prompt };
}

function renderPredictions() {
  $("#predictionBody").innerHTML = dataset.map((row, i) => {
    const c = state.classic[i];
    const p = state.prompt[i];
    const cOk = c && c.label === row.approved;
    const pOk = p && p.label === row.approved;
    return `<tr data-index="${i}" tabindex="0" class="${state.selected === i ? "selected" : ""}" aria-label="Inspeccionar solicitud de ${row.name}">
      <td>${row.id} · ${row.name}</td><td>${pill(row.approved)}</td>
      <td>${c ? `${pill(c.label)} <i class="outcome-dot ${cOk ? "" : "wrong"}"></i>` : "—"}</td>
      <td>${p ? `${pill(p.label)} <i class="outcome-dot ${pOk ? "" : "wrong"}"></i>` : "—"}</td>
      <td><button class="inspect-button" type="button" aria-label="Explicar ${row.id}">→</button></td>
    </tr>`;
  }).join("");
  $$("#predictionBody tr").forEach(row => {
    const open = () => selectRow(Number(row.dataset.index));
    row.addEventListener("click", open);
    row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

function selectRow(index) {
  state.selected = index;
  renderPredictions();
  const row = dataset[index];
  const c = state.classic[index];
  const p = state.prompt[index];
  const labelText = value => value === null || value === undefined ? "Sin predicción" : value ? "Aprobada" : "Rechazada";
  const verdict = prediction => {
    if (!prediction || prediction.label === null) return `<em class="verdict missing">No evaluable</em>`;
    return prediction.label === row.approved ? `<em class="verdict">✓ Acierto</em>` : `<em class="verdict error">✕ Error</em>`;
  };
  const diagnosis = !p || p.label === null
    ? "La salida no puede compararse con la etiqueta real hasta convertirla en una predicción estructurada."
    : p.label === row.approved
      ? "El prompt coincide con la etiqueta real. Revisa si la justificación utiliza los mismos criterios que la decisión."
      : row.approved === 1 && p.label === 0 && row.debt <= 35 && row.late === 0
        ? "Falso negativo: el prompt sobrepondera los ingresos relativos al dataset y no compensa suficientemente la deuda baja, la estabilidad laboral y la ausencia de impagos."
        : `El prompt produce un ${row.approved === 1 ? "falso negativo" : "falso positivo"}. El objetivo es identificar qué criterio de la instrucción ha dominado la decisión.`;
  $("#explanationPanel").innerHTML = `<span class="explanation-tag">${row.id} · ANÁLISIS DEL CASO</span><h4>${row.name}</h4>
    <div class="ground-truth">Etiqueta real ${pill(row.approved)}</div>
    <p class="case-data">Ingresos €${row.income.toLocaleString("es-ES")}, deuda ${row.debt}%, empleo ${row.employment.toLowerCase()}, ${row.late} impagos y €${row.savings.toLocaleString("es-ES")} de ahorro.</p>
    <div class="decision-grid">
      <div class="decision-card classic-decision"><span>MODELO CLÁSICO</span><b>Predice: ${labelText(c?.label)}</b><small>${c ? `${(c.probability * 100).toFixed(0)}% de probabilidad de aprobación` : "Aún no ejecutado"}</small><span class="probability-bar"><i style="width:${c ? c.probability * 100 : 0}%"></i></span>${verdict(c)}</div>
      <div class="decision-card prompt-decision"><span>FLUJO CON PROMPT</span><b>Predice: ${labelText(p?.label)}</b><small>${p && p.label !== null ? `${(p.probability * 100).toFixed(0)}% de probabilidad de aprobación` : "Salida no interpretable"}</small><span class="probability-bar"><i style="width:${p ? p.probability * 100 : 0}%"></i></span>${verdict(p)}</div>
    </div>
    <div class="explanation-quote"><b>Justificación del prompt</b><br>${p ? p.reason : "Ejecuta el prompt para generar una explicación."}</div>
    <div class="model-error-note"><b>Qué debe observar el estudiante</b>${diagnosis}</div>`;
}

function updateAll() {
  const { prompt: pm } = renderComparisonMetrics();
  renderPredictions();
  const missing = state.prompt.filter(p => p.label === null).length;
  $("#parsingWarning").hidden = missing === 0;
  if (missing) $("#parsingWarning p").innerHTML = `<b>${missing} respuesta${missing > 1 ? "s" : ""} no interpretable${missing > 1 ? "s" : ""}.</b> La accuracy se calcula solo sobre las salidas válidas (cobertura ${(pm.coverage * 100).toFixed(0)}%).`;
  if (state.selected !== null) selectRow(state.selected);
}

function normalizeRemotePrediction(value) {
  if (typeof value === "boolean" || value === 0 || value === 1) return Number(value);
  const v = String(value ?? "").toLowerCase();
  if (/aprob|approve|accept|^1$/.test(v)) return 1;
  if (/rechaz|reject|deny|^0$/.test(v)) return 0;
  return null;
}

async function runRemote(button) {
  const endpoint = $("#endpointUrl").value.trim();
  if (!endpoint) {
    $("#endpointUrl").focus();
    $("#engineStatus").textContent = "Añade un endpoint para continuar";
    showToast("Falta la URL del endpoint LLM");
    button.classList.remove("running");
    button.removeAttribute("aria-busy");
    return;
  }
  try {
    const rows = dataset.map(({ approved, ...row }) => row);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: $("#promptText").value,
        rows,
        settings: {
          include_examples: $("#examplesToggle").checked,
          json_schema: $("#schemaToggle").checked,
          temperature: Number($("#temperature").value) / 10
        }
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.predictions)) throw new Error("Formato de respuesta incorrecto");
    state.prompt = dataset.map((row, i) => {
      const result = payload.predictions.find(p => p.id === row.id) || payload.predictions[i] || {};
      const label = normalizeRemotePrediction(result.label ?? result.prediction);
      const probability = clamp(Number(result.probability ?? result.confidence ?? (label === 1 ? .75 : .25)), 0, 1);
      return { label, probability, confidence: Math.abs(probability - .5) * 2, reason: result.reason || result.explanation || "El endpoint no devolvió una justificación." };
    });
    state.promptRun += 1;
    $("#engineStatus").textContent = "Endpoint LLM · conectado";
    showToast("Respuesta recibida del endpoint LLM");
    updateAll();
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    $("#engineStatus").textContent = `Error de conexión · ${error.message}`;
    showToast("No se pudo consultar el endpoint");
  } finally {
    button.classList.remove("running");
    button.removeAttribute("aria-busy");
  }
}

function run(button, type) {
  button.classList.add("running");
  button.setAttribute("aria-busy", "true");
  if (type === "prompt" && state.engine === "remote") {
    runRemote(button);
    return;
  }
  window.setTimeout(() => {
    if (type === "classic") {
      state.classic = dataset.map(classicPrediction);
      showToast("Modelo clásico ejecutado sobre 16 solicitudes");
    } else {
      state.promptRun += 1;
      state.prompt = dataset.map(promptPrediction);
      $("#promptMetricLabel").textContent = $("[data-preset].active").textContent;
      showToast("Prompt ejecutado · simulación reproducible");
    }
    updateAll();
    button.classList.remove("running");
    button.removeAttribute("aria-busy");
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  }, type === "classic" ? 450 : 700);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function reset() {
  state.preset = "balanced"; state.engine = "local"; state.promptRun = 0; state.selected = null;
  $("#promptText").value = prompts.balanced;
  $("#examplesToggle").checked = true; $("#schemaToggle").checked = true; $("#temperature").value = 2;
  $$("[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === "balanced"));
  $$("[data-engine]").forEach(b => b.classList.toggle("active", b.dataset.engine === "local"));
  $("#endpointPanel").hidden = true;
  $("#engineStatus").textContent = "Simulación local · lista";
  updateTemperature(); updateCount();
  state.classic = dataset.map(classicPrediction);
  state.prompt = dataset.map(promptPrediction);
  updateAll(); showToast("Laboratorio reiniciado");
}

function updateTemperature() {
  const value = Number($("#temperature").value) / 10;
  $("#tempValue").textContent = value.toFixed(1);
  $("#temperature").setAttribute("aria-valuetext", value.toFixed(1));
}

function updateCount() {
  const words = $("#promptText").value.trim().split(/\s+/).filter(Boolean).length;
  $("#tokenCount").textContent = `${words} palabras`;
}

$("#datasetToggle").addEventListener("click", e => {
  const expanded = e.currentTarget.getAttribute("aria-expanded") === "true";
  e.currentTarget.setAttribute("aria-expanded", String(!expanded));
  e.currentTarget.innerHTML = `${expanded ? "Ver" : "Ocultar"} dataset <span>${expanded ? "⌄" : "⌃"}</span>`;
  $("#datasetPanel").hidden = expanded;
});

$("#solutionToggle").addEventListener("click", e => {
  const expanded = e.currentTarget.getAttribute("aria-expanded") === "true";
  e.currentTarget.setAttribute("aria-expanded", String(!expanded));
  e.currentTarget.textContent = expanded ? "Mostrar solución" : "Ocultar solución";
  $$(".solution-only").forEach(el => el.hidden = expanded);
  showToast(expanded ? "Solución oculta" : "Respuestas orientativas visibles");
});

$$("[data-preset]").forEach(button => button.addEventListener("click", () => {
  state.preset = button.dataset.preset;
  $$("[data-preset]").forEach(b => b.classList.toggle("active", b === button));
  $("#promptText").value = prompts[state.preset];
  updateCount();
}));

$$("[data-engine]").forEach(button => button.addEventListener("click", () => {
  state.engine = button.dataset.engine;
  $$("[data-engine]").forEach(b => b.classList.toggle("active", b === button));
  const remote = state.engine === "remote";
  $("#endpointPanel").hidden = !remote;
  $("#engineStatus").textContent = remote ? "Endpoint LLM · pendiente de URL" : "Simulación local · lista";
  if (remote) $("#endpointUrl").focus();
}));

$("#promptText").addEventListener("input", updateCount);
$("#temperature").addEventListener("input", updateTemperature);
$("#runClassic").addEventListener("click", e => run(e.currentTarget, "classic"));
$("#runPrompt").addEventListener("click", e => run(e.currentTarget, "prompt"));
$("#resetButton").addEventListener("click", reset);
document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run($("#runPrompt"), "prompt"); });

renderDataset();
$("#promptText").value = prompts.balanced;
state.classic = dataset.map(classicPrediction);
state.prompt = dataset.map(promptPrediction);
updateCount();
updateTemperature();
updateAll();
