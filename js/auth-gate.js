/* =========================================================
   Tunton Luk — Auth Gate
   Menampilkan modal "Masuk / Daftar" (nama + PIN 4 digit) di
   semua laman publik selama pengunjung belum punya sesi
   tersimpan di localStorage. Dipakai bersama oleh index.html,
   film-detail.html, dan about.html.
   ========================================================= */

(function () {
  const SESSION_KEY = "tuntonluk_session";

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function updateUserUI(name) {
    document.querySelectorAll(".auth-user-label").forEach((el) => {
      el.textContent = name ? `Halo, ${name}` : "";
    });
  }

  function buildGateMarkup() {
    if (document.getElementById("authGate")) return;

    const wrap = document.createElement("div");
    wrap.id = "authGate";
    wrap.className = "auth-gate";
    wrap.innerHTML = `
      <div class="auth-gate-card">
        <div class="auth-gate-logo">Tunton<span class="accent">Luk</span></div>
        <p class="auth-gate-desc">
          Masukkan nama & PIN 4 digit untuk masuk. Kalau namamu belum
          terdaftar, akun otomatis dibuatkan.
        </p>
        <form id="authGateForm">
          <input type="text" id="authGateName" placeholder="Nama kamu" maxlength="30" required autocomplete="name" />
          <input type="password" id="authGatePin" placeholder="PIN 4 digit" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" required autocomplete="off" />
          <div class="auth-gate-error" id="authGateError"></div>
          <button type="submit" class="btn-gradient" id="authGateSubmit" style="width:100%; justify-content:center;">Masuk / Daftar</button>
        </form>
        <p class="auth-gate-hint">
          PIN ini bukan untuk keamanan tingkat tinggi — cukup supaya nama kamu
          tidak dipakai orang lain untuk memberi rating. Ingat baik-baik PIN-mu.
        </p>
      </div>
    `;
    document.body.appendChild(wrap);

    const form = wrap.querySelector("#authGateForm");
    const errorEl = wrap.querySelector("#authGateError");
    const submitBtn = wrap.querySelector("#authGateSubmit");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.textContent = "";

      const name = wrap.querySelector("#authGateName").value.trim();
      const pin = wrap.querySelector("#authGatePin").value.trim();

      if (!name || name.length < 2) {
        errorEl.textContent = "Nama minimal 2 karakter.";
        return;
      }
      if (!/^\d{4}$/.test(pin)) {
        errorEl.textContent = "PIN harus 4 digit angka.";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";

      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, pin }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Gagal masuk.");

        setSession({ name: body.name, token: body.token });
        updateUserUI(body.name);
        wrap.remove();
        document.dispatchEvent(new CustomEvent("tuntonluk:auth", { detail: { name: body.name } }));
      } catch (err) {
        errorEl.textContent = err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = "Masuk / Daftar";
      }
    });
  }

  function init() {
    const session = getSession();
    updateUserUI(session ? session.name : null);
    if (!session) buildGateMarkup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#authLogoutBtn")) {
      e.preventDefault();
      clearSession();
      location.reload();
    }
  });

  window.TuntonAuth = { getSession, setSession, clearSession };
})();
