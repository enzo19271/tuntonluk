/* =========================================================
   /api/data
   GET  -> ambil isi data/movies.json terbaru langsung dari GitHub
   POST -> timpa data/movies.json di GitHub dengan data baru
           (butuh header X-Admin-Secret yang cocok dengan ADMIN_PASSWORD)

   ENV yang dibutuhkan (set di Vercel Project Settings > Environment
   Variables):
     GITHUB_TOKEN     - Personal Access Token (scope: repo)
     GITHUB_USERNAME  - username / organisasi pemilik repo
     GITHUB_REPO      - nama repo, contoh: tuntonluk
     ADMIN_PASSWORD   - password admin (dicocokkan saat POST & login)
     ADMIN_USERNAME   - username admin (dicocokkan saat login)
     DATA_PATH        - opsional, default "data/movies.json"
     GITHUB_BRANCH    - opsional, default "main"
   ========================================================= */

function getConfig() {
  const {
    GITHUB_TOKEN,
    GITHUB_USERNAME,
    GITHUB_REPO,
    DATA_PATH,
    GITHUB_BRANCH,
  } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
    throw new Error(
      "ENV belum lengkap: pastikan GITHUB_TOKEN, GITHUB_USERNAME, dan GITHUB_REPO sudah diset di Vercel."
    );
  }

  const path = DATA_PATH || "data/movie.json";
  const branch = GITHUB_BRANCH || "main";
  const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;

  return { GITHUB_TOKEN, apiUrl, branch };
}

async function fetchFile({ GITHUB_TOKEN, apiUrl, branch }) {
  const res = await fetch(`${apiUrl}?ref=${branch}`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gagal mengambil file dari GitHub (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  return { content: JSON.parse(content), sha: json.sha };
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
    try {
      const { content } = await fetchFile(config);
      res.status(200).json(content);
    } catch (err) {
      res.status(500).json({ error: "Gagal mengambil data film", detail: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Tidak diizinkan. Silakan login ulang." });
      return;
    }

    try {
      const { sha } = await fetchFile(config);
      const newContent = Buffer.from(JSON.stringify(req.body, null, 2)).toString("base64");

      const putRes = await fetch(config.apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${config.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "chore: update data film via panel admin Tunton Luk",
          content: newContent,
          sha,
          branch: config.branch,
        }),
      });

      if (!putRes.ok) {
        const detail = await putRes.text();
        throw new Error(`Gagal menyimpan ke GitHub (${putRes.status}): ${detail}`);
      }

      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Gagal menyimpan data film", detail: err.message });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
