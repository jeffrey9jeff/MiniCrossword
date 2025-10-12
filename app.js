// Mini Crossword — vanilla JS NYT-style 5×5
const SIZE = 5;
const gridEl = document.getElementById("grid");
const acrossList = document.getElementById("acrossList");
const downList = document.getElementById("downList");
const timerEl = document.getElementById("timer");
const titleEl = document.getElementById("puzzleTitle");
const darkToggle = document.getElementById("darkToggle");
const keypad = document.getElementById("keypad");
const keysWrap = keypad.querySelector(".keys");

const btn = id => document.getElementById(id);
const actions = {
  checkLetter: btn("checkLetter"),
  checkWord: btn("checkWord"),
  checkPuzzle: btn("checkPuzzle"),
  revealLetter: btn("revealLetter"),
  revealWord: btn("revealWord"),
  revealPuzzle: btn("revealPuzzle"),
  resetPuzzle: btn("resetPuzzle"),
  shareResult: btn("shareResult"),
};

let puzzle=null, cells=[], state=[], solution=[], numbers=[], clues={across:[],down:[]};
let cursor={idx:0, dir:"across"};
let startedAt=null, timerId=0;

const isLetter = c => /^[A-Za-z]$/.test(c);
const idxRC = (r,c) => r*SIZE + c;
const rcFromIdx = idx => [Math.floor(idx/SIZE), idx%SIZE];

(async function init(){
  try {
    const base = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : window.location.pathname + "/";
    const PUZZLE_URL = `${base}puzzles/today.json`;
    const res = await fetch(PUZZLE_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${PUZZLE_URL}`);
    puzzle = await res.json();
    titleEl.textContent = `${puzzle.title} — ${puzzle.date}`;
    buildModel(); buildGrid(); buildClues(); buildKeypad(); wireEvents(); startTimer();
  } catch (err) {
    console.error("Puzzle load failed:", err);
    document.getElementById("grid").innerHTML =
      "<div style='padding:1rem'>Could not load puzzles/today.json — check file path & name.</div>";
  }
})();

function buildModel(){
  const grid = puzzle.grid.map(r => r.map(ch => ch==="#" ? "#" : ch.toUpperCase()));
  solution = grid.flat();
  state = solution.map(ch => ch==="#" ? "#" : "");
  numbers = new Array(SIZE*SIZE).fill(0);
  let n=1;
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      if (grid[r][c]==="#") continue;
      const startA = (c===0 || grid[r][c-1]==="#");
      const startD = (r===0 || grid[r-1][c]==="#");
      if (startA || startD) numbers[idxRC(r,c)] = n++;
    }
  }
  clues.across = puzzle.across;
  clues.down = puzzle.down;
}

function buildGrid(){
  gridEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  gridEl.innerHTML = "";
  cells = [];
  for (let i=0;i<SIZE*SIZE;i++){
    const d = document.createElement("div");
    d.className = "cell";
    d.setAttribute("role","gridcell");
    d.setAttribute("tabindex","-1");
    if (solution[i]==="#"){
      d.classList.add("block");
      d.setAttribute("aria-disabled","true");
    } else if (numbers[i]) {
      const num = document.createElement("div");
      num.className = "num";
      num.textContent = numbers[i];
      d.appendChild(num);
    }
    gridEl.appendChild(d);
    cells.push(d);
  }
  setSelection(firstFillableIndex());
  renderLetters();
}

function renderLetters(){
  cells.forEach((cell,i)=>{
    if (cell.classList.contains("block")) return;
    const existing = cell.querySelector(".letter");
    if (existing) existing.remove();
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = state[i];
    cell.appendChild(span);
  });
  highlightCurrentWord();
}

function buildClues(){
  acrossList.innerHTML = "";
  downList.innerHTML = "";
  for (const cl of clues.across){
    const li = document.createElement("li");
    li.className="clue";
    li.dataset.dir="across";
    li.dataset.start=cl.start;
    li.innerHTML = `<strong>${cl.num}.</strong> ${cl.text}`;
    acrossList.appendChild(li);
  }
  for (const cl of clues.down){
    const li = document.createElement("li");
    li.className="clue";
    li.dataset.dir="down";
    li.dataset.start=cl.start;
    li.innerHTML = `<strong>${cl.num}.</strong> ${cl.text}`;
    downList.appendChild(li);
  }
}

function buildKeypad(){
  const letters = "QWERTYUIOPASDFGHJKLZXCVBNM";
  keysWrap.innerHTML = "";
  for (const ch of letters){
    const b = document.createElement("button");
    b.textContent = ch;
    b.addEventListener("click", ()=> handleInput(ch));
    keysWrap.appendChild(b);
  }
  const back = document.createElement("button");
  back.textContent = "⌫";
  back.addEventListener("click", ()=> backspace());
  keysWrap.appendChild(back);
}

function wireEvents(){
  cells.forEach((cell,i)=>{
    if (cell.classList.contains("block")) return;
    cell.addEventListener("click", ()=> { setSelection(i); cells[i].focus(); });
  });
  document.addEventListener("keydown",(e)=>{
    if (isLetter(e.key)) { handleInput(e.key.toUpperCase()); e.preventDefault(); return; }
    switch(e.key){
      case "Backspace": backspace(); e.preventDefault(); break;
      case " ": toggleDir(); e.preventDefault(); break;
      case "ArrowRight": move(0,1); e.preventDefault(); break;
      case "ArrowLeft": move(0,-1); e.preventDefault(); break;
      case "ArrowDown": move(1,0); e.preventDefault(); break;
      case "ArrowUp": move(-1,0); e.preventDefault(); break;
      case "Tab": e.shiftKey? prevWord(): nextWord(); e.preventDefault(); break;
    }
  });
  [...document.querySelectorAll(".clue")].forEach(li=>{
    li.addEventListener("click", ()=> {
      cursor.dir = li.dataset.dir;
      setSelection(parseInt(li.dataset.start,10));
    });
  });
  actions.checkLetter.onclick = ()=> checkLetter();
  actions.checkWord.onclick = ()=> checkWord();
  actions.checkPuzzle.onclick = ()=> checkPuzzle();
  actions.revealLetter.onclick = ()=> revealLetter();
  actions.revealWord.onclick = ()=> revealWord();
  actions.revealPuzzle.onclick = ()=> revealPuzzle();
  actions.resetPuzzle.onclick = ()=> resetPuzzle();
  actions.shareResult.onclick = ()=> share();
  darkToggle.addEventListener("click", ()=>{
    const on = document.documentElement.classList.toggle("dark");
    darkToggle.setAttribute("aria-pressed", on ? "true":"false");
  });
}

function setSelection(idx){
  if (solution[idx]==="#") idx = nextFillableIndex(idx);
  cursor.idx = idx;
  cells.forEach(c=> c.setAttribute("aria-selected","false"));
  if (idx>=0) cells[idx].setAttribute("aria-selected","true");
  highlightCurrentWord();
}
function cellSpan(idx){
  const [r,c] = rcFromIdx(idx);
  const dir = cursor.dir;
  let sr=r, sc=c;
  while (sr>0 && dir==="down" && solution[idxRC(sr-1,sc)]!=="#") sr--;
  while (sc>0 && dir==="across" && solution[idxRC(sr,sc-1)]!=="#") sc--;
  const out=[];
  let rr=sr, cc=sc;
  while (rr<SIZE && cc<SIZE && solution[idxRC(rr,cc)]!=="#"){
    out.push(idxRC(rr,cc));
    if (dir==="down") rr++; else cc++;
  }
  return out;
}
function highlightCurrentWord(){
  cells.forEach(c=> c.classList.remove("highlight"));
  for (const i of cellSpan(cursor.idx)) cells[i].classList.add("highlight");
  markActiveClue();
}
function markActiveClue(){
  const start = cellSpan(cursor.idx)[0];
  document.querySelectorAll(".clue").forEach(c=> c.classList.remove("active"));
  const list = cursor.dir==="across" ? acrossList : downList;
  const item = [...list.children].find(li => parseInt(li.dataset.start,10)===start);
  if (item) item.classList.add("active");
}
function handleInput(ch){
  if (solution[cursor.idx]==="#") return;
  state[cursor.idx] = ch;
  renderLetters();
  advance();
}
function backspace(){
  if (solution[cursor.idx]==="#") return;
  if (state[cursor.idx]) state[cursor.idx] = "";
  else retreat();
  renderLetters();
}
function move(dr,dc){
  const [r,c]=rcFromIdx(cursor.idx);
  const nr=r+dr, nc=c+dc;
  if (nr<0||nc<0||nr>=SIZE||nc>=SIZE) return;
  setSelection(idxRC(nr,nc));
}
function advance(){
  const word = cellSpan(cursor.idx);
  const pos = word.indexOf(cursor.idx);
  if (pos < word.length-1) setSelection(word[pos+1]); else nextWord();
}
function retreat(){
  const word = cellSpan(cursor.idx);
  const pos = word.indexOf(cursor.idx);
  if (pos > 0) setSelection(word[pos-1]);
}
function nextWord(){
  const dir = cursor.dir;
  for (let i=cursor.idx+1;i<SIZE*SIZE;i++){ if (isWordStart(i,dir)) { setSelection(i); return; } }
  for (let i=0;i<cursor.idx;i++){ if (isWordStart(i,dir)) { setSelection(i); return; } }
}
function prevWord(){
  const dir = cursor.dir;
  for (let i=cursor.idx-1;i>=0;i--){ if (isWordStart(i,dir)) { setSelection(i); return; } }
}
function isWordStart(i,dir){
  if (solution[i]==="#") return false;
  const [r,c]=rcFromIdx(i);
  if (dir==="across") return c===0 || solution[idxRC(r,c-1)]==="#";
  return r===0 || solution[idxRC(r-1,c)]==="#";
}
function nextFillableIndex(i){
  for (let k=i+1;k<SIZE*SIZE;k++) if (solution[k]!=="#") return k;
  for (let k=0;k<i;k++) if (solution[k]!=="#") return k;
  return -1;
}
function firstFillableIndex(){ return nextFillableIndex(-1); }

// Strict checks/reveals
function checkLetter(){ if (solution[cursor.idx]!=="#") paintCell(cursor.idx, state[cursor.idx]===solution[cursor.idx]); }
function checkWord(){ for (const i of cellSpan(cursor.idx)) if (solution[i]!=="#") paintCell(i, state[i]===solution[i]); }
function checkPuzzle(){ for (let i=0;i<SIZE*SIZE;i++) if (solution[i]!=="#") paintCell(i, state[i]===solution[i]); }
function revealLetter(){ if (solution[cursor.idx]!=="#"){ state[cursor.idx]=solution[cursor.idx]; renderLetters(); } }
function revealWord(){ for (const i of cellSpan(cursor.idx)) if (solution[i]!=="#") state[i]=solution[i]; renderLetters(); }
function revealPuzzle(){ for (let i=0;i<SIZE*SIZE;i++) if (solution[i]!=="#") state[i]=solution[i]; renderLetters(); }
function resetPuzzle(){ for (let i=0;i<SIZE*SIZE;i++) if (solution[i]!=="#"){ state[i]=""; cells[i].style.background=""; } renderLetters(); }

function paintCell(i, ok){
  cells[i].style.background = ok ? "var(--correct)" : "var(--wrong)";
  setTimeout(()=>{ cells[i].style.background=""; }, 260);
}

// Timer
function startTimer(){
  startedAt = Date.now();
  timerId = setInterval(()=>{
    const s = Math.floor((Date.now()-startedAt)/1000);
    const m = Math.floor(s/60);
    const ss = String(s%60).padStart(2,"0");
    timerEl.textContent = `${m}:${ss}`;
  }, 250);
}

// Share — emoji grid + time
async function share(){
  // Build emoji grid like NYT: ⬛ for blocks, 🟩 correct, 🟨 filled wrong, ⬜ empty
  const em=[];
  for (let r=0;r<SIZE;r++){
    let row=\"\";
    for (let c=0;c<SIZE;c++){
      const i=idxRC(r,c);
      if (solution[i]===\"#\") row += \"⬛\";
      else if (!state[i]) row += \"⬜\";
      else row += (state[i]===solution[i])?\"🟩\":\"🟨\";
    }
    em.push(row);
  }
  const text = `Mini Crossword — ${puzzle.date}\n${timerEl.textContent}\n` + em.join(\"\\n\");
  try {
    await navigator.clipboard.writeText(text);
    alert(\"Result copied to clipboard!\");
  } catch(e){
    prompt(\"Copy your result:\", text);
  }
}
