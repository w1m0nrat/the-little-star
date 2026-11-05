(() => {
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = cfg.url?.startsWith("https://") && !cfg.url.includes("YOUR_PROJECT") &&
                cfg.anonKey && !cfg.anonKey.includes("YOUR_SUPABASE");
  const client = ready && window.supabase ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const $ = (id) => document.getElementById(id);
  const authDialog = $("auth-dialog"), memberDialog = $("member-dialog");
  let mode = "login", currentUser = null;

  function message(id, value) { $(id).textContent = value; }
  function openAuth() { mode = "login"; renderAuthMode(); authDialog.showModal(); }
  function renderAuthMode() {
    $("auth-title").textContent = mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก";
    $("auth-submit").textContent = mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี";
    $("recovery-wrap").hidden = mode === "login";
    $("auth-note").innerHTML = mode === "login"
      ? 'ยังไม่มีบัญชี? <button type="button" class="text-button" id="toggle-auth">สมัครสมาชิก</button>'
      : 'มีบัญชีแล้ว? <button type="button" class="text-button" id="toggle-auth">เข้าสู่ระบบ</button>';
    $("toggle-auth").addEventListener("click", () => { mode = mode === "login" ? "signup" : "login"; renderAuthMode(); });
  }
  function renderAccount() {
    $("account-area").innerHTML = currentUser
      ? `<button class="button button-ghost" id="open-member">พื้นที่สมาชิก</button>`
      : '<button class="button button-ghost" id="open-login">เข้าสู่ระบบ</button>';
    const btn = currentUser ? $("open-member") : $("open-login");
    btn.addEventListener("click", currentUser ? openMember : openAuth);
  }
  async function invokeAuth(action, payload) {
    const { data, error } = await client.functions.invoke("username-auth", { body: { action, ...payload } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.session) {
      const { error: setError } = await client.auth.setSession(data.session);
      if (setError) throw setError;
    }
    return data;
  }
  async function refreshSession() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    currentUser = data.session?.user || null;
    renderAccount();
  }
  function openMember() { memberDialog.showModal(); loadWishes(); }
  async function loadWishes() {
    if (!client || !currentUser) return;
    const { data, error } = await client.from("wishes").select("id,body,created_at").order("created_at", {ascending:false});
    if (error) { message("wish-status", error.message); return; }
    $("my-wishes").innerHTML = "";
    (data || []).forEach(w => {
      const article = document.createElement("article");
      article.textContent = w.body;
      const time = document.createElement("time");
      time.textContent = new Date(w.created_at).toLocaleString("th-TH");
      article.appendChild(time); $("my-wishes").appendChild(article);
    });
  }

  ["open-login","wish-login"].forEach(id => $(id).addEventListener("click", openAuth));
  $("auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!client) { message("auth-status", "ยังไม่ได้ตั้งค่า Supabase กรุณาตั้งค่า config.js และ Deploy Edge Function ก่อน"); return; }
    const username = $("username").value.trim().toLowerCase();
    const password = $("password").value;
    const recoveryEmail = $("recovery-email").value.trim();
    message("auth-status", "กำลังดำเนินการ...");
    try {
      await invokeAuth(mode, { username, password, recovery_email: recoveryEmail || null });
      await refreshSession(); authDialog.close(); $("auth-form").reset();
      if (currentUser) openMember();
    } catch (err) { message("auth-status", err.message || "ไม่สามารถดำเนินการได้"); }
  });
  $("wish-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!client || !currentUser) return;
    const body = $("wish-text").value.trim();
    const { error } = await client.from("wishes").insert({ body });
    if (error) message("wish-status", error.message);
    else { $("wish-text").value = ""; message("wish-status", "บันทึกคำอธิษฐานแล้ว"); loadWishes(); }
  });
  $("logout").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    currentUser = null; renderAccount(); memberDialog.close();
  });
  if (!client) {
    $("account-area").innerHTML = '<button class="button button-ghost" id="open-login">เข้าสู่ระบบ</button>';
    $("open-login").addEventListener("click", openAuth);
  } else {
    client.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; renderAccount(); });
    refreshSession();
  }
})();