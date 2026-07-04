/* =========================================================
   Tunton Luk — Storage Helper
   Wrapper kecil di atas localStorage supaya index.html dan
   admin.html selalu membaca/menulis sumber data yang sama.
   ========================================================= */

const STORAGE_KEYS = {
  movies: "tuntonluk_movies",
  hero: "tuntonluk_hero",
  session: "tuntonluk_admin_session",
};

const Store = {
  getMovies() {
    const raw = localStorage.getItem(STORAGE_KEYS.movies);
    if (!raw) {
      this.saveMovies(DEFAULT_MOVIES);
      return [...DEFAULT_MOVIES];
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [...DEFAULT_MOVIES];
    }
  },

  saveMovies(movies) {
    localStorage.setItem(STORAGE_KEYS.movies, JSON.stringify(movies));
  },

  addMovie(movie) {
    const movies = this.getMovies();
    movie.id = "m" + Date.now();
    movies.unshift(movie);
    this.saveMovies(movies);
    return movie;
  },

  updateMovie(id, updates) {
    const movies = this.getMovies();
    const idx = movies.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    movies[idx] = { ...movies[idx], ...updates };
    this.saveMovies(movies);
    return movies[idx];
  },

  deleteMovie(id) {
    const movies = this.getMovies().filter((m) => m.id !== id);
    this.saveMovies(movies);
  },

  getHero() {
    const raw = localStorage.getItem(STORAGE_KEYS.hero);
    if (!raw) {
      this.saveHero(DEFAULT_HERO);
      return { ...DEFAULT_HERO };
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { ...DEFAULT_HERO };
    }
  },

  saveHero(hero) {
    localStorage.setItem(STORAGE_KEYS.hero, JSON.stringify(hero));
  },

  isAdminLoggedIn() {
    return sessionStorage.getItem(STORAGE_KEYS.session) === "true";
  },

  setAdminLoggedIn(value) {
    sessionStorage.setItem(STORAGE_KEYS.session, value ? "true" : "false");
  },

  resetToDefaults() {
    this.saveMovies(DEFAULT_MOVIES);
    this.saveHero(DEFAULT_HERO);
  },
};
