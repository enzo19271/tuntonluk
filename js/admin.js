/* =========================================================
   Tunton Luk — Admin panel logic
   ========================================================= */

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");

let workingData = null; // { hero, movies } - in-memory copy while editing

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

function showAdminError(message) {
  const banner = document.getElementById("adminErrorBanner");
  banner.textContent = message;
  banner.style.display = "block";
}

function clearAdminError() {
  document.getElementById("adminErrorBanner").style.display = "none";
}

/* ---------- Auth gate ---------- */
async function checkAuth() {
  if (Store.isAdminLoggedIn()) {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    await initDashboard();
  } else {
    loginView.style.display = "flex";
    dashboardView.style.display = "none";
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmitBtn");

  errorBox.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Memeriksa...";

  try {
    const ok = await Store.login(username, password);
    if (ok) {
      await checkAuth();
    } else {
      errorBox.textContent = "Username atau password salah. Silakan coba lagi.";
    }
  } catch (err) {
    errorBox.textContent = `Gagal terhubung ke server: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Masuk";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  Store.logout();
  document.getElementById("loginForm").reset();
  checkAuth();
});

/* ---------- Dashboard ---------- */
let dashboardInitialized = false;

async function initDashboard() {
  clearAdminError();
  try {
    workingData = await Store.getData(true);
  } catch (err) {
    showAdminError(
      `Gagal memuat data dari GitHub. Periksa ENV GITHUB_TOKEN / GITHUB_USERNAME / GITHUB_REPO di Vercel. Detail: ${err.message}`
    );
    return;
  }

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

  document.querySelectorAll(".image-field").forEach(initImageField);

  document.getElementById("addEpisodeBtn").addEventListener("click", () => {
    document.getElementById("episodeListEditor").insertAdjacentHTML("beforeend", episodeRowHtml());
    bindEpisodeRemoveButtons();
  });
}

/* ---------- Episode rows (Trailer / Eps 01 / Eps 02 / ...) ---------- */
function episodeRowHtml(ep = {}) {
  return `
    <div class="episode-row" data-id="${ep.id || ""}">
      <input type="text" class="episode-label" placeholder="Label (mis. Trailer, Eps 01)" value="${escapeHtml(ep.label || "")}" />
      <input type="text" class="episode-url" placeholder="https://drive.google.com/file/d/xxxxx/view" value="${escapeHtml(ep.videoUrl || "")}" />
      <button type="button" class="icon-btn danger episode-remove-btn" aria-label="Hapus episode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  `;
}

function bindEpisodeRemoveButtons() {
  document.querySelectorAll(".episode-remove-btn").forEach((btn) => {
    btn.onclick = () => btn.closest(".episode-row").remove();
  });
}

function renderEpisodeRows(episodes) {
  const wrap = document.getElementById("episodeListEditor");
  wrap.innerHTML = episodes.map(episodeRowHtml).join("");
  bindEpisodeRemoveButtons();
}

// Data lama cuma punya `videoUrl` tunggal (belum ada `episodes`) -
// perlakukan sebagai satu episode "Trailer" biar tetap tampil di editor.
function getEpisodesForEdit(movie) {
  if (!movie) return [];
  if (Array.isArray(movie.episodes) && movie.episodes.length) return movie.episodes;
  if (movie.videoUrl) return [{ id: "legacy", label: "Trailer", videoUrl: movie.videoUrl }];
  return [];
}

/* ---------- Image field (Link URL / Upload Gambar toggle) ---------- */
const imageFieldControllers = {};

function initImageField(container) {
  const inputId = container.dataset.input;
  const folder = container.dataset.folder || "uploads";
  const urlInput = document.getElementById(inputId);
  const fileInput = document.getElementById(`${inputId}_file`);
  const statusEl = document.getElementById(`${inputId}_uploadStatus`);
  const previewImg = document.getElementById(`${inputId}_preview`);
  const linkPanel = container.querySelector('[data-mode-panel="link"]');
  const uploadPanel = container.querySelector('[data-mode-panel="upload"]');
  const toggleBtns = container.querySelectorAll(".toggle-btn");

  function setMode(mode) {
    toggleBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    linkPanel.style.display = mode === "link" ? "" : "none";
    uploadPanel.style.display = mode === "upload" ? "" : "none";
  }

  toggleBtns.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

  function updateThumbPreview() {
    if (!previewImg) return;
    const val = urlInput.value.trim();
    if (val) {
      previewImg.src = val;
      previewImg.style.display = "block";
    } else {
      previewImg.style.display = "none";
    }
  }
  urlInput.addEventListener("input", updateThumbPreview);

  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (file.size > 4 * 1024 * 1024) {
        statusEl.textContent = "Ukuran gambar terlalu besar (maksimal sekitar 4MB).";
        return;
      }

      statusEl.textContent = "Mengupload ke GitHub...";
      try {
        const url = await Store.uploadImage(file, folder);
        urlInput.value = url;
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
        statusEl.textContent = "Berhasil diupload ✓";
        setMode("link");
        fileInput.value = "";
      } catch (err) {
        statusEl.textContent = `Gagal upload: ${err.message}`;
      }
    });
  }

  imageFieldControllers[inputId] = {
    reset() {
      setMode("link");
      if (fileInput) fileInput.value = "";
      if (statusEl) statusEl.textContent = "Gambar akan diupload & disimpan ke repo GitHub kamu.";
      updateThumbPreview();
    },
  };

  updateThumbPreview();
}

async function persist(successMessage) {
  try {
    await Store.saveData(workingData);
    showToast(successMessage);
    clearAdminError();
    return true;
  } catch (err) {
    showAdminError(`Gagal menyimpan ke GitHub: ${err.message}`);
    return false;
  }
}

/* ---------- Hero editor ---------- */
function renderHeroForm() {
  const hero = workingData.hero || {};
  document.getElementById("heroTitleInput").value = hero.title || "";
  document.getElementById("heroDescInput").value = hero.description || "";
  document.getElementById("heroImageInput").value = hero.image || "";
  document.getElementById("heroCtaInput").value = hero.ctaLabel || "Tonton Sekarang";

  const select = document.getElementById("heroFeaturedInput");
  select.innerHTML = (workingData.movies || [])
    .map((m) => `<option value="${m.id}">${escapeHtml(m.title)}</option>`)
    .join("");
  select.value = hero.featuredMovieId || "";

  updateHeroPreview();
}

function updateHeroPreview() {
  document.getElementById("heroPreviewImg").src = document.getElementById("heroImageInput").value;
  document.getElementById("heroPreviewTitle").textContent = document.getElementById("heroTitleInput").value;
}

async function handleHeroSave(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  workingData.hero = {
    title: document.getElementById("heroTitleInput").value.trim(),
    description: document.getElementById("heroDescInput").value.trim(),
    image: document.getElementById("heroImageInput").value.trim(),
    ctaLabel: document.getElementById("heroCtaInput").value.trim(),
    featuredMovieId: document.getElementById("heroFeaturedInput").value,
  };

  await persist("Banner hero berhasil disimpan ke GitHub");
  btn.disabled = false;
  btn.textContent = "Simpan Banner";
}

function episodeBadge(movie) {
  const count = Array.isArray(movie.episodes) ? movie.episodes.length : 0;
  if (count > 0) return `🎬 ${count} eps`;
  if (movie.videoUrl) return "🎬"; // data lama belum dimigrasi
  return "";
}

/* ---------- Movie table ---------- */
function renderMovieTable() {
  const movies = workingData.movies || [];
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
      <td>${escapeHtml(m.title)} ${episodeBadge(m)}</td>
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
      const movie = workingData.movies.find((m) => m.id === id);
      openMovieModal(movie);
    });
  });

  body.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const id = row.dataset.id;
      const movie = workingData.movies.find((m) => m.id === id);
      if (!confirm(`Hapus film "${movie.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;

      btn.disabled = true;
      workingData.movies = workingData.movies.filter((m) => m.id !== id);
      const ok = await persist(`Film "${movie.title}" berhasil dihapus`);
      if (!ok) {
        // rollback in-memory change if save failed
        workingData.movies.push(movie);
      }
      renderMovieTable();
      renderHeroForm();
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
  renderEpisodeRows(getEpisodesForEdit(movie));

  if (imageFieldControllers.moviePoster) imageFieldControllers.moviePoster.reset();

  modal.classList.add("open");
}

function closeMovieModal() {
  document.getElementById("movieModal").classList.remove("open");
}

async function handleMovieSave(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("modalSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  const id = document.getElementById("movieId").value;

  const episodeRows = Array.from(document.querySelectorAll("#episodeListEditor .episode-row"));
  const episodes = [];
  for (const row of episodeRows) {
    const label = row.querySelector(".episode-label").value.trim();
    const url = row.querySelector(".episode-url").value.trim();
    if (!label && !url) continue; // baris kosong, lewati saja

    if (!url || !extractDriveFileId(url)) {
      alert(
        `Link Google Drive untuk episode "${label || "(tanpa label)"}" tidak dikenali. Pastikan formatnya seperti https://drive.google.com/file/d/FILE_ID/view`
      );
      submitBtn.disabled = false;
      submitBtn.textContent = id ? "Simpan Perubahan" : "Simpan Film";
      return;
    }

    episodes.push({
      id: row.dataset.id && row.dataset.id !== "legacy" ? row.dataset.id : "ep" + Date.now() + episodes.length,
      label: label || `Episode ${episodes.length + 1}`,
      videoUrl: url,
    });
  }

  const payload = {
    title: document.getElementById("movieTitle").value.trim(),
    author: document.getElementById("movieAuthor").value.trim(),
    rating: document.getElementById("movieRating").value
      ? parseFloat(document.getElementById("movieRating").value)
      : null,
    poster: document.getElementById("moviePoster").value.trim(),
    description: document.getElementById("movieDescription").value.trim(),
    episodes,
  };

  if (id) {
    const idx = workingData.movies.findIndex((m) => m.id === id);
    const merged = { ...workingData.movies[idx], ...payload };
    delete merged.videoUrl; // field lama sudah digantikan oleh `episodes`
    workingData.movies[idx] = merged;
  } else {
    payload.id = "m" + Date.now();
    workingData.movies.unshift(payload);
  }

  const ok = await persist(id ? `Film "${payload.title}" berhasil diperbarui` : `Film "${payload.title}" berhasil ditambahkan`);

  submitBtn.disabled = false;
  submitBtn.textContent = id ? "Simpan Perubahan" : "Simpan Film";

  if (ok) {
    closeMovieModal();
    renderMovieTable();
    renderHeroForm();
  }
}

document.addEventListener("DOMContentLoaded", checkAuth);
