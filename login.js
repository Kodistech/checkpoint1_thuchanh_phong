// ───────────── 1. CONFIG: replace these two values ─────────────
const SUPABASE_URL      = "https://vpxmkagnyqgdalwuzuod.supabase.co";       // e.g. https://abcdxyz.supabase
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweG1rYWdueXFnZGFsd3V6dW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NzE0MzQsImV4cCI6MjEwOTA0NzQzNH0.-NZ7fG6OVy67jkHoViPa5rCrO91ODSUDcDf5mWF3D00";
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
  const el = $("loginMsg");
  el.textContent = text;
  el.className = "msg " + (text ? type : "");
}
function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.textContent = busy ? "Please wait…" : label;
}
function ensureConfigured() {
  if (configured) return true;
  showMsg("Add your Supabase URL and Anon Key at the top of login.js first.", "error");
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
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("", "");
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value;

  const okEmail = setError("loginEmail", checkEmail(email));
  const okPass = setError("loginPass", checkPassword(pass));
  if (!(okEmail && okPass) || !ensureConfigured()) return;

  setBusy($("loginBtn"), true, "Login");
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  setBusy($("loginBtn"), false, "Login");

  if (error) return showMsg(error.message, "error");
  showMsg("Login successful! ", "ok");
});

$("googleBtn").addEventListener("click", async () => {
  if (!ensureConfigured()) return;
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: loginPageUrl }
  });
  if (error) showMsg(error.message, "error");
});

$("logoutBtn").addEventListener("click", async () => {
  const { error } = await sb.auth.signOut();
  if (error) return alert(error.message);
  showMsg("You’ve been logged out. Fuck You", "ok");
});

// ───────────── 4. Show the right view for the current session ─────────────
function render(session) {
  const user = session && session.user;
  $("loginView").hidden = !!user;
  $("userView").hidden = !user;
  if (user) {
    $("userEmail").textContent = user.email || "(no email on this account)";
    $("loginForm").reset();
  }
}

if (configured) {
  sb.auth.getSession().then(({ data }) => render(data.session));
  sb.auth.onAuthStateChange((_event, session) => render(session));
}
