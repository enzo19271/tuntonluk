/* =========================================================
   /api/comments
   POST   { movieId, name, text, token }
          -> Submit komentar baru, verifikasi sesi, simpan ke GitHub

   GET    ?movieId=...
          -> Ambil daftar komentar film (public, no auth needed)

   DELETE { movieId, commentId, secret }
          -> Hapus komentar (hanya admin, pakai X-Admin-Secret header)

   ENV yang dibutuhkan: sama seperti /api/rate-movie
     GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO
     DATA_PATH (opsional, default "data/movie.json")
     SESSION_SECRET (untuk verifikasi sesi publik)
     ADMIN_PASSWORD (untuk verifikasi admin saat delete)
   ========================================================= */

import crypto from "node:crypto";

function getConfig() {
  const {
    GITHUB_TOKEN,
    GITHUB_USERNAME,
    GITHUB_REPO,
    GITHUB_BRANCH,
    DATA_PATH,
    SESSION_SECRET,
  } = process.env;

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
      message: "chore: update komentar film Tunton Luk",
      content: newContent,
      sha,
      branch: config.branch,
    }),
  });
}

async function submitComment(config, movieId, name, text, maxAttempts = 4) {
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
    const comments = Array.isArray(movie.comments) ? [...movie.comments] : [];

    const now = Date.now();
    const isoDate = new Date(now).toISOString();
    const newComment = {
      id: `c_${now}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      text,
      ts: now,
      createdAt: isoDate,
    };

    comments.push(newComment);
    movie.comments = comments;
    movies[idx] = movie;
    const updatedContent = { ...content, movies };

    const putRes = await saveMovies(config, updatedContent, sha);
    if (putRes.ok) return { comment: newComment, movie };

    if ((putRes.status === 409 || putRes.status === 422) && attempt < maxAttempts) {
      continue;
    }

    const detail = await putRes.text();
    throw new Error(`Gagal menyimpan komentar ke GitHub (${putRes.status}): ${detail}`);
  }
  throw new Error("Gagal menyimpan komentar setelah beberapa percobaan, coba lagi.");
}

async function deleteComment(config, movieId, commentId, maxAttempts = 4) {
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
    const comments = Array.isArray(movie.comments) ? [...movie.comments] : [];
    const commentIdx = comments.findIndex((c) => c.id === commentId);
    if (commentIdx === -1) {
      const err = new Error("Komentar tidak ditemukan.");
      err.status = 404;
      throw err;
    }

    comments.splice(commentIdx, 1);
    movie.comments = comments;
    movies[idx] = movie;
    const updatedContent = { ...content, movies };

    const putRes = await saveMovies(config, updatedContent, sha);
    if (putRes.ok) return movie;

    if ((putRes.status === 409 || putRes.status === 422) && attempt < maxAttempts) {
      continue;
    }

    const detail = await putRes.text();
    throw new Error(`Gagal menghapus komentar dari GitHub (${putRes.status}): ${detail}`);
  }
  throw new Error("Gagal menghapus komentar setelah beberapa percobaan, coba lagi.");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let config;
  try {
    config = getConfig();
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  if (req.method === "GET") {
    const { movieId } = req.query;
    if (!movieId) {
      res.status(400).json({ error: "Parameter movieId wajib diisi." });
      return;
    }

    try {
      const { data: content } = await fetchJson(config.movieApiUrl, config);
      if (!content) {
        res.status(404).json({ error: "Data film tidak ditemukan." });
        return;
      }

      const movie = (content.movies || []).find((m) => m.id === movieId);
      if (!movie) {
        res.status(404).json({ error: "Film tidak ditemukan." });
        return;
      }

      const comments = (movie.comments || []).sort((a, b) => b.ts - a.ts);
      res.status(200).json({ comments });
    } catch (err) {
      res.status(500).json({ error: "Gagal mengambil komentar.", detail: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    const { movieId, name, text, token } = req.body || {};

    if (!movieId || !name || !text || !token) {
      res.status(400).json({ error: "Data komentar tidak lengkap." });
      return;
    }

    const trimmedText = String(text).trim();
    if (trimmedText.length === 0 || trimmedText.length > 500) {
      res.status(400).json({ error: "Komentar harus antara 1-500 karakter." });
      return;
    }

    try {
      const user = await verifySession(config, name, token);
      if (!user) {
        res.status(401).json({ error: "Sesi login tidak valid. Silakan muat ulang halaman." });
        return;
      }

      const result = await submitComment(config, movieId, user.name, trimmedText);
      res.status(200).json({ success: true, comment: result.comment, movie: result.movie });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: "Gagal menyimpan komentar.", detail: err.message });
    }
    return;
  }

  if (req.method === "DELETE") {
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Tidak diizinkan. Hanya admin yang bisa menghapus komentar." });
      return;
    }

    const { movieId, commentId } = req.body || {};
    if (!movieId || !commentId) {
      res.status(400).json({ error: "Parameter movieId dan commentId wajib diisi." });
      return;
    }

    try {
      const movie = await deleteComment(config, movieId, commentId);
      res.status(200).json({ success: true, movie });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: "Gagal menghapus komentar.", detail: err.message });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

