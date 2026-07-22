const results = document.getElementById("results");
const player = document.getElementById("player");

let lastSearchResults = []; 

async function searchMusic() {
  const q = document.getElementById("search").value.trim();

  if (!q) return;

  results.innerHTML = "<h2>Pesquisando...</h2>";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);

    const data = await res.json();

    if (!data || data.length === 0) {
      results.innerHTML = `
        <div class="empty-state">
          <h2>😕 Nenhuma música encontrada</h2> <br>
          <p>Tente pesquisar outro artista ou título.</p>
        </div>
      `;
      return;
    }

    renderResults(data);

    // Guardar a última pesquisa (agora dentro do escopo correto)
    lastSearchResults = data;
    localStorage.setItem("lastSearchResults", JSON.stringify(data));

  } catch (err) {
    console.error(err);

    results.innerHTML = `
      <div class="empty-state">
        <h2>⚠️ Erro na pesquisa</h2> <br>
        <p>Não foi possível pesquisar músicas.</p>
      </div>
    `;
  }
}

function renderResults(list) {
  results.innerHTML = "";

  list.forEach(song => {
    const card = document.createElement("div");
    card.className = "song";

    const img = document.createElement("img");
    img.src = song.thumbnail;

    const content = document.createElement("div");
    content.className = "song-content";

    const title = document.createElement("h3");
    title.textContent = song.title;

    const author = document.createElement("p");
    author.textContent = song.author;

    const duration = document.createElement("small");
    duration.textContent = song.duration;

    const actions = document.createElement("div");
    actions.className = "actions";

    const playBtn = document.createElement("button");
    playBtn.className = "play-btn";
    playBtn.textContent = "▶";

    const favBtn = document.createElement("button");
    favBtn.className = "favorite-btn";
    favBtn.textContent = "❤️";

    const downloadBtn = document.createElement("a");
    downloadBtn.className = "download-btn";
    downloadBtn.href = `/api/download?url=${encodeURIComponent(song.url)}`;
    downloadBtn.textContent = "⬇";

    playBtn.onclick = async () => {
      try {
        player.pause();
        player.src = `/api/stream?url=${encodeURIComponent(song.url)}`;
        player.load();
        await player.play();

        document.getElementById("now-playing").textContent = song.title;
        document.getElementById("artist-playing").textContent = song.author;
      } catch (err) {
        console.log(err);
      }
    };

    favBtn.onclick = () => saveFavorite(song);

    actions.append(playBtn, favBtn, downloadBtn);
    content.append(title, author, duration, actions);
    card.append(img, content);

    results.appendChild(card);
  });
}

// FAVORITOS
function getFavorites() {
  return JSON.parse(localStorage.getItem("favorites")) || [];
}

function saveFavorite(song) {
  let favorites = getFavorites();
  const exists = favorites.find(s => s.url === song.url);

  if (exists) {
    favorites = favorites.filter(s => s.url !== song.url);
  } else {
    favorites.push(song);
  }

  localStorage.setItem("favorites", JSON.stringify(favorites));
}

function loadFavorites() {
  renderResults(getFavorites());
}

// TRENDING
async function loadTrending() {
  const trends = [
    "Força Suprema", "C4 Pedro", "Chelsea Dinorath",
    "DJ-AKM", "POP SMOKE", "Calema", "Michael Jackson"
  ];

  const random = trends[Math.floor(Math.random() * trends.length)];

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(random)}`);
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error(err);
  }
}

// Carregar última pesquisa ao abrir o site
window.addEventListener("DOMContentLoaded", () => {
  const savedResults = JSON.parse(localStorage.getItem("lastSearchResults")) || [];
  lastSearchResults = savedResults;

  if (savedResults.length > 0) {
    renderResults(savedResults);
  }
  
});

document.getElementById("favoritosBtn").onclick = loadFavorites;
document.getElementById("trendingBtn").onclick = loadTrending;
