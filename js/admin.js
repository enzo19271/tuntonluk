/* =========================================================
   Tunton Luk — Admin panel logic
   ========================================================= */

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ---------- Auth gate ---------- */
function checkAuth() {
  if (Store.isAdminLoggedIn()) {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    initDashboard();
  } else {
    loginView.style.display = "flex";
    dashboardView.style.display = "none";
  }
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("loginError");

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    Store.setAdminLoggedIn(true);
    errorBox.textContent = "";
    checkAuth();
  } else {
    errorBox.textContent = "Username atau password salah. Silakan coba lagi.";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  Store.setAdminLoggedIn(false);
  document.getElementById("loginForm").reset();
  checkAuth();
});

/* ---------- Dashboard ---------- */
let dashboardInitialized = false;

function initDashboard() {
  renderHeroForm();
  renderMovieTable();

  if (dashboardInitialized) return;
  dashboardInitialized = true;

  document.getElementById("heroForm").addEventListener("submit", handleHeroSave);
  document.getElementById("addMovieBtn").addEventListener("click", () => openMovieModal());
  document.getElementById("modalCloseBtn").addEventListener("click", closeMovieModal);
  document.getElementById("modalCancelBtn").addEventListener("click", closeMovieModal);
  document.getElementById("movieModal").addEventListener("click", (e) => {
    if (e.target.id === "movieModal") closeMovieModal();
  });
  document.getElementById("movieForm").addEventListener("submit", handleMovieSave);

  ["heroTitleInput", "heroImageInput"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateHeroPreview);
  });
}

/* ---------- Hero editor ---------- */
function renderHeroForm() {
  const hero = Store.getHero();
  document.getElementById("heroTitleInput").value = hero.title;
  document.getElementById("heroDescInput").value = hero.description;
  document.getElementById("heroImageInput").value = hero.image;
  document.getElementById("heroCtaInput").value = hero.ctaLabel || "Tonton Sekarang";
  updateHeroPreview();
}

function updateHeroPreview() {
  document.getElementById("heroPreviewImg").src = document.getElementById("heroImageInput").value;
  document.getElementById("heroPreviewTitle").textContent = document.getElementById("heroTitleInput").value;
}

function handleHeroSave(e) {
  e.preventDefault();
  const hero = {
    title: document.getElementById("heroTitleInput").value.trim(),
    description: document.getElementById("heroDescInput").value.trim(),
    image: document.getElementById("heroImageInput").value.trim(),
    ctaLabel: document.getElementById("heroCtaInput").value.trim(),
  };
  Store.saveHero(hero);
  showToast("Banner hero berhasil disimpan");
}

/* ---------- Movie table ---------- */
function renderMovieTable() {
  const movies = Store.getMovies();
  const body = document.getElementById("movieTableBody");

  if (movies.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); padding:30px;">Belum ada film. Klik "Tambah Film" untuk menambahkan.</td></tr>`;
    return;
  }

  body.innerHTML = movies
    .map(
      (m) => `
    <tr data-id="${m.id}">
      <td><div class="table-thumb"><img src="${m.poster}" alt="${escapeHtml(m.title)}" /></div></td>
      <td>${escapeHtml(m.title)}</td>
      <td>${escapeHtml(m.author)}</td>
      <td>${m.rating ?? "-"}</td>
      <td>
        <div class="table-actions">
          <button class="icon-btn edit-btn" aria-label="Edit ${escapeHtml(m.title)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn danger delete-btn" aria-label="Hapus ${escapeHtml(m.title)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  body.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("tr").dataset.id;
      const movie = Store.getMovies().find((m) => m.id === id);
      openMovieModal(movie);
    });
  });

  body.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const id = row.dataset.id;
      const movie = Store.getMovies().find((m) => m.id === id);
      if (confirm(`Hapus film "${movie.title}"? Tindakan ini tidak bisa dibatalkan.`)) {
        Store.deleteMovie(id);
        renderMovieTable();
        showToast(`Film "${movie.title}" berhasil dihapus`);
      }
    });
  });
}

/* ---------- Movie modal (Add / Edit) ---------- */
function openMovieModal(movie = null) {
  const modal = document.getElementById("movieModal");
  const form = document.getElementById("movieForm");
  form.reset();

  document.getElementById("modalTitle").textContent = movie ? "Edit Film" : "Tambah Film";
  document.getElementById("modalSubmitBtn").textContent = movie ? "Simpan Perubahan" : "Simpan Film";
  document.getElementById("movieId").value = movie ? movie.id : "";
  document.getElementById("movieTitle").value = movie ? movie.title : "";
  document.getElementById("movieAuthor").value = movie ? movie.author : "";
  document.getElementById("movieRating").value = movie ? movie.rating ?? "" : "";
  document.getElementById("moviePoster").value = movie ? movie.poster : "";
  document.getElementById("movieDescription").value = movie ? movie.description : "";

  modal.classList.add("open");
}

function closeMovieModal() {
  document.getElementById("movieModal").classList.remove("open");
}

function handleMovieSave(e) {
  e.preventDefault();
  const id = document.getElementById("movieId").value;
  const payload = {
    title: document.getElementById("movieTitle").value.trim(),
    author: document.getElementById("movieAuthor").value.trim(),
    rating: document.getElementById("movieRating").value
      ? parseFloat(document.getElementById("movieRating").value)
      : null,
    poster: document.getElementById("moviePoster").value.trim(),
    description: document.getElementById("movieDescription").value.trim(),
  };

  if (id) {
    Store.updateMovie(id, payload);
    showToast(`Film "${payload.title}" berhasil diperbarui`);
  } else {
    Store.addMovie(payload);
    showToast(`Film "${payload.title}" berhasil ditambahkan`);
  }

  closeMovieModal();
  renderMovieTable();
}

document.addEventListener("DOMContentLoaded", checkAuth);
