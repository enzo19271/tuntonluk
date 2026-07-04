/* =========================================================
   Tunton Luk — Movie detail page logic
   ========================================================= */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function starIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2 15 8.5 22 9.5 17 14.3 18.2 21 12 17.8 5.8 21 7 14.3 2 9.5 9 8.5Z"/></svg>`;
}

function renderNotFound() {
  document.getElementById("detailRoot").innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>Film tidak ditemukan.</p>
      <p><a href="index.html" style="color:var(--cyan);">&larr; Kembali ke Beranda</a></p>
    </div>
  `;
}

function renderError(err) {
  document.getElementById("detailRoot").innerHTML = `
    <div class="empty-state">
      <p>Gagal memuat detail film.<br><span style="font-size:12px;">${escapeHtml(err.message)}</span></p>
    </div>
  `;
}

// Data lama cuma punya `videoUrl` tunggal - perlakukan sebagai satu
// episode "Trailer" biar tetap tampil konsisten.
function getEpisodes(movie) {
  if (Array.isArray(movie.episodes) && movie.episodes.length) return movie.episodes;
  if (movie.videoUrl) return [{ id: "legacy", label: "Trailer", videoUrl: movie.videoUrl }];
  return [];
}

function videoBlockHtml(videoUrl, posterFallback) {
  const embedUrl = getDriveEmbedUrl(videoUrl);
  return embedUrl
    ? `<iframe src="${embedUrl}" allow="autoplay" allowfullscreen></iframe>`
    : `<div class="no-video" style="background-image:url('${posterFallback}')">
         <span>Video belum tersedia untuk film ini.</span>
       </div>`;
}

function renderMovie(movie) {
  const episodes = getEpisodes(movie);
  const firstVideo = episodes[0]?.videoUrl || "";

  const episodeListHtml = episodes.length
    ? `
      <div class="episode-list">
        ${episodes
          .map(
            (ep, idx) => `
          <button type="button" class="episode-btn${idx === 0 ? " active" : ""}" data-video="${escapeHtml(ep.videoUrl)}">
            ${escapeHtml(ep.label)}
          </button>
        `
          )
          .join("")}
      </div>
    `
    : "";

  document.getElementById("detailRoot").innerHTML = `
    <a href="index.html" class="detail-back-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      Kembali ke Beranda
    </a>
    <div class="detail-grid">
      <div>
        <div class="detail-video-wrap" id="detailVideoWrap">${videoBlockHtml(firstVideo, movie.poster)}</div>
        ${episodeListHtml}
      </div>
      <div class="detail-info">
        <h1>${escapeHtml(movie.title)}</h1>
        <div class="detail-meta">
          <span>by ${escapeHtml(movie.author)}</span>
          ${movie.rating ? `<span class="movie-rating">${starIcon()} ${movie.rating}</span>` : ""}
        </div>
        <p class="detail-desc">${escapeHtml(movie.description)}</p>
      </div>
    </div>
  `;

  document.querySelectorAll(".episode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".episode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("detailVideoWrap").innerHTML = videoBlockHtml(btn.dataset.video, movie.poster);
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    renderNotFound();
    return;
  }

  try {
    const movie = await Store.getMovieById(id);
    if (!movie) {
      renderNotFound();
      return;
    }
    document.title = `${movie.title} — Tunton Luk`;
    renderMovie(movie);
  } catch (err) {
    renderError(err);
  }
});
