const results = document.getElementById("results");
const player = document.getElementById("player");

async function searchMusic() {
  const q = document.getElementById("search").value.trim();

  if (!q) return;

  results.innerHTML = "<h2>Pesquisando...</h2>";

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(q)}`
    );

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

    card.innerHTML = `
        <img src="${song.thumbnail}">

        <div class="song-content">
            <h3>${song.title}</h3>
            <p>${song.author}</p>
            <small>${song.duration}</small>

            <div class="actions">
                <button class="play-btn"> ▶ </button>
                <button class="favorite-btn"> ❤️ </button>

                <a class="download-btn" href="/api/download?url=${encodeURIComponent(song.url)}"> ⬇ </a>
            </div>
        </div>
    `;

    // PLAY
    card.querySelector(".play-btn").onclick = async () => {
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

    // FAVORITO
    card.querySelector(".favorite-btn").onclick = () => {
      saveFavorite(song);
    };

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
  const favorites = getFavorites();

  renderResults(favorites);
}

// TRENDING
async function loadTrending() {
  const trends = [
    "Força Suprema",
    "C4 Pedro",
    "Chelsea Dinorath",
    "DJ-AKM",
    "POP SMOKE",
    "Calema",
    "Michael Jackson"
  ];

  // Buscando simulação de tendências
  const random = trends[Math.floor(Math.random() * trends.length)];
  const res = await fetch(`/api/search?q=${encodeURIComponent(random)}`);
  const data = await res.json();

  renderResults(data);
}

// Mantendo os dados da última pesquisa na página inicial
lastSearchResults = data;

localStorage.setItem("lastSearchResults", JSON.stringify(data));

// Ao abrir o site
const savedResults = JSON.parse(localStorage.getItem("lastSearchResults")) || [];

lastSearchResults = savedResults;

// BOTÕES para apresentar as tendências e as favoritas
document.getElementById("favoritosBtn").onclick = loadFavorites;
document.getElementById("trendingBtn").onclick = loadTrending;
