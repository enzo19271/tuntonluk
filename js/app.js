/* =========================================================
   Tunton Luk — Public site logic (index.html)
   ========================================================= */

let allMovies = [];
let heroData = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function showLoadError(err) {
  const list = document.getElementById("moviesList");
  list.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
      <p>Gagal memuat data film.<br><span style="font-size:12px;">${escapeHtml(err.message)}</span></p>
    </div>
  `;
}

function renderHero() {
  document.getElementById("heroMedia").style.backgroundImage = `url('${heroData.image}')`;
  document.getElementById("heroTitle").textContent = heroData.title;
  document.getElementById("heroDesc").textContent = heroData.description;
  document.getElementById("heroCtaLabel").textContent = heroData.ctaLabel || "Tonton Sekarang";
}

function starIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 15 8.5 22 9.5 17 14.3 18.2 21 12 17.8 5.8 21 7 14.3 2 9.5 9 8.5Z"/></svg>`;
}

function playIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M8 5v14l11-7z"/></svg>`;
}

function movieCardHtml(movie) {
  const detailUrl = `film-detail.html?id=${encodeURIComponent(movie.id)}`;
  return `
    <article class="movie-card" data-id="${movie.id}">
      <a class="poster-link" href="${detailUrl}">
        <img src="${movie.poster}" alt="Poster ${escapeHtml(movie.title)}" loading="lazy" />
      </a>
      <div class="movie-info">
        <div class="movie-title-row">
          <h3><a href="${detailUrl}" style="color:inherit;">${escapeHtml(movie.title)}</a></h3>
          ${movie.rating ? `<span class="movie-rating">${starIcon()} ${movie.rating}</span>` : ""}
        </div>
        <p class="movie-author">by ${escapeHtml(movie.author)}</p>
        <p class="movie-desc">${escapeHtml(movie.description)}</p>
        <a class="movie-btn" href="${detailUrl}">${playIcon()} Tonton</a>
      </div>
    </article>
  `;
}

function renderMovies(filterText = "") {
  const list = document.getElementById("moviesList");
  const empty = document.getElementById("emptyState");
  const query = filterText.trim().toLowerCase();

  const filtered = allMovies.filter((m) =>
    m.title.toLowerCase().includes(query) || m.author.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = filtered.map(movieCardHtml).join("");
}

/* ---------- Drawer ---------- */
function initDrawer() {
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const openBtn = document.getElementById("hamburgerBtn");
  const closeBtn = document.getElementById("drawerClose");

  const open = () => {
    drawer.classList.add("open");
    overlay.classList.add("open");
  };
  const close = () => {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
}

/* ---------- Search (mobile + desktop share the same state) ---------- */
function initSearch() {
  const mobile = document.getElementById("searchMobile");
  const desktop = document.getElementById("searchDesktop");

  const sync = (value, source) => {
    if (source !== "mobile") mobile.value = value;
    if (source !== "desktop") desktop.value = value;
    renderMovies(value);
  };

  mobile.addEventListener("input", (e) => sync(e.target.value, "mobile"));
  desktop.addEventListener("input", (e) => sync(e.target.value, "desktop"));
}

/* ---------- Hero CTA ---------- */
function initHeroCta() {
  document.getElementById("heroCta").addEventListener("click", () => {
    const featuredId = heroData.featuredMovieId;
    const featured = featuredId ? allMovies.find((m) => m.id === featuredId) : null;
    if (featured) {
      window.location.href = `film-detail.html?id=${encodeURIComponent(featured.id)}`;
    } else {
      showToast("Film unggulan belum diatur oleh Admin.");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initDrawer();
  try {
    const data = await Store.getData();
    heroData = data.hero;
    allMovies = data.movies || [];
    renderHero();
    renderMovies();
    initSearch();
    initHeroCta();
  } catch (err) {
    showLoadError(err);
  }
});
