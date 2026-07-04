/* =========================================================
   /api/login
   POST { username, password } -> { success: boolean }

   Kredensial dicocokkan dengan ENV di Vercel:
     ADMIN_USERNAME
     ADMIN_PASSWORD
   ========================================================= */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    res.status(500).json({
      error: "ENV belum lengkap: set ADMIN_USERNAME dan ADMIN_PASSWORD di Vercel.",
    });
    return;
  }

  const { username, password } = req.body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Username atau password salah." });
  }
}
