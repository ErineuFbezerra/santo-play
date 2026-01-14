// Santo Play v2 - Rádio + Player interno + Favoritos + Playlists
const $ = (s) => document.querySelector(s);

const API_BASES = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info"
];

const LS_FAV = "santoplay_favs_v2";
const LS_PL  = "santoplay_playlists_v2";

const audio = $("#audio");
const statusEl = $("#status");
const nowName = $("#nowName");
const nowMeta = $("#nowMeta");

let currentStation = null;
let favs = loadJson(LS_FAV, []);
let playlists = loadJson(LS_PL, []);

function setStatus(msg){ statusEl.textContent = msg; }

function loadJson(key, fallback){
  try{
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  }catch{ return fallback; }
}
function saveJson(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function pickBase(){
  return API_BASES[Math.floor(Math.random()*API_BASES.length)];
}

async function apiGet(path){
  const base = pickBase();
  const url = `${base}${path}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`API falhou: ${r.status}`);
  return r.json();
}

function stationCard(st, {showFavBtn=true} = {}){
  const name = (st.name || "Sem nome").trim();
  const country = (st.country || "").trim();
  const bitrate = st.bitrate ? `${st.bitrate} kbps` : "";
  const tags = (st.tags || "").split(",").map(t=>t.trim()).filter(Boolean).slice(0,3);

  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <h4>${escapeHtml(name)}</h4>
    <div class="meta">${escapeHtml(country)} ${bitrate ? "• "+escapeHtml(bitrate) : ""}</div>
    <div class="meta">${st.codec ? escapeHtml(st.codec) : ""}</div>
    <div class="meta">${st.homepage ? `<a href="${st.homepage}" target="_blank" rel="noopener noreferrer">Site</a>` : ""}</div>
    <div class="row">
      <button class="btn small primary" data-act="play">▶ Tocar</button>
      ${showFavBtn ? `<button class="btn small" data-act="fav">⭐</button>` : ``}
      <button class="btn small" data-act="addpl">➕ Playlist</button>
    </div>
    <div class="row">
      ${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}
    </div>
  `;

  el.querySelector('[data-act="play"]').addEventListener("click", ()=> playStation(st));
  const favBtn = el.querySelector('[data-act="fav"]');
  if(favBtn){
    favBtn.addEventListener("click", ()=> toggleFav(st));
    favBtn.title = "Favoritar";
  }
  el.querySelector('[data-act="addpl"]').addEventListener("click", ()=> addToPlaylistPrompt(st));
  return el;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalizeStation(st){
  // guarda só o essencial
  return {
    stationuuid: st.stationuuid,
    name: st.name,
    url_resolved: st.url_resolved,
    country: st.country,
    tags: st.tags,
    bitrate: st.bitrate,
    codec: st.codec,
    homepage: st.homepage,
    favicon: st.favicon
  };
}

function playStation(st){
  const s = normalizeStation(st);
  currentStation = s;

  if(!s.url_resolved){
    setStatus("Essa rádio não tem URL válida.");
    return;
  }

  nowName.textContent = s.name || "Rádio";
  nowMeta.textContent = `${s.country || ""}${s.codec ? " • " + s.codec : ""}${s.bitrate ? " • " + s.bitrate + " kbps" : ""}`.trim() || "Rádio ao vivo";

  audio.src = s.url_resolved;
  audio.play()
    .then(()=> setStatus("Tocando…"))
    .catch(()=> setStatus("O navegador bloqueou o play automático. Clique em Play no player."));
}

function toggleFav(st){
  const s = normalizeStation(st);
  const idx = favs.findIndex(x=>x.stationuuid === s.stationuuid);
  if(idx >= 0){
    favs.splice(idx,1);
    setStatus("Removido dos favoritos.");
  }else{
    favs.unshift(s);
    setStatus("Adicionado aos favoritos ⭐");
  }
  saveJson(LS_FAV, favs);
  renderFavs();
  renderPlaylists();
}

function isFav(uuid){
  return favs.some(x=>x.stationuuid === uuid);
}

async function loadTopGospel(){
  setStatus("Carregando Top rádios gospel…");
  $("#topGrid").innerHTML = "";
  try{
    // bytag/gospel é ótimo pra começar (sem chave)
    const data = await apiGet(`/json/stations/bytag/gospel?order=clickcount&reverse=true&limit=12`);
    const grid = $("#topGrid");
    (data || []).forEach(st => grid.appendChild(stationCard(st)));
    setStatus("Pronto.");
  }catch(e){
    setStatus("Falha ao carregar rádios. Tente novamente.");
  }
}

async function playTopGospel(){
  setStatus("Buscando uma rádio gospel top…");
  try{
    const data = await apiGet(`/json/stations/bytag/gospel?order=clickcount&reverse=true&limit=10`);
    const st = (data || [])[0];
    if(!st){ setStatus("Nenhuma rádio encontrada agora."); return; }
    playStation(st);
  }catch{
    setStatus("Falha ao buscar rádio gospel.");
  }
}

async function playRandomGospel(){
  setStatus("Pegando uma rádio gospel aleatória…");
  try{
    const data = await apiGet(`/json/stations/bytag/gospel?order=random&reverse=true&limit=20`);
    const list = (data || []).filter(x=>x.url_resolved);
    if(list.length === 0){ setStatus("Nenhuma rádio disponível agora."); return; }
    const st = list[Math.floor(Math.random()*list.length)];
    playStation(st);
  }catch{
    setStatus("Falha ao buscar rádio aleatória.");
  }
}

async function searchStations(query){
  const q = (query || "").trim();
  if(!q){ $("#resultInfo").textContent = "Digite algo para buscar."; return; }
  setStatus("Buscando…");
  $("#resultsGrid").innerHTML = "";
  $("#resultInfo").textContent = "Buscando…";
  try{
    const enc = encodeURIComponent(q);
    // Search por nome (rádio) — simples e efetivo
    const data = await apiGet(`/json/stations/search?name=${enc}&limit=30`);
    const list = (data || []).filter(x=>x.url_resolved);
    $("#resultInfo").textContent = `${list.length} resultado(s)`;
    const grid = $("#resultsGrid");
    list.forEach(st => grid.appendChild(stationCard(st)));
    setStatus("Pronto.");
  }catch{
    $("#resultInfo").textContent = "Falha na busca. Tente novamente.";
    setStatus("Falha na busca.");
  }
}

async function byTagGospel(){
  setStatus("Carregando por tag gospel…");
  $("#resultsGrid").innerHTML = "";
  $("#resultInfo").textContent = "Carregando…";
  try{
    const data = await apiGet(`/json/stations/bytag/gospel?order=clickcount&reverse=true&limit=30`);
    const list = (data || []).filter(x=>x.url_resolved);
    $("#resultInfo").textContent = `${list.length} rádio(s) gospel`;
    const grid = $("#resultsGrid");
    list.forEach(st => grid.appendChild(stationCard(st)));
    setStatus("Pronto.");
  }catch{
    $("#resultInfo").textContent = "Falha ao carregar tag gospel.";
    setStatus("Falha ao carregar.");
  }
}

function renderFavs(){
  const grid = $("#favGrid");
  grid.innerHTML = "";
  if(favs.length === 0){
    grid.innerHTML = `<div class="item"><h4>Nenhum favorito ainda</h4><div class="meta">Toque em ⭐ em qualquer rádio.</div></div>`;
    return;
  }
  favs.forEach(st=>{
    const el = stationCard(st, {showFavBtn:false});
    const favBtn = document.createElement("button");
    favBtn.className = "btn small";
    favBtn.textContent = "🗑 Remover";
    favBtn.addEventListener("click", ()=> toggleFav(st));
    el.querySelector(".row").appendChild(favBtn);
    grid.appendChild(el);
  });
}

function renderPlaylists(){
  const root = $("#plList");
  root.innerHTML = "";
  if(playlists.length === 0){
    root.innerHTML = `<div class="item"><h4>Nenhuma playlist criada</h4><div class="meta">Crie uma acima: Secreto, Oração, Treino…</div></div>`;
    return;
  }

  playlists.forEach((pl, idx)=>
