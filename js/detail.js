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

function renderMovie(movie) {
  const embedUrl = getDriveEmbedUrl(movie.videoUrl);

  const videoBlock = embedUrl
    ? `<iframe src="${embedUrl}" allow="autoplay" allowfullscreen></iframe>`
    : `<div class="no-video" style="background-image:url('${movie.poster}')">
         <span>Video belum tersedia untuk film ini.</span>
       </div>`;

  document.getElementById("detailRoot").innerHTML = `
    <a href="index.html" class="detail-back-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      Kembali ke Beranda
    </a>
    <div class="detail-grid">
      <div>
        <div class="detail-video-wrap">${videoBlock}</div>
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
