export class UI {
  constructor(root){
    this.root = root;
    this.mode = "boot"; // boot | menu | play
    this.onStart = null;
    this.onContinue = null;
    this.onNew = null;

    // in-game overlay actions (non-pausing)
    this.onAction = null; // (action, payload) => void

    this.hud = null;
    this.menu = null;
    this.prompt = null;
    this.toastEl = null;

    this.overlay = null;
    this.overlayOpen = false;
    this.overlayTab = "status"; // status | quests | vault | phone

    this.renderBoot();
  }

  clear(){
    this.root.innerHTML = "";
    this.hud = null;
    this.menu = null;
    this.prompt = null;
    this.toastEl = null;
    this.overlay = null;
    this.overlayOpen = false;
  }

  renderBoot(){
    this.clear();
    this.mode = "boot";
    this.root.innerHTML = `
      <div class="panel">
        <h1>NPC City</h1>
        <p>Loading the city brain…</p>
        <div class="row">
          <button class="btn" id="boot-ok">Enter</button>
        </div>
      </div>
    `;
    this.root.querySelector("#boot-ok").onclick = () => {
      this.renderMenu({ hasSave:false });
    };
  }

  renderMenu({ hasSave }){
    this.clear();
    this.mode = "menu";
    this.root.innerHTML = `
      <div class="panel">
        <h1>Choose your start</h1>
        <p>V1 is small on purpose. We’re proving the foundation: movement, zones, saving, and mechanics.</p>

        <div class="row" style="margin-bottom:10px">
          ${hasSave ? `<button class="btn" id="continue">Continue</button>` : ``}
          <button class="btn" id="new">New Game</button>
        </div>

        <div class="row">
          <button class="btn" data-role="thug">Thug</button>
          <button class="btn" data-role="actor">Actor</button>
          <button class="btn" data-role="police">Police</button>
        </div>

        <p style="margin-top:12px; opacity:.85">
          Controls:
          <span class="kbd">WASD / Arrows</span>
          <span class="kbd">Shift (run)</span>
          <span class="kbd">Space (jump)</span>
          <span class="kbd">C (dodge)</span>
          <span class="kbd">F (punch)</span>
          <span class="kbd">E (interact)</span>
          <span class="kbd">Tab (menu)</span>
          <span class="kbd">R (reset spawn)</span>
        </p>

        <div class="row" style="margin-top:10px">
          <a class="btn" href="settings.html" style="text-decoration:none">Settings</a>
          <a class="btn" href="debug.html" style="text-decoration:none">Debug</a>
        </div>
      </div>
    `;

    if (hasSave){
      this.root.querySelector("#continue").onclick = () => this.onContinue && this.onContinue();
    }
    this.root.querySelector("#new").onclick = () => this.onNew && this.onNew();

    this.root.querySelectorAll("[data-role]").forEach(btn=>{
      btn.onclick = () => {
        const role = btn.getAttribute("data-role");
        this.onStart && this.onStart(role);
      };
    });
  }

  
  hideMenu(){
    // switch from menu screen to in-game HUD
    this.clear();
    this.mode = "play";
    this.renderHUD();
  }

  showMenu({ hasSave }){
    this.renderMenu({ hasSave: !!hasSave });
  }

renderHUD(){
    if (this.hud) return;

    const hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML = `
      <div class="row top">
        <div class="pill" id="hud-role">ROLE</div>
        <div class="pill" id="hud-area">AREA</div>
        <div class="pill" id="hud-time">00:00</div>
        <div class="pill" id="hud-money">$0</div>
        <div class="pill" id="hud-inv">INV: 1</div>
        <div class="pill clickable" id="hud-menu">TAB · MENU</div>
      </div>

      <div class="row mid">
        <div class="pill soft" id="hud-rent">RENT: --</div>
        <div class="pill soft" id="hud-bank">VAULT: --</div>
        <div class="pill soft" id="hud-show">SHOW: --</div>
      </div>

      <div class="meters" aria-label="Status meters">
        <div class="meter" title="Stamina">
          <div class="meter-label">STA</div>
          <div class="meter-bar"><div class="meter-fill" id="hud-stam"></div></div>
        </div>
        <div class="meter" title="Hunger">
          <div class="meter-label">HUN</div>
          <div class="meter-bar"><div class="meter-fill" id="hud-hunger"></div></div>
        </div>
        <div class="meter" title="Sleep">
          <div class="meter-label">SLP</div>
          <div class="meter-bar"><div class="meter-fill" id="hud-sleep"></div></div>
        </div>
        <div class="meter" title="Hygiene">
          <div class="meter-label">HYG</div>
          <div class="meter-bar"><div class="meter-fill" id="hud-hygiene"></div></div>
        </div>
        <div class="meter" title="Fitness">
          <div class="meter-label">FIT</div>
          <div class="meter-bar"><div class="meter-fill" id="hud-fitness"></div></div>
        </div>
        <div class="meter" title="Health">
          <div class="meter-label">HP</div>
          <div class="meter-bar"><div class="meter-fill" id="hud-health"></div></div>
        </div>
      </div>
`;
    this.root.appendChild(hud);

    const prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.id = "prompt";
    prompt.textContent = "";
    this.root.appendChild(prompt);

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.innerHTML = `
      <div class="kbd">WASD</div>
      <div class="kbd">Shift</div>
      <div class="kbd">Space</div>
      <div class="kbd">C</div>
      <div class="kbd">F</div>
      <div class="kbd">E</div>
      <div class="kbd">Tab</div>
    `;
    this.root.appendChild(corner);

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "toast";
    toast.textContent = "";
    this.root.appendChild(toast);

    this.hud = hud;
    this.prompt = prompt;
    this.corner = corner;
    this.toastEl = toast;

    // overlay menu (non-pausing)
    this.renderOverlay();

    // hud menu click
    this.root.querySelector("#hud-menu").onclick = () => this.toggleOverlay();
  }

  renderOverlay(){
    if (this.overlay) return;
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `
      <div class="overlay-shell" role="dialog" aria-label="Menu">
        <div class="overlay-top">
          <div class="overlay-title">NPC MENU</div>
          <div class="overlay-tabs">
            <button class="tab" data-tab="status">Status</button>
            <button class="tab" data-tab="quests">Quests</button>
            <button class="tab" data-tab="vault">Vault</button>
            <button class="tab" data-tab="phone">Phone</button>
          </div>
          <button class="x" id="ov-close" title="Close">×</button>
        </div>

        <div class="overlay-body">
          <div class="ov-panel" id="ov-status"></div>
          <div class="ov-panel" id="ov-quests" style="display:none"></div>
          <div class="ov-panel" id="ov-vault" style="display:none"></div>
          <div class="ov-panel" id="ov-phone" style="display:none"></div>
        </div>

        <div class="overlay-foot">
          <div class="muted">Tip: this menu does NOT pause the city. <span class="kbd">Tab</span> closes.</div>
        </div>
      </div>
    `;
    ov.style.display = "none";
    this.root.appendChild(ov);
    this.overlay = ov;

    ov.querySelector("#ov-close").onclick = () => this.setOverlayOpen(false);

    ov.querySelectorAll(".tab").forEach(b=>{
      b.onclick = () => this.setOverlayTab(b.getAttribute("data-tab"));
    });

    // click outside shell closes
    ov.addEventListener("pointerdown", (e)=>{
      if (e.target === ov) this.setOverlayOpen(false);
    });
  }

  setOverlayTab(tab){
    this.overlayTab = tab || "status";
    if (!this.overlay) return;

    const show = (id, on) => {
      const el = this.overlay.querySelector(id);
      if (!el) return;
      el.style.display = on ? "" : "none";
    };

    show("#ov-status", this.overlayTab === "status");
    show("#ov-quests", this.overlayTab === "quests");
    show("#ov-vault",  this.overlayTab === "vault");
    show("#ov-phone",  this.overlayTab === "phone");

    this.overlay.querySelectorAll(".tab").forEach(t=>{
      t.classList.toggle("active", t.getAttribute("data-tab") === this.overlayTab);
    });
  }

  setOverlayOpen(open){
    this.renderHUD();
    this.overlayOpen = !!open;
    if (!this.overlay) return;
    this.overlay.style.display = this.overlayOpen ? "" : "none";
    if (this.overlayOpen) this.setOverlayTab(this.overlayTab);
  }

  toggleOverlay(){
    this.setOverlayOpen(!this.overlayOpen);
  }

  // Called every frame with latest data
  setOverlayData(data){
    this.renderHUD();
    if (!this.overlay) return;

    const esc = (s) => (""+s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const pct = (v) => Math.max(0, Math.min(100, Math.round(v)));

    // STATUS
    const s = data?.status || {};
    this.overlay.querySelector("#ov-status").innerHTML = `
      <div class="ov-grid">
        <div class="ov-card">
          <div class="ov-h">Vitals</div>
          <div class="ov-row"><span>Health</span><b>${pct(s.health ?? 0)}%</b></div>
          <div class="ov-row"><span>Stamina</span><b>${Math.round(s.stamina ?? 0)} / ${Math.round(s.staminaMax ?? 0)}</b></div>
          <div class="ov-row"><span>Hunger</span><b>${pct(s.hunger ?? 0)}%</b></div>
          <div class="ov-row"><span>Sleep</span><b>${pct(s.sleep ?? 0)}%</b></div>
          <div class="ov-row"><span>Hygiene</span><b>${pct(s.hygiene ?? 0)}%</b></div>
          <div class="ov-row"><span>Fitness</span><b>${pct(s.fitness ?? 0)}%</b></div>
        </div>

        <div class="ov-card">
          <div class="ov-h">Reputation</div>
          <div class="ov-row"><span>Fame</span><b>${Math.round(s.fame ?? 0)}</b></div>
          <div class="ov-row"><span>Street Rep</span><b>${Math.round(s.streetRep ?? 0)}</b></div>
          <div class="ov-row"><span>Heat</span><b>${Math.round(s.heat ?? 0)}</b></div>
          <div class="ov-row"><span>Good/Bad</span><b>${Math.round(s.morality ?? 0)}</b></div>
        </div>
      </div>
    `;

    // QUESTS
    const q = data?.quests || {};
    const steps = (q.steps || []).map(st => `
      <div class="qstep ${st.done ? "done":""}">
        <div class="dot">${st.done ? "✓" : "•"}</div>
        <div class="txt">
          <div class="t">${esc(st.text)}</div>
          ${st.sub ? `<div class="s">${esc(st.sub)}</div>` : ``}
        </div>
      </div>
    `).join("");
    this.overlay.querySelector("#ov-quests").innerHTML = `
      <div class="ov-card">
        <div class="ov-h">${esc(q.title || "No active quest")}</div>
        <div class="muted">${esc(q.desc || "Do stuff. Get paid. Survive.")}</div>
        <div class="qsteps">${steps || `<div class="muted" style="margin-top:10px">No steps yet.</div>`}</div>
      </div>
    `;

    // VAULT
    const v = data?.vault || {};
    const locked = !!v.locked;
    this.overlay.querySelector("#ov-vault").innerHTML = `
      <div class="ov-card">
        <div class="ov-h">District Vault</div>
        <div class="muted">Access: <b>${locked ? "LOCKED" : "READY"}</b> ${v.unlockText ? `(${esc(v.unlockText)})` : ""}</div>

        <div class="ov-row" style="margin-top:10px">
          <span>Cash on hand</span>
          <b>$${Math.round(v.cash ?? 0)}</b>
        </div>
        <div class="ov-row">
          <span>Vault cash</span>
          <b>$${Math.round(v.vaultCash ?? 0)}</b>
        </div>

        <div class="row" style="margin-top:10px; gap:8px; flex-wrap:wrap">
          <button class="btn mini" id="v-dep10" ${locked ? "disabled":""}>Deposit $10</button>
          <button class="btn mini" id="v-dep50" ${locked ? "disabled":""}>Deposit $50</button>
          <button class="btn mini" id="v-depall" ${locked ? "disabled":""}>Deposit All</button>
          <button class="btn mini" id="v-wd50" ${locked ? "disabled":""}>Withdraw $50</button>
          <button class="btn mini" id="v-wdall" ${locked ? "disabled":""}>Withdraw All</button>
        </div>

        <div class="muted" style="margin-top:10px">Later: store cars, clothes, weapons. For now it's cash only.</div>
      </div>
    `;

    const bind = (id, action, payload) => {
      const el = this.overlay.querySelector(id);
      if (!el) return;
      el.onclick = () => this.onAction && this.onAction(action, payload);
    };
    bind("#v-dep10", "vault_deposit", { amount:10 });
    bind("#v-dep50", "vault_deposit", { amount:50 });
    bind("#v-depall", "vault_deposit", { amount:"all" });
    bind("#v-wd50", "vault_withdraw", { amount:50 });
    bind("#v-wdall", "vault_withdraw", { amount:"all" });

    // PHONE
    const p = data?.phone || {};
    this.overlay.querySelector("#ov-phone").innerHTML = `
      <div class="ov-grid">
        <div class="ov-card">
          <div class="ov-h">Content Job</div>
          <div class="muted">Do this at home (near Apartments). Earn cash + fame. Dev mode is 1 minute.</div>
          <div class="ov-row" style="margin-top:10px">
            <span>Status</span>
            <b>${p.running ? "RUNNING" : "IDLE"}</b>
          </div>
          ${p.running ? `
            <div class="ov-row">
              <span>Remaining</span>
              <b>${esc(p.remainingText || "--")}</b>
            </div>
            <button class="btn mini" id="p-cancel" style="margin-top:10px">Cancel</button>
          ` : `
            <button class="btn" id="p-start" style="margin-top:10px">Start (1 min)</button>
          `}
          <div class="muted" style="margin-top:10px">Later: 1 hour real time, editing minigame, sponsorships, drama, etc.</div>
        </div>

        <div class="ov-card">
          <div class="ov-h">Quick Notes</div>
          <div class="muted">
            <div>• Shows pay BIG at 8pm.</div>
            <div>• Missing a show hits fame.</div>
            <div>• Vault resets at midnight.</div>
          </div>
        </div>
      </div>
    `;
    if (p.running){
      const c = this.overlay.querySelector("#p-cancel");
      if (c) c.onclick = () => this.onAction && this.onAction("content_cancel", {});
    } else {
      const sbtn = this.overlay.querySelector("#p-start");
      if (sbtn) sbtn.onclick = () => this.onAction && this.onAction("content_start", {});
    }
  }

  setInventory({ slotIndex, heldType }){
    this.renderHUD();
    const el = this.root.querySelector("#hud-inv");
    if (!el) return;
    const slot = (slotIndex ?? 0) + 1;
    const name = (heldType || "empty").toUpperCase();
    el.textContent = `INV: ${slot} · ${name}`;
  }

  setHUD({ role, area, money, stamina, staminaMax, timeText, rentText, bankText, showText, hunger, sleep, hygiene, fitness, health }){
    this.renderHUD();
    this.root.querySelector("#hud-role").textContent = (role || "?").toUpperCase();
    this.root.querySelector("#hud-area").textContent = area || "";
    this.root.querySelector("#hud-money").textContent = `$${money ?? 0}`;
    if (timeText) this.root.querySelector("#hud-time").textContent = timeText;
    if (rentText) this.root.querySelector("#hud-rent").textContent = rentText;
    if (bankText) this.root.querySelector("#hud-bank").textContent = bankText;
    if (showText) this.root.querySelector("#hud-show").textContent = showText;

    const setFill01 = (id, v01) => {
      const el = this.root.querySelector(id);
      if (!el || typeof v01 !== "number") return;
      const p = Math.max(0, Math.min(1, v01));
      el.style.width = `${Math.round(p*100)}%`;
    };

    if (typeof stamina === "number" && typeof staminaMax === "number"){
      setFill01("#hud-stam", stamina / (staminaMax || 1));
    }
    const setPct = (id, v) => setFill01(id, (typeof v === "number" ? v/100 : null));
    setPct("#hud-hunger", hunger);
    setPct("#hud-sleep", sleep);
    setPct("#hud-hygiene", hygiene);
    setPct("#hud-fitness", fitness);
    setPct("#hud-health", health);
  }

  setPrompt(text){
    this.renderHUD();
    if (!this.prompt) return;
    this.prompt.textContent = text || "";
    this.prompt.style.opacity = text ? "1" : "0";
  }

  toast(msg){
    this.renderHUD();
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = "1";
    clearTimeout(this._toastT);
    this._toastT = setTimeout(()=>{ if (this.toastEl) this.toastEl.style.opacity = "0"; }, 1800);
  }
}
