/* =========================================================
   /api/upload-image
   POST -> Terima gambar (base64), simpan sebagai file baru di
           repo GitHub (folder assets/<folder>/...), lalu
           kembalikan URL publik gambar tsb.

   Body JSON:
     {
       filename: "poster.jpg",   // nama asli file (untuk ambil ekstensi)
       contentBase64: "....",   // base64 file, TANPA prefix "data:...;base64,"
       folder: "posters"        // opsional, default "uploads"
     }

   Header wajib:
     X-Admin-Secret  - harus cocok dengan ADMIN_PASSWORD

   ENV yang dibutuhkan (sama seperti /api/data):
     GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO
     GITHUB_BRANCH (opsional, default "main")
   ========================================================= */

const MAX_BYTES = 4 * 1024 * 1024; // ~4MB, aman untuk limit body function Vercel

function getConfig() {
  const { GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO, GITHUB_BRANCH } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
    throw new Error(
      "ENV belum lengkap: pastikan GITHUB_TOKEN, GITHUB_USERNAME, dan GITHUB_REPO sudah diset di Vercel."
    );
  }

  return {
    GITHUB_TOKEN,
    GITHUB_USERNAME,
    GITHUB_REPO,
    branch: GITHUB_BRANCH || "main",
  };
}

function sanitizeFilename(name) {
  const fallback = "gambar.jpg";
  if (!name) return fallback;
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Tidak diizinkan. Silakan login ulang." });
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  const { filename, contentBase64, folder } = req.body || {};

  if (!contentBase64) {
    res.status(400).json({ error: "Tidak ada data gambar yang dikirim." });
    return;
  }

  const approxBytes = (contentBase64.length * 3) / 4;
  if (approxBytes > MAX_BYTES) {
    res.status(400).json({ error: "Ukuran gambar terlalu besar (maksimal sekitar 4MB)." });
    return;
  }

  const safeFolder = (folder || "uploads").replace(/[^a-z0-9/_-]/gi, "") || "uploads";
  const cleanName = sanitizeFilename(filename);
  const path = `assets/${safeFolder}/${Date.now()}-${cleanName}`;
  const apiUrl = `https://api.github.com/repos/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}/contents/${path}`;

  try {
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${config.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: upload gambar ${cleanName} via panel admin Tunton Luk`,
        content: contentBase64,
        branch: config.branch,
      }),
    });

    if (!putRes.ok) {
      const detail = await putRes.text();
      throw new Error(`Gagal upload ke GitHub (${putRes.status}): ${detail}`);
    }

    const url = `https://raw.githubusercontent.com/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}/${config.branch}/${path}`;

    res.status(200).json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: "Gagal upload gambar ke GitHub", detail: err.message });
  }
}
