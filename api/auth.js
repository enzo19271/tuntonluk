/* =========================================================
   /api/auth
   POST { name, pin } -> Login sekaligus Registrasi.

   Alur:
     - Kalau nama belum terdaftar di data/users.json -> otomatis
       didaftarkan dengan PIN yang dikirim (register).
     - Kalau nama sudah terdaftar -> PIN wajib cocok (login).
     - Sukses -> mengembalikan { success, name, token }.
       `token` adalah HMAC(SESSION_SECRET, nama + hash PIN) yang
       disimpan di localStorage klien dan dipakai ulang saat
       submit rating (klien tidak perlu kirim PIN lagi tiap saat).

   ENV yang dibutuhkan:
     GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO
     GITHUB_BRANCH   - opsional, default "main"
     SESSION_SECRET  - teks acak rahasia untuk menandatangani token
   ========================================================= */

import crypto from "node:crypto";

function getConfig() {
  const { GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO, GITHUB_BRANCH, SESSION_SECRET } =
    process.env;

  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
    throw new Error(
      "ENV belum lengkap: pastikan GITHUB_TOKEN, GITHUB_USERNAME, dan GITHUB_REPO sudah diset di Vercel."
    );
  }
  if (!SESSION_SECRET) {
    throw new Error(
      "ENV SESSION_SECRET belum diset di Vercel. Isi dengan teks acak bebas (rahasia, jangan dibagikan)."
    );
  }

  const branch = GITHUB_BRANCH || "main";
  const path = "data/users.json";
  const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;

  return { GITHUB_TOKEN, apiUrl, branch, SESSION_SECRET };
}

async function fetchUsers(config) {
  const res = await fetch(`${config.apiUrl}?ref=${config.branch}`, {
    headers: {
      Authorization: `token ${config.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (res.status === 404) {
    return { users: [], sha: null };
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gagal mengambil data pengguna dari GitHub (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  return { users: JSON.parse(content || "[]"), sha: json.sha };
}

async function saveUsers(config, users, sha) {
  const content = Buffer.from(JSON.stringify(users, null, 2)).toString("base64");
  const res = await fetch(config.apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${config.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "chore: registrasi pengguna baru Tunton Luk",
      content,
      ...(sha ? { sha } : {}),
      branch: config.branch,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Gagal menyimpan data pengguna ke GitHub (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }
}

function hashPin(name, pin) {
  return crypto.createHash("sha256").update(`${name.toLowerCase()}:${pin}`).digest("hex");
}

function makeToken(secret, name, pinHash) {
  return crypto.createHmac("sha256", secret).update(`${name.toLowerCase()}:${pinHash}`).digest("hex");
}

// Mendaftarkan pengguna baru dengan retry, untuk menghindari konflik
// kalau dua orang mendaftar dengan nama berbeda di waktu bersamaan.
async function registerWithRetry(config, cleanName, pinHash, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { users, sha } = await fetchUsers(config);

    // Cek ulang siapa tahu nama ini baru saja didaftarkan pengguna lain
    const existing = users.find((u) => u.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return { conflictExisting: existing };
    }

    const newUser = { name: cleanName, pinHash, createdAt: Date.now() };
    try {
      await saveUsers(config, [...users, newUser], sha);
      return { newUser };
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      // lanjut ke percobaan berikutnya dengan sha terbaru
    }
  }
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

  const { name, pin } = req.body || {};
  const cleanName = (name || "").trim();
  const cleanPin = (pin || "").trim();

  if (!cleanName || cleanName.length < 2 || cleanName.length > 30) {
    res.status(400).json({ error: "Nama harus diisi (2-30 karakter)." });
    return;
  }
  if (!/^\d{4}$/.test(cleanPin)) {
    res.status(400).json({ error: "PIN harus 4 digit angka." });
    return;
  }

  try {
    const { users } = await fetchUsers(config);
    const existing = users.find((u) => u.name.toLowerCase() === cleanName.toLowerCase());
    const pinHash = hashPin(cleanName, cleanPin);

    if (existing) {
      if (existing.pinHash !== pinHash) {
        res.status(401).json({ error: "Nama sudah terdaftar, tapi PIN yang kamu masukkan salah." });
        return;
      }
      const token = makeToken(config.SESSION_SECRET, existing.name, existing.pinHash);
      res.status(200).json({ success: true, name: existing.name, token, isNew: false });
      return;
    }

    const result = await registerWithRetry(config, cleanName, pinHash);

    if (result.conflictExisting) {
      if (result.conflictExisting.pinHash !== pinHash) {
        res.status(401).json({ error: "Nama sudah terdaftar, tapi PIN yang kamu masukkan salah." });
        return;
      }
      const token = makeToken(config.SESSION_SECRET, result.conflictExisting.name, result.conflictExisting.pinHash);
      res.status(200).json({ success: true, name: result.conflictExisting.name, token, isNew: false });
      return;
    }

    const token = makeToken(config.SESSION_SECRET, result.newUser.name, result.newUser.pinHash);
    res.status(200).json({ success: true, name: result.newUser.name, token, isNew: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal memproses login/registrasi.", detail: err.message });
  }
}
