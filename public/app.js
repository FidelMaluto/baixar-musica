const results = document.getElementById("results");
const player = document.getElementById("player");

async function searchMusic() {
  const q = document.getElementById("search").value;

  if (!q) return;

  results.innerHTML = "<h2>Pesquisando...</h2>";

  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();

  renderResults(data);
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

                    <a class="download-btn"
                        href="/api/download?url=${encodeURIComponent(song.url)}"> ⬇ Baixar
                    </a>
                </div>
            </div>
        `;

    card.querySelector(".play-btn").onclick = () => {

        player.src = `/api/stream?url=${encodeURIComponent(song.url)}`;

        player.play();

        document.getElementById("now-playing").textContent = song.title;
        document.getElementById("artist-playing").textContent = song.author;
      };

    results.appendChild(card);
  });
}
