/* ============================================================
   CONFIGURACIÓN Y ESTADO
   ============================================================ */
const $ = id => document.getElementById(id);
const FACE = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
const TOTAL_ROUNDS = 5;

// PEGA AQUÍ TU URL DE GOOGLE APPS SCRIPT (La que te dio al implementar)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwu_iSnPNq3KYkNBrYMKGx1K_BIj8cxG0s9nqJSpLTgOZciKdw15SRMH_2axHWNg8expA/exec';

let state = {
  playerName: "",
  round: 1,
  score: 0,
  d1: 0, d2: 0,
  clueB: null, clueA: null,
  phase1Correct: false,
  phase2Correct: false
};

/* ============================================================
   UTILIDADES MATEMÁTICAS Y GRÁFICAS
   ============================================================ */
const randInt = (a,b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = arr => {
  const a = [...arr];
  for(let i=a.length-1; i>0; i--){
    const j = randInt(0,i); [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};
const gcd = (a,b) => b === 0 ? a : gcd(b, a % b);
const simplify = (n,d) => {
  if(n === 0) return "0";
  if(n === d) return "1";
  const g = gcd(n,d);
  return `${n/g}/${d/g}`;
};

function createDiceHTML(val, isMini=false) {
  const face = FACE[val];
  const cellClass = isMini ? "mini-cell" : "cell";
  let html = "";
  for(let i=0; i<9; i++){
    html += `<div class="${cellClass} ${face.includes(i) ? 'on' : ''}"></div>`;
  }
  return html;
}

function setDie(el, val) {
  el.innerHTML = createDiceHTML(val);
}

/* ============================================================
   LÓGICA DE PISTAS Y OPCIONES
   ============================================================ */
function generateClues(d1, d2) {
  const sum = d1 + d2;
  const pool = [];

  pool.push({ text: `La suma de los dados es ${sum}`, test: (a,b) => a+b === sum });
  
  if(d1 > d2) pool.push({ text: "El primer dado es mayor que el segundo", test: (a,b) => a > b });
  else if(d1 < d2) pool.push({ text: "El primer dado es menor que el segundo", test: (a,b) => a < b });
  else pool.push({ text: "Los dos dados son iguales", test: (a,b) => a === b });

  pool.push({ text: `El primer dado es un número ${d1 % 2 === 0 ? 'par' : 'impar'}`, test: (a,b) => (a%2) === (d1%2) });
  pool.push({ text: `El segundo dado es un número ${d2 % 2 === 0 ? 'par' : 'impar'}`, test: (a,b) => (b%2) === (d2%2) });

  const isProdEven = (d1 * d2) % 2 === 0;
  pool.push({ text: `El producto de ambos dados es ${isProdEven ? 'par' : 'impar'}`, test: (a,b) => ((a*b)%2 === 0) === isProdEven });

  let selected = [];
  const shuffledPool = shuffle(pool);
  
  for(let i=0; i<shuffledPool.length; i++){
    selected.push(shuffledPool[i]);
    let count = 0;
    for(let x=1; x<=6; x++){
      for(let y=1; y<=6; y++){
        if(selected.every(c => c.test(x,y))) count++;
      }
    }
    if(count === 1) return selected;
  }
  return selected;
}

function generatePhase1Options(d1, d2, clues) {
  let options = [{ a: d1, b: d2, correct: true }];
  let pool = [];

  for(let x=1; x<=6; x++) {
    for(let y=1; y<=6; y++) {
      if(x === d1 && y === d2) continue;
      let matchCount = clues.filter(c => c.test(x,y)).length;
      if(matchCount > 0 && matchCount < clues.length) {
        pool.push({ a: x, b: y, correct: false });
      }
    }
  }

  pool = shuffle(pool);
  while(options.length < 4) {
    if(pool.length > 0) {
      options.push(pool.pop());
    } else {
      let rx = randInt(1,6), ry = randInt(1,6);
      if(!options.some(o => o.a===rx && o.b===ry)) options.push({ a: rx, b: ry, correct: false });
    }
  }
  return shuffle(options);
}

function generatePhase2Options(clueB, clueA) {
  let bCount = 0, aBCount = 0, aCount = 0;
  for(let x=1; x<=6; x++){
    for(let y=1; y<=6; y++){
      const inB = clueB.test(x,y);
      const inA = clueA.test(x,y);
      if(inB) bCount++;
      if(inA) aCount++;
      if(inB && inA) aBCount++;
    }
  }

  const correct = simplify(aBCount, bCount);
  const seen = new Set([correct]);
  let distractors = [];

  const tryAdd = (n, d) => {
    if(d <= 0 || n < 0 || distractors.length >= 3) return;
    const s = simplify(n, d);
    if(!seen.has(s)){ seen.add(s); distractors.push(s); }
  };

  tryAdd(aBCount, 36); 
  tryAdd(bCount, 36);  
  tryAdd(aCount, 36);  
  tryAdd(bCount - aBCount, bCount); 

  while(distractors.length < 3){
    const n = randInt(1, 10), d = randInt(3, 20);
    const s = simplify(n, d);
    if(!seen.has(s)){ seen.add(s); distractors.push(s); }
  }

  return shuffle([correct, ...distractors]);
}

/* ============================================================
   CONTROL DE PANTALLAS Y RONDAS
   ============================================================ */
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(screenId).classList.add("active");
}

function updateHUD() {
  $("displayName").textContent = state.playerName;
  $("displayRound").textContent = `${state.round}/${TOTAL_ROUNDS}`;
  $("displayScore").textContent = state.score;
}

function startGame() {
  state.round = 1;
  state.score = 0;
  showScreen("screen-game");
  nextRound();
}

function nextRound() {
  if (state.round > TOTAL_ROUNDS) {
    endGame();
    return;
  }

  state.phase1Correct = false;
  state.phase2Correct = false;
  
  state.d1 = randInt(1, 6);
  state.d2 = randInt(1, 6);
  
  setDie($("die1"), state.d1);
  setDie($("die2"), state.d2);
  $("die1").classList.add("hidden-die");
  $("die2").classList.add("hidden-die");

  const clues = generateClues(state.d1, state.d2);
  state.clueB = clues[0];
  state.clueA = clues[1];
  
  $("clueList").innerHTML = "";
  clues.forEach(c => {
    const li = document.createElement("li");
    li.textContent = c.text;
    $("clueList").appendChild(li);
  });

  const options = generatePhase1Options(state.d1, state.d2, clues);
  $("optionsGrid").innerHTML = "";
  options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `
      <div class="mini-die">${createDiceHTML(opt.a, true)}</div>
      <div class="mini-die">${createDiceHTML(opt.b, true)}</div>
    `;
    btn.addEventListener("click", () => handlePhase1(btn, opt, options));
    $("optionsGrid").appendChild(btn);
  });

  $("phase1-area").classList.remove("hidden");
  $("phase2-area").classList.add("hidden");
  $("feedbackHost").innerHTML = "";
  $("btnNext").classList.add("hidden");
  
  updateHUD();
}

/* ============================================================
   MANEJO DE FASE 1 Y 2
   ============================================================ */
function handlePhase1(btn, opt, allOptions) {
  state.phase1Correct = opt.correct;
  const allBtns = [...$("optionsGrid").querySelectorAll(".option-btn")];
  
  allBtns.forEach((b, idx) => {
    b.disabled = true;
    if (allOptions[idx].correct) b.classList.add("correct");
  });
  if(!opt.correct) btn.classList.add("wrong");

  $("die1").classList.remove("hidden-die");
  $("die2").classList.remove("hidden-die");

  setTimeout(() => {
    $("phase1-area").classList.add("hidden");
    setupPhase2();
  }, 1000);
}

function setupPhase2() {
  $("phase2-area").classList.remove("hidden");
  
  $("mathQuestion").innerHTML = `
    <p>Fase 2: Cálculo de Probabilidad</p>
    <p style="margin-top:8px;">Sabiendo que <strong>${state.clueB.text.toLowerCase()}</strong>,<br>
    ¿cuál es la probabilidad de que <strong>${state.clueA.text.toLowerCase()}</strong>?</p>
  `;

  const options = generatePhase2Options(state.clueB, state.clueA);
  
  let bCount = 0, abCount = 0;
  for(let x=1; x<=6; x++){
    for(let y=1; y<=6; y++){
      if(state.clueB.test(x,y)) bCount++;
      if(state.clueB.test(x,y) && state.clueA.test(x,y)) abCount++;
    }
  }
  const correctAnswer = simplify(abCount, bCount);

  $("mathOptions").innerHTML = "";
  options.forEach(txt => {
    const btn = document.createElement("button");
    btn.className = "math-btn";
    btn.textContent = txt;
    
    btn.addEventListener("click", () => {
      const isCorrect = (txt === correctAnswer);
      state.phase2Correct = isCorrect;
      handlePhase2(btn, isCorrect, correctAnswer);
    });
    $("mathOptions").appendChild(btn);
  });
}

function handlePhase2(btn, isCorrect, correctAnswer) {
  const allBtns = [...$("mathOptions").querySelectorAll(".math-btn")];
  allBtns.forEach(b => {
    b.disabled = true;
    if(b.textContent === correctAnswer) b.classList.add("correct");
  });
  if(!isCorrect) btn.classList.add("wrong");

  let points = 0;
  if(state.phase1Correct) points += 10;
  if(state.phase2Correct) points += 10;
  state.score += points;
  updateHUD();

  const fb = document.createElement("div");
  fb.className = "feedback " + (points === 20 ? "ok" : "bad");
  
  const p1Text = state.phase1Correct ? "✅ Fase 1 correcta (+10)" : "❌ Fase 1 incorrecta (+0)";
  const p2Text = state.phase2Correct ? "✅ Fase 2 correcta (+10)" : "❌ Fase 2 incorrecta (+0)";
  
  let explanation = "";
  if (points === 20) explanation = "¡Perfecto! Deducción y cálculo impecables.";
  else if (points === 10) explanation = "Buen intento, pero fallaste en una de las dos fases.";
  else explanation = "Sigue practicando. Recuerda reducir el espacio muestral.";

  fb.innerHTML = `
    <h4>Resultado de la Ronda ${state.round}</h4>
    <div style="display:flex; gap:20px; margin: 10px 0; font-weight:700;">
      <span style="color:${state.phase1Correct?'var(--green)':'var(--red)'}">${p1Text}</span>
      <span style="color:${state.phase2Correct?'var(--green)':'var(--red)'}">${p2Text}</span>
    </div>
    <p class="explanation">${explanation}</p>
  `;
  $("feedbackHost").appendChild(fb);

  $("btnNext").classList.remove("hidden");
  $("btnNext").textContent = state.round === TOTAL_ROUNDS ? "Ver Resultados Finales 🏁" : "Siguiente Ronda →";
  $("btnNext").onclick = () => {
    state.round++;
    if (state.round > TOTAL_ROUNDS) endGame();
    else nextRound();
  };
}

/* ============================================================
   FIN DEL JUEGO Y GUARDADO EN LA NUBE
   ============================================================ */
function endGame() {
  showScreen("screen-end");
  $("endName").textContent = state.playerName;
  $("ranking-container").classList.add("hidden"); // Ocultar ranking al entrar
  
  const scoreEl = $("endScore");
  scoreEl.textContent = state.score;
  
  scoreEl.classList.remove("score-red", "score-blue", "score-green");
  let msg = "";
  
  if (state.score < 50) {
    scoreEl.classList.add("score-red");
    msg = "🔴 Necesitas repasar los conceptos. ¡No te rindas!";
  } else if (state.score <= 80) {
    scoreEl.classList.add("score-blue");
    msg = "🔵 ¡Buen trabajo! Tienes una base sólida.";
  } else {
    scoreEl.classList.add("score-green");
    msg = "🟢 ¡Excelente, detective experto! Dominas la probabilidad condicional.";
  }
  
  $("endMessage").textContent = msg;

  // Llamar a la función que guarda en Google Sheets
  guardarPuntaje(state.playerName, state.score);
}

// --- FUNCIONES DE BASE DE DATOS ---

function showToast(message, type) {
  const toast = $("toast");
  const icon = $("toastIcon");
  const msg = $("toastMsg");
  
  toast.className = `toast ${type}`;
  msg.textContent = message;
  
  if (type === 'loading') icon.textContent = '⏳';
  else if (type === 'success') icon.textContent = '✅';
  else if (type === 'error') icon.textContent = '❌';
  
  toast.classList.remove("hidden");
  
  // Ocultar después de 4 segundos si no es de carga
  if (type !== 'loading') {
    setTimeout(() => toast.classList.add("hidden"), 4000);
  }
}

// async function guardarPuntaje(nombre, puntaje) {
//   showToast("Guardando puntaje en la base de datos...", "loading");
  
//   const formData = new URLSearchParams();
//   formData.append('Nombre', nombre);
//   formData.append('Puntaje', puntaje);

//   try {
//     const response = await fetch(GOOGLE_SCRIPT_URL, {
//       method: 'POST',
//       body: formData
//     });
    
//     // Nota: Google Apps Script a veces devuelve un status 200 pero con redirección CORS.
//     // Si el fetch falla por CORS, usaremos el método 'no-cors' (pero no podremos leer la respuesta).
//     // Asumiremos que si no lanza error de red, se guardó.
//     showToast("¡Puntaje guardado exitosamente!", "success");
    
//     // Si el usuario hace clic en "Ver Ranking", que se actualice
//   } catch (error) {
//     console.error('Error al guardar:', error);
//     showToast("Error de red al guardar el puntaje.", "error");
//   }
// }
async function guardarPuntaje(nombre, puntaje) {
  showToast("Guardando puntaje en la base de datos...", "loading");
  
  // Usamos un objeto simple, no URLSearchParams
  const data = {
    Nombre: nombre,
    Puntaje: puntaje
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors', // Mantenemos CORS
      redirect: 'follow',
      headers: {
        // ¡Esta línea es la clave! Evita el bloqueo del navegador
        'Content-Type': 'text/plain;charset=utf-8' 
      },
      body: JSON.stringify(data) // Enviamos el objeto como texto JSON
    });
    
    if (!response.ok) throw new Error('Error en la respuesta del servidor');
    
    showToast("¡Puntaje guardado exitosamente!", "success");
  } catch (error) {
    console.error('Error al guardar:', error);
    showToast("Error al guardar. Revisa la consola.", "error");
  }
}

async function cargarRanking() {
  const tbody = $("rankingBody");
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando ranking...</td></tr>';
  
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const ranking = await response.json();
    
    tbody.innerHTML = "";
    
    if(ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aún no hay puntajes registrados.</td></tr>';
      return;
    }

    ranking.forEach(jugador => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${jugador.posicion}</td>
        <td style="font-weight:700;">${jugador.nombre}</td>
        <td style="color:var(--gold); font-weight:800;">${jugador.puntaje}</td>
        <td style="color:var(--muted); font-size:12px;">${jugador.fecha}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error al cargar ranking:', error);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--red);">Error al cargar los datos.</td></tr>';
  }
}

/* ============================================================
   EVENTOS DE INICIO Y REINICIO
   ============================================================ */
$("btnStart").addEventListener("click", () => {
  const name = $("inputName").value.trim();
  if (name === "") {
    alert("Por favor, ingresa un nombre para comenzar.");
    $("inputName").focus();
    return;
  }
  state.playerName = name;
  localStorage.setItem("detectiveName", name);
  startGame();
});

$("btnRestart").addEventListener("click", () => {
  showScreen("screen-login");
  $("inputName").value = state.playerName;
});

// Botón para mostrar el ranking
$("btnShowRanking").addEventListener("click", () => {
  const container = $("ranking-container");
  if (container.classList.contains("hidden")) {
    container.classList.remove("hidden");
    cargarRanking(); // Llama a Google Sheets para traer los datos frescos
    $("btnShowRanking").textContent = "Ocultar Ranking";
  } else {
    container.classList.add("hidden");
    $("btnShowRanking").textContent = "🏆 Ver Ranking Global";
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("detectiveName");
  if (savedName) {
    $("inputName").value = savedName;
  }
});