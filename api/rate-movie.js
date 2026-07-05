/* =========================================================
   /api/rate-movie
   POST { movieId, stars, name, token }
     -> Verifikasi sesi (token dicocokkan dengan HMAC dari
        data/users.json), lalu simpan/perbarui rating bintang
        (1-5) milik pengguna tsb untuk film terkait, dan hitung
        ulang rata-rata dalam skala 10 (stars rata-rata x 2).

   ENV yang dibutuhkan: sama seperti /api/data dan /api/auth
     GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO
     GITHUB_BRANCH   - opsional, default "main"
     DATA_PATH       - opsional, default "data/movie.json"
     SESSION_SECRET  - harus sama dengan yang dipakai /api/auth
   ========================================================= */

import crypto from "node:crypto";

function getConfig() {
  const { GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO, GITHUB_BRANCH, DATA_PATH, SESSION_SECRET } =
    process.env;

  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
    throw new Error(
      "ENV belum lengkap: pastikan GITHUB_TOKEN, GITHUB_USERNAME, dan GITHUB_REPO sudah diset di Vercel."
    );
  }
  if (!SESSION_SECRET) {
    throw new Error("ENV SESSION_SECRET belum diset di Vercel.");
  }

  const branch = GITHUB_BRANCH || "main";
  const moviePath = DATA_PATH || "data/movie.json";
  const usersPath = "data/users.json";

  return {
    GITHUB_TOKEN,
    branch,
    SESSION_SECRET,
    movieApiUrl: `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${moviePath}`,
    usersApiUrl: `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${usersPath}`,
  };
}

async function fetchJson(url, config) {
  const res = await fetch(`${url}?ref=${config.branch}`, {
    headers: {
      Authorization: `token ${config.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gagal mengambil data dari GitHub (${res.status}): ${detail}`);
  }
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  return { data: JSON.parse(content), sha: json.sha };
}

function hashToken(secret, name, pinHash) {
  return crypto.createHmac("sha256", secret).update(`${name.toLowerCase()}:${pinHash}`).digest("hex");
}

async function verifySession(config, name, token) {
  const { data: users } = await fetchJson(config.usersApiUrl, config);
  const user = (users || []).find((u) => u.name.toLowerCase() === String(name).toLowerCase());
  if (!user) return null;
  const expected = hashToken(config.SESSION_SECRET, user.name, user.pinHash);
  if (expected !== token) return null;
  return user;
}

async function saveMovies(config, content, sha) {
  const newContent = Buffer.from(JSON.stringify(content, null, 2)).toString("base64");
  return fetch(config.movieApiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${config.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "chore: update rating publik film Tunton Luk",
      content: newContent,
      sha,
      branch: config.branch,
    }),
  });
}

async function applyRating(config, movieId, userName, stars, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data: content, sha } = await fetchJson(config.movieApiUrl, config);
    if (!content) throw new Error("Data film tidak ditemukan di GitHub.");

    const movies = content.movies || [];
    const idx = movies.findIndex((m) => m.id === movieId);
    if (idx === -1) {
      const err = new Error("Film tidak ditemukan.");
      err.status = 404;
      throw err;
    }

    const movie = { ...movies[idx] };
    const ratings = Array.isArray(movie.ratings) ? [...movie.ratings] : [];
    const existingIdx = ratings.findIndex((r) => r.name.toLowerCase() === userName.toLowerCase());
    const entry = { name: userName, stars, ts: Date.now() };
    if (existingIdx >= 0) ratings[existingIdx] = entry;
    else ratings.push(entry);

    const avgStars = ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length;
    movie.ratings = ratings;
    movie.rating = Math.round(avgStars * 2 * 10) / 10; // konversi ke skala 10, 1 desimal

    movies[idx] = movie;
    const updatedContent = { ...content, movies };

    const putRes = await saveMovies(config, updatedContent, sha);
    if (putRes.ok) return movie;

    if ((putRes.status === 409 || putRes.status === 422) && attempt < maxAttempts) {
      continue; // ada perubahan bersamaan, coba lagi dengan sha terbaru
    }

    const detail = await putRes.text();
    throw new Error(`Gagal menyimpan rating ke GitHub (${putRes.status}): ${detail}`);
  }
  throw new Error("Gagal menyimpan rating setelah beberapa percobaan, coba lagi.");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  const { movieId, stars, name, token } = req.body || {};
  const starNum = Number(stars);

  if (!movieId || !name || !token) {
    res.status(400).json({ error: "Data rating tidak lengkap." });
    return;
  }
  if (!Number.isFinite(starNum) || starNum < 1 || starNum > 5) {
    res.status(400).json({ error: "Rating bintang harus antara 1 sampai 5." });
    return;
  }

  try {
    const user = await verifySession(config, name, token);
    if (!user) {
      res.status(401).json({ error: "Sesi login tidak valid. Silakan muat ulang halaman dan masuk lagi." });
      return;
    }

    const updatedMovie = await applyRating(config, movieId, user.name, starNum);
    res.status(200).json({ success: true, movie: updatedMovie });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: "Gagal menyimpan rating.", detail: err.message });
  }
}
