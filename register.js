// ───────────── 1. CONFIG: replace these two values ─────────────

// ────────────────────────────────────────────────────────────

const configured = !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const loginPageUrl = new URL("login.html", window.location.href).href;

const $ = (id) => document.getElementById(id);
if (!configured) $("configBanner").hidden = false;

// ───────────── 2. Validation + UI helpers ─────────────
function checkEmail(v) {
  return v.includes("@") ? "" : "Email must contain the ‘@’ character.";
}
function checkPassword(v) {
  const missing = [];
  if (v.length < 6)     missing.push("at least 6 characters");
  if (!/[A-Z]/.test(v)) missing.push("1 uppercase letter");
  if (!/[a-z]/.test(v)) missing.push("1 lowercase letter");
  if (!/[0-9]/.test(v)) missing.push("1 number");
  return missing.length ? "Password needs " + missing.join(", ") + "." : "";
}
function setError(inputId, message) {
  $(inputId + "Err").textContent = message;
  $(inputId).setAttribute("aria-invalid", message ? "true" : "false");
  return !message;
}
function showMsg(text, type) {
  const el = $("signupMsg");
  el.textContent = text;
  el.className = "msg " + (text ? type : "");
}
function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.textContent = busy ? "Please wait…" : label;
}
function ensureConfigured() {
  if (configured) return true;
  showMsg("Add your Supabase URL and Anon Key at the top of register.js first.", "error");
  return false;
}

document.querySelectorAll(".field input").forEach((input) =>
  input.addEventListener("input", () => setError(input.id, ""))
);
document.querySelectorAll("[data-eye]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.eye);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  })
);

// ───────────── 3. Supabase auth actions ─────────────
$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("", "");
  const email = $("signupEmail").value.trim();
  const pass = $("signupPass").value;
  const confirm = $("signupConfirm").value;

  const okEmail = setError("signupEmail", checkEmail(email));
  const okPass = setError("signupPass", checkPassword(pass));
  const okConfirm = setError("signupConfirm", pass === confirm ? "" : "Passwords do not match.");
  if (!(okEmail && okPass && okConfirm) || !ensureConfigured()) return;

  setBusy($("signupBtn"), true, "Signup");
  const { data, error } = await sb.auth.signUp({
    email, password: pass, options: { emailRedirectTo: loginPageUrl }
  });
  setBusy($("signupBtn"), false, "Signup");

  if (error) return showMsg(error.message, "error");
  // Supabase returns an empty identities list when the email is already registered
  if (data.user && data.user.identities && data.user.identities.length === 0)
    return showMsg("This email is already registered. Try logging in instead.", "error");
  if (!data.session)
    return showMsg("Signup successful! Check your inbox to confirm your email, then log in. 🎃", "ok");

  showMsg("Signup successful! Taking you to your account… 🎃", "ok");
  setTimeout(() => window.location.replace(loginPageUrl), 1200);
});

$("googleBtn").addEventListener("click", async () => {
  if (!ensureConfigured()) return;
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: loginPageUrl }
  });
  if (error) showMsg(error.message, "error");
});

// Already signed in? Skip the signup page.
if (configured) {
  sb.auth.getSession().then(({ data }) => {
    if (data.session) window.location.replace(loginPageUrl);
  });
}
