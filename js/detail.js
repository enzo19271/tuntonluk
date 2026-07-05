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

function ratingWidgetHtml(movie) {
  const ratings = Array.isArray(movie.ratings) ? movie.ratings : [];
  const count = ratings.length;
  const session = window.TuntonAuth ? window.TuntonAuth.getSession() : null;
  const myRating = session
    ? ratings.find((r) => r.name.toLowerCase() === session.name.toLowerCase())
    : null;

  return `
    <div class="rating-widget">
      <div class="rating-widget-label">Beri rating kamu:</div>
      <div class="star-picker" id="starPicker">
        ${[1, 2, 3, 4, 5]
          .map(
            (n) => `
          <button type="button" class="star-btn${myRating && n <= myRating.stars ? " filled" : ""}" data-star="${n}" aria-label="${n} bintang">★</button>
        `
          )
          .join("")}
      </div>
      <div class="rating-widget-meta">${count > 0 ? `${count} orang sudah memberi rating` : "Belum ada yang memberi rating"}</div>
      <div class="rating-widget-status" id="ratingStatus"></div>
    </div>
  `;
}

function bindRatingWidget(movie) {
  const buttons = document.querySelectorAll("#starPicker .star-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const session = window.TuntonAuth ? window.TuntonAuth.getSession() : null;
      if (!session) {
        alert("Sesi login tidak ditemukan. Silakan muat ulang halaman.");
        return;
      }

      const stars = Number(btn.dataset.star);
      buttons.forEach((b, i) => b.classList.toggle("filled", i < stars));

      const statusEl = document.getElementById("ratingStatus");
      statusEl.textContent = "Menyimpan rating...";
      buttons.forEach((b) => (b.disabled = true));

      try {
        const res = await fetch("/api/rate-movie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movieId: movie.id, stars, name: session.name, token: session.token }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Gagal menyimpan rating.");

        statusEl.textContent = "Rating kamu tersimpan. Terima kasih!";
        const updated = await Store.getMovieById(movie.id, true);
        if (updated) renderMovie(updated);
      } catch (err) {
        statusEl.textContent = `Gagal: ${err.message}`;
        buttons.forEach((b) => (b.disabled = false));
      }
    });
  });
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
        ${ratingWidgetHtml(movie)}
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

  bindRatingWidget(movie);
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
