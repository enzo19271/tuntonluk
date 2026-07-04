/* =========================================================
   Tunton Luk — Store
   Wrapper di atas /api/data (yang di baliknya membaca/menulis
   data/movies.json di GitHub). Dipakai bersama oleh index.html,
   admin.html, dan film-detail.html.
   ========================================================= */

const SESSION_KEYS = {
  loggedIn: "tuntonluk_admin_logged_in",
  secret: "tuntonluk_admin_secret",
};

const Store = {
  _cache: null,

  async getData(forceRefresh = false) {
    if (this._cache && !forceRefresh) return this._cache;

    const res = await fetch("/api/data");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Gagal mengambil data film dari server.");
    }
    this._cache = await res.json();
    return this._cache;
  },

  async getMovies(forceRefresh = false) {
    const data = await this.getData(forceRefresh);
    return data.movies || [];
  },

  async getHero(forceRefresh = false) {
    const data = await this.getData(forceRefresh);
    return data.hero || {};
  },

  async getMovieById(id) {
    const movies = await this.getMovies();
    return movies.find((m) => m.id === id) || null;
  },

  async saveData(data) {
    const secret = this.getAdminSecret();
    const res = await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": secret || "",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Gagal menyimpan data ke GitHub.");
    }

    this._cache = data;
    return res.json();
  },

  async login(username, password) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok && body.success) {
      sessionStorage.setItem(SESSION_KEYS.loggedIn, "true");
      // Disimpan hanya di sessionStorage tab admin ini, dipakai sebagai
      // bukti otorisasi saat memanggil POST /api/data.
      sessionStorage.setItem(SESSION_KEYS.secret, password);
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEYS.loggedIn);
    sessionStorage.removeItem(SESSION_KEYS.secret);
  },

  isAdminLoggedIn() {
    return sessionStorage.getItem(SESSION_KEYS.loggedIn) === "true";
  },

  getAdminSecret() {
    return sessionStorage.getItem(SESSION_KEYS.secret);
  },
};
