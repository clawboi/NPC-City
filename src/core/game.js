// src/core/game.js
import { Player } from "../entities/player.js";
import { Inventory } from "./inventory.js";

export class Game {
  constructor({ canvas, ctx, input, save, ui, assets, world }){
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.save = save;
    this.ui = ui;
    this.assets = assets;
    this.world = world;

    this.state = "menu"; // menu | play
    this.lastT = 0;

    this.player = {
      role: "actor",
      x: 0, y: 0,
      w: 18, h: 18,

      faceX: 0, faceY: 1,

      z: 0,
      jumpT: 0,
      dodgeT: 0,
      dodgeCd: 0,
      punchT: 0,
      punchCd: 0,
      iFrames: 0,

      stamina: 100,
      staminaMax: 100,

      // ===== Reputation (placeholders for future systems) =====
      fame: 0,
      streetRep: 0,
      heat: 0,
      morality: 0, // positive good, negative bad

      // ===== Survival / life-sim core (Step 1) ===== / life-sim core (Step 1) =====
      health: 100,
      healthMax: 100,
      hunger: 100,   // 0..100
      sleep: 100,    // 0..100
      hygiene: 100,  // 0..100
      fitness: 100,  // 0..100

      // soft debuffs derived from needs
      speedMul: 1,

      money: 40,
      area: "",

      // economy / rent
      rentDueAt: 0,
      rentDebt: 0,
      evicted: false,

      // bank vault (once/day)
      vault: { cash: 0, cars: [], clothes: [] },
      vaultLastDay: "", // YYYY-MM-DD (local)

      // shows + jobs
      lastShowDay: "",
      missedShowDay: "",
      contentJob: { running:false, endsAt:0, startedAt:0, durS:60 },

      // quests (V1.5)
      quests: { active:"actor_v15", completed:{} }
    };

    this.camera = {
      x: 0, y: 0,
      vw: canvas.width,
      vh: canvas.height
    };

    this.fx = [];

    // renderer-only player
    this.playerSprite = new Player();
    // Inventory (OFF by default: no default loadout)
this.inv = new Inventory();
this.inv.setDefaultLoadout();        // ✅ gives you knife/bat/flashlight
this.inv.bindHotkeys();              // 1/2/3 + Q cycle
this.inv.applyToPlayer(this.player); // ensures player.held exists

    ui.onStart = (role) => this.startNew(role);
    ui.onContinue = () => this.continueGame();
    ui.onNew = () => this.newGameMenu();

    ui.onAction = (action, payload) => this.handleUIAction(action, payload);

  }

  boot(){
    const existing = this.save.load();
    this.ui.renderMenu({ hasSave: !!existing });
    requestAnimationFrame((t)=>this.loop(t));
  }

  newGameMenu(){
    const existing = this.save.load();
    this.ui.renderMenu({ hasSave: !!existing });
    this.state = "menu";
  }

  startNew(role){
    const spawn = this.world.getSpawn(role);

    this.player.role = role;
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.money = role === "police" ? 120 : (role === "actor" ? 60 : 30);
    this.player.area = spawn.area || "";

    // rep placeholders
    this.player.fame = this.player.fame ?? 0;
    this.player.streetRep = this.player.streetRep ?? 0;
    this.player.heat = this.player.heat ?? 0;
    this.player.morality = this.player.morality ?? 0;

    this.player.faceX = 0; this.player.faceY = 1;
    this.player.z = 0;
    this.player.jumpT = 0;
    this.player.dodgeT = 0;
    this.player.dodgeCd = 0;
    this.player.punchT = 0;
    this.player.punchCd = 0;
    this.player.iFrames = 0;
    this.player.stamina = this.player.staminaMax;

    // needs start (slightly imperfect so you feel the loop)
    this.player.health = this.player.healthMax;
    this.player.hunger = 86;
    this.player.sleep = 72;
    this.player.hygiene = 70;
    this.player.fitness = 60;
    this.player.rentDebt = 0;
    this.player.evicted = false;

    // rent: due every 3 real days
    const now = Date.now();
    this.player.rentDueAt = now + 3 * 24 * 60 * 60 * 1000;

    // vault
    this.player.vault = { cash: 0, cars: [], clothes: [] };
    this.player.vaultLastDay = "";

    // v1.5 quest + jobs
    this.player.quests = { active:"actor_v15", completed:{} };
    this.player.contentJob = { running:false, endsAt:0, startedAt:0, durS:60 };
    this.player.lastShowDay = "";
    this.player.missedShowDay = "";

    this.fx.length = 0;

    this.playerSprite.reset(this.player);

    this.state = "play";
    this.ui.hideMenu();
    this.persist();
  }

  continueGame(){
    const data = this.save.load();
    if (!data) return this.newGameMenu();

    // merge save
    const sp = data.player || {};
    for (const k in sp) this.player[k] = sp[k];

    // safety defaults (no ??=)
    if (this.player.faceX == null) this.player.faceX = 0;
    if (this.player.faceY == null) this.player.faceY = 1;
    if (this.player.z == null) this.player.z = 0;
    if (this.player.jumpT == null) this.player.jumpT = 0;
    if (this.player.dodgeT == null) this.player.dodgeT = 0;
    if (this.player.dodgeCd == null) this.player.dodgeCd = 0;
    if (this.player.punchT == null) this.player.punchT = 0;
    if (this.player.punchCd == null) this.player.punchCd = 0;
    if (this.player.iFrames == null) this.player.iFrames = 0;
    if (this.player.staminaMax == null) this.player.staminaMax = 100;
    if (this.player.stamina == null) this.player.stamina = this.player.staminaMax;

    // step 1: needs + economy defaults
    if (this.player.healthMax == null) this.player.healthMax = 100;
    if (this.player.health == null) this.player.health = this.player.healthMax;
    if (this.player.hunger == null) this.player.hunger = 100;
    if (this.player.sleep == null) this.player.sleep = 100;
    if (this.player.hygiene == null) this.player.hygiene = 100;
    if (this.player.fitness == null) this.player.fitness = 100;
    if (this.player.rentDebt == null) this.player.rentDebt = 0;
    if (this.player.evicted == null) this.player.evicted = false;
    if (this.player.rentDueAt == null) this.player.rentDueAt = Date.now() + 3*24*60*60*1000;
    if (this.player.vault == null) this.player.vault = { cash: 0, cars: [], clothes: [] };
    if (this.player.vaultLastDay == null) this.player.vaultLastDay = "";

    // offline progression (logging off counts as sleep)
    this.applyOfflineProgress(data);

    this.player.stamina = clamp(this.player.stamina, 0, this.player.staminaMax);

    this.playerSprite.reset(this.player);

    this.state = "play";
    this.ui.hideMenu();
  }

  persist(){
    this.save.write({
      v: 2,
      meta: {
        lastSeenAt: Date.now()
      },
      player: {
        role: this.player.role,
        x: this.player.x,
        y: this.player.y,
        money: this.player.money,
        area: this.player.area,
        stamina: this.player.stamina,
        staminaMax: this.player.staminaMax,
        faceX: this.player.faceX,
        faceY: this.player.faceY,

        // step 1 persistence
        health: this.player.health,
        healthMax: this.player.healthMax,
        hunger: this.player.hunger,
        sleep: this.player.sleep,
        hygiene: this.player.hygiene,
        fitness: this.player.fitness,
        rentDueAt: this.player.rentDueAt,
        rentDebt: this.player.rentDebt,
        evicted: this.player.evicted,
        vault: this.player.vault,
        vaultLastDay: this.player.vaultLastDay
      }
    });
  }

  applyOfflineProgress(saveData){
    const lastSeenAt = saveData?.meta?.lastSeenAt;
    if (!lastSeenAt) return;
    const now = Date.now();
    const dt = Math.max(0, Math.min(7*24*3600, (now - lastSeenAt)/1000)); // cap 7 days

    // When you log off, you're effectively sleeping.
    // Hunger/hygiene slowly decay; sleep recovers.
    this.player.hunger  = clamp(this.player.hunger  - dt * 0.0025, 0, 100); // ~9 pts/hour
    this.player.hygiene = clamp(this.player.hygiene - dt * 0.0012, 0, 100); // ~4 pts/hour
    this.player.fitness = clamp(this.player.fitness - dt * 0.0003, 0, 100); // slow decay
    this.player.sleep   = clamp(this.player.sleep   + dt * 0.0030, 0, 100); // ~11 pts/hour

    // If you were starving/filthy before logging off, health can still tick down.
    const danger = (this.player.hunger <= 0 ? 1 : 0) + (this.player.hygiene <= 0 ? 1 : 0);
    if (danger > 0){
      this.player.health = clamp(this.player.health - dt * 0.02 * danger, 0, this.player.healthMax);
    }
  }

  loop(t){
    const dt = Math.min(0.033, ((t - this.lastT) / 1000) || 0.016);
    this.lastT = t;

    this.update(dt);
    this.render();

    this.input.endFrame();
    requestAnimationFrame((tt)=>this.loop(tt));
  }

  update(dt){
    if (this.state !== "play") return;

    // overlay menu (non-pausing)
    if (this.input.pressed("tab")) this.ui.toggleOverlay && this.ui.toggleOverlay();

    // ===== Step 1: Real-time clock + daily events =====
    const now = Date.now();
    const t = localClock(now);
    const timeText = `${pad2(t.h)}:${pad2(t.m)}`;
    const showAt = nextTodayAt(now, 20, 0); // 8pm local
    const untilShow = showAt - now;
    const showText = (untilShow <= 0 && untilShow > -60*60*1000)
      ? "SHOW: LIVE"
      : `SHOW: ${formatCountdown(untilShow)}`;

    // if you missed the show (after 8pm) apply a small fame hit once per day
    // (fame system later; for now it chips money as placeholder and toasts)
    this._showDay = this._showDay || "";
    const dayKeyNow = dayKey(now);
    if (t.h === 20 && t.m === 0 && this._showDay !== dayKeyNow){
      this._showDay = dayKeyNow;
      if (this.ui.toast) this.ui.toast("8PM show time. Go to the Park Stage.");
    }

    // Missed show check: after 9pm, if you didn't perform during the 8pm window, fame drops once/day
    if (t.h >= 21){
      const today = dayKeyNow;
      if (this.player.lastShowDay !== today && this.player.missedShowDay !== today){
        this.player.missedShowDay = today;
        this.player.fame = (this.player.fame || 0) - 2;
        if (this.ui.toast) this.ui.toast("No-show penalty: -Fame (you missed the 8PM show).");
      }
    }


    // ===== Step 1: Needs tick =====
    this.tickNeeds(dt);

    // ===== V1.5: Content job tick =====
    this.tickContentJob();

    // ===== V1.5: Quest tick =====
    this.tickQuest();


    // timers
    this.player.dodgeCd = Math.max(0, this.player.dodgeCd - dt);
    this.player.punchCd = Math.max(0, this.player.punchCd - dt);
    this.player.iFrames = Math.max(0, this.player.iFrames - dt);

    // stamina regen (affected by needs)
    const acting = (this.player.dodgeT > 0) || (this.player.punchT > 0) || (this.player.jumpT > 0);
    const regen = acting ? 12 : 22;
    this.player.stamina = clamp(this.player.stamina + regen * dt, 0, this.player.staminaMax);

    // Reset spawn key
    if (this.input.pressed("r")){
      const sp = this.world.getSpawn(this.player.role);
      this.player.x = sp.x;
      this.player.y = sp.y;
      this.player.area = sp.area || "";
      this.persist();
      if (this.ui.toast) this.ui.toast("Reset spawn");
    }

    // input axis + facing (8-direction snap)
const a = this.input.axis();
let ax = a.x, ay = a.y;

// SNAP to -1/0/1 so diagonals are clean
ax = ax > 0.2 ? 1 : ax < -0.2 ? -1 : 0;
ay = ay > 0.2 ? 1 : ay < -0.2 ? -1 : 0;

if (ax !== 0 || ay !== 0){
  this.player.faceX = ax;
  this.player.faceY = ay;
}

    // jump
    if (this.input.pressed(" ") && this.player.jumpT <= 0){
      const cost = 12;
      if (this.player.stamina >= cost){
        this.player.stamina -= cost;
        this.player.jumpT = 0.28;
        this.fx.push({ type:"poof", x:this.player.x+this.player.w/2, y:this.player.y+this.player.h+6, t:0, dur:0.22 });
      }
    }

    // dodge
    if (this.input.pressed("c") && this.player.dodgeCd <= 0 && this.player.dodgeT <= 0){
      const cost = 22;
      if (this.player.stamina >= cost){
        this.player.stamina -= cost;
        this.player.dodgeT = 0.18;
        this.player.dodgeCd = 0.40;
        this.player.iFrames = 0.22;
        this.fx.push({ type:"dash", x:this.player.x+this.player.w/2, y:this.player.y+this.player.h/2, t:0, dur:0.18, dx:this.player.faceX, dy:this.player.faceY });
      }
    }

    // punch (now it has an actual pose via player.js)
    if (this.input.pressed("f") && this.player.punchCd <= 0 && this.player.punchT <= 0){
      const cost = 10;
      if (this.player.stamina >= cost){
        this.player.stamina -= cost;
        this.player.punchT = 0.14;   // slightly longer so you see it
        this.player.punchCd = 0.18;
      }
    }

    // interact prompt
    const lm = (this.world.nearestLandmark)
      ? this.world.nearestLandmark(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 62)
      : null;

    this._nearLm = lm;

    if (lm){
      if (this.ui.setPrompt) this.ui.setPrompt("E · " + lm.text + "  ·  " + (lm.hint || "Interact"));
      if (this.input.pressed("e")) this.handleInteract(lm);
    } else {
      if (this.ui.setPrompt) this.ui.setPrompt("");
    }

    // movement
    let dx = 0, dy = 0;

    if (this.player.dodgeT > 0){
      this.player.dodgeT = Math.max(0, this.player.dodgeT - dt);
      const spd = 520;
      dx = this.player.faceX * spd * dt;
      dy = this.player.faceY * spd * dt;
    } else {
      const run = this.input.down("shift");
      const speed = (run ? 220 : 150) * (this.player.speedMul || 1);
      const slow = (this.player.punchT > 0) ? 0.60 : (this.player.jumpT > 0 ? 0.85 : 1.0);
      dx = ax * speed * slow * dt;
      dy = ay * speed * slow * dt;
    }

    // tick action timers
    if (this.player.punchT > 0) this.player.punchT = Math.max(0, this.player.punchT - dt);
    if (this.player.jumpT > 0)  this.player.jumpT  = Math.max(0, this.player.jumpT - dt);

    // jump curve (visual)
    if (this.player.jumpT > 0){
      const p = 1 - (this.player.jumpT / 0.28);
      this.player.z = Math.sin(p * Math.PI) * 10;
    } else {
      this.player.z = 0;
    }

    // collide per-axis
    this.moveWithCollision(dx, 0);
    this.moveWithCollision(0, dy);

    // clamp bounds
    this.player.x = clamp(this.player.x, 0, this.world.w - this.player.w);
    this.player.y = clamp(this.player.y, 0, this.world.h - this.player.h);

    // camera follow
    const targetX = this.player.x + this.player.w * 0.5 - this.camera.vw * 0.5;
    const targetY = this.player.y + this.player.h * 0.5 - this.camera.vh * 0.5;
    const clampedX = clamp(targetX, 0, this.world.w - this.camera.vw);
    const clampedY = clamp(targetY, 0, this.world.h - this.camera.vh);

    this.camera.x = lerp(this.camera.x, clampedX, 0.12);
    this.camera.y = lerp(this.camera.y, clampedY, 0.12);
    this.camera.x = Math.round(this.camera.x);
    this.camera.y = Math.round(this.camera.y);

    // area name
    this.player.area = this.getAreaName(this.player.x, this.player.y, this.player.role);

    // HUD
    if (this.ui.setHUD){
      const rentText = this.getRentText(now);
      const bankText = this.getVaultText(now);
      this.ui.setHUD({
        role: this.player.role,
        area: this.player.area,
        money: this.player.money,
        stamina: this.player.stamina,
        staminaMax: this.player.staminaMax,
        timeText,
        rentText,
        bankText,
        showText,
        hunger: this.player.hunger,
        sleep: this.player.sleep,
        hygiene: this.player.hygiene,
        fitness: this.player.fitness,
        health: this.player.health
      });
    // overlay data (menu does not pause)
    if (this.ui.setOverlayData){
      this.ui.setOverlayData(this.buildOverlayData(now));
    }

    }

    // FX tick
    for (let i=0; i<this.fx.length; i++) this.fx[i].t += dt;
    this.fx = this.fx.filter(f => f.t < f.dur);

    // keep held item updated after hotkeys
if (this.inv) this.inv.applyToPlayer(this.player);
if (this.ui.setInventory){
  const held = this.player.held;
  const heldType = (typeof held === "string") ? held : (held?.type || null);
  this.ui.setInventory({ slotIndex: this.inv.active, heldType });
}

    // autosave
    this._saveTimer = (this._saveTimer || 0) + dt;
    if (this._saveTimer > 1.5){
      this._saveTimer = 0;
      this.persist();
    }
  }

  handleInteract(lm){
    // placeholder interactions
    switch (lm.id){
      case "vault":
        this.openMenu("vault");
        if (this.ui.toast) this.ui.toast("Vault opened in menu (1/day).");
        break;
      case "pool":
        this.player.hygiene = clamp(this.player.hygiene + 25, 0, 100);
        if (this.ui.toast) this.ui.toast("Washed up (+Hygiene)");
        break;
      case "tennis":
        this.player.fitness = clamp(this.player.fitness + 18, 0, 100);
        if (this.ui.toast) this.ui.toast("Workout (+Fitness)");
        break;
      case "stage":
        this.playShow();
        break;
      case "apt":
        if (this.ui.toast) this.ui.toast("Apartments: home instances coming soon");
        break;
      default:
        if (this.ui.toast) this.ui.toast(lm.text);
    }
  }

  tickNeeds(dt){
    // Drain rates per second while active
    // (tuned to feel pressure but not instantly kill you)
    this.player.hunger  = clamp(this.player.hunger  - dt * 0.35, 0, 100);
    this.player.sleep   = clamp(this.player.sleep   - dt * 0.22, 0, 100);
    this.player.hygiene = clamp(this.player.hygiene - dt * 0.12, 0, 100);
    this.player.fitness = clamp(this.player.fitness - dt * 0.04, 0, 100);

    // Debuffs
    let speedMul = 1;
    let stamMul = 1;
    const low = (v) => v <= 20;
    if (low(this.player.hunger))  { speedMul *= 0.88; stamMul *= 0.90; }
    if (low(this.player.sleep))   { speedMul *= 0.86; stamMul *= 0.88; }
    if (low(this.player.hygiene)) { speedMul *= 0.95; }
    if (low(this.player.fitness)) { speedMul *= 0.92; }
    this.player.speedMul = speedMul;
    this.player.staminaMax = Math.max(40, 100 * stamMul);
    this.player.stamina = clamp(this.player.stamina, 0, this.player.staminaMax);

    // Health damage if needs hit zero
    const starving = this.player.hunger <= 0;
    const exhausted = this.player.sleep <= 0;
    const filthy = this.player.hygiene <= 0;
    const dmg = (starving ? 6 : 0) + (exhausted ? 5 : 0) + (filthy ? 2 : 0);
    if (dmg > 0){
      this.player.health = clamp(this.player.health - dmg * dt, 0, this.player.healthMax);
      this._dangerToastT = (this._dangerToastT || 0) + dt;
      if (this._dangerToastT > 3.5){
        this._dangerToastT = 0;
        if (this.ui.toast) this.ui.toast("You’re collapsing. Eat/Sleep/Wash.");
      }
    }

    // Rent tick
    this.tickRent(Date.now());

    // Permadeath (placeholder handling until legacy screen exists)
    if (this.player.health <= 0){
      this.player.health = 0;
      if (!this._dead){
        this._dead = true;
        if (this.ui.toast) this.ui.toast("YOU DIED. Permadeath (legacy screen next). Save wiped.");
        this.save.clear();
        setTimeout(()=>{
          this.state = "menu";
          this.ui.renderMenu({ hasSave:false });
        }, 1200);
      }
    }
  }

  tickRent(now){
    if (!this.player.rentDueAt) return;
    const overdue = now - this.player.rentDueAt;
    if (overdue <= 0) return;

    // Debt grows slowly while overdue
    const daysOver = overdue / (24*60*60*1000);
    this.player.rentDebt = Math.max(this.player.rentDebt, Math.floor(daysOver * 45));

    // Eviction after 1.5 days overdue (tunable)
    if (!this.player.evicted && daysOver >= 1.5){
      this.player.evicted = true;
      if (this.ui.toast) this.ui.toast("EVICTED. You lost your home (home system coming). Rep hit later.");
    }
  }

  getRentText(now){
    const due = this.player.rentDueAt || 0;
    if (!due) return "RENT: --";
    const ms = due - now;
    if (ms >= 0) return `RENT: ${formatCountdown(ms)} left`;
    return `RENT: OVERDUE (${formatCountdown(-ms)} late)`;
  }

  getVaultText(now){
    const today = dayKey(now);
    const ok = this.player.vaultLastDay !== today;
    return ok ? "VAULT: READY" : "VAULT: LOCKED";
  }

  useVault(){
    const today = dayKey(Date.now());
    if (this.player.vaultLastDay === today){
      if (this.ui.toast) this.ui.toast("Vault locked until midnight.");
      return;
    }

    // Simple vault interaction for V1: deposit 50% cash or withdraw fixed amount.
    // (Later: real vault UI + cars/clothes/items)
    const cash = this.player.money;
    if (cash > 0){
      const dep = Math.max(1, Math.floor(cash * 0.5));
      this.player.money -= dep;
      this.player.vault.cash = (this.player.vault.cash || 0) + dep;
      this.player.vaultLastDay = today;
      if (this.ui.toast) this.ui.toast(`Vault: deposited $${dep}. (1/day)`);
      return;
    }
    // withdraw
    const available = this.player.vault.cash || 0;
    if (available <= 0){
      this.player.vaultLastDay = today;
      if (this.ui.toast) this.ui.toast("Vault empty. (1/day)");
      return;
    }
    const take = Math.min(80, available);
    this.player.vault.cash -= take;
    this.player.money += take;
    this.player.vaultLastDay = today;
    if (this.ui.toast) this.ui.toast(`Vault: withdrew $${take}. (1/day)`);
  }
  playShow(){
    const now = Date.now();
    const t = localClock(now);
    const mins = t.h*60 + t.m;
    const showMins = 20*60; // 8pm

    const today = dayKey(now);
    const inShowWindow = Math.abs(mins - showMins) <= 60; // within 1 hour

    // Any time: you can "practice/busk" (smaller tips)
    // At 8pm window: it's a real show (bigger tips + fame). Missing it later will hurt fame.
    const base = inShowWindow ? 55 : 18;
    const swing = inShowWindow ? 85 : 28;
    const fameBoost = Math.max(0, Math.min(50, Math.floor((this.player.fame || 0) / 4)));
    const tip = base + Math.floor(Math.random()*swing) + fameBoost;

    this.player.money += tip;
    this.player.hunger = clamp(this.player.hunger - (inShowWindow ? 1.2 : 0.4), 0, 100);
    this.player.sleep = clamp(this.player.sleep - (inShowWindow ? 0.8 : 0.2), 0, 100);

    if (inShowWindow){
      if (this.player.lastShowDay !== today){
        this.player.fame = (this.player.fame || 0) + 2;
        this.player.lastShowDay = today;
      }
      if (this.ui.toast) this.ui.toast(`8PM SHOW! NPCs tip $${tip}. (+Fame)`);
    } else {
      // practice only raises a tiny bit
      if (Math.random() < 0.25) this.player.fame = (this.player.fame || 0) + 1;
      if (this.ui.toast) this.ui.toast(`You busk. NPCs tip $${tip}.`);
    }

    this.fx.push({ type:"poof", x:this.player.x+this.player.w/2, y:this.player.y-4, t:0, dur:0.35 });
  }



  openMenu(tab){
    if (this.ui.setOverlayTab) this.ui.setOverlayTab(tab || "status");
    if (this.ui.setOverlayOpen) this.ui.setOverlayOpen(true);
  }

  handleUIAction(action, payload){
    switch(action){
      case "vault_deposit":
        this.vaultDeposit(payload?.amount);
        break;
      case "vault_withdraw":
        this.vaultWithdraw(payload?.amount);
        break;
      case "content_start":
        this.startContentJob();
        break;
      case "content_cancel":
        this.cancelContentJob();
        break;
    }
  }

  vaultLocked(now=Date.now()){
    const today = dayKey(now);
    return this.player.vaultLastDay === today;
  }

  markVaultUse(now=Date.now()){
    this.player.vaultLastDay = dayKey(now);
  }

  vaultDeposit(amount){
    const now = Date.now();
    if (this.vaultLocked(now)){
      if (this.ui.toast) this.ui.toast("Vault locked until midnight.");
      return;
    }
    const cash = Math.max(0, this.player.money|0);
    if (cash <= 0){
      this.markVaultUse(now);
      if (this.ui.toast) this.ui.toast("No cash to deposit. (Vault used today)");
      return;
    }
    let dep = 0;
    if (amount === "all") dep = cash;
    else dep = Math.min(cash, Math.max(1, amount|0));

    this.player.money -= dep;
    this.player.vault.cash = (this.player.vault.cash || 0) + dep;
    this.markVaultUse(now);
    if (this.ui.toast) this.ui.toast(`Deposited $${dep}. (1/day)`);
  }

  vaultWithdraw(amount){
    const now = Date.now();
    if (this.vaultLocked(now)){
      if (this.ui.toast) this.ui.toast("Vault locked until midnight.");
      return;
    }
    const avail = Math.max(0, this.player.vault.cash|0);
    if (avail <= 0){
      this.markVaultUse(now);
      if (this.ui.toast) this.ui.toast("Vault empty. (Vault used today)");
      return;
    }
    let take = 0;
    if (amount === "all") take = avail;
    else take = Math.min(avail, Math.max(1, amount|0));

    this.player.vault.cash -= take;
    this.player.money += take;
    this.markVaultUse(now);
    if (this.ui.toast) this.ui.toast(`Withdrew $${take}. (1/day)`);
  }

  // kept for compatibility (landmark E interact used to auto-deposit/withdraw)
  useVault(){
    this.openMenu("vault");
  }

  startContentJob(){
    // Must be near apartments landmark (home)
    const near = this._nearLm;
    if (!near || near.id !== "apt"){
      if (this.ui.toast) this.ui.toast("Do content at home. Go near Apartments.");
      return;
    }
    if (this.player.contentJob?.running){
      if (this.ui.toast) this.ui.toast("Already running.");
      return;
    }
    const durS = (this.player.contentJob?.durS || 60); // dev mode 1 min
    const now = Date.now();
    this.player.contentJob = { running:true, startedAt: now, endsAt: now + durS*1000, durS };
    if (this.ui.toast) this.ui.toast("Content job started (1 min).");
  }

  cancelContentJob(){
    if (!this.player.contentJob?.running) return;
    this.player.contentJob.running = false;
    this.player.contentJob.endsAt = 0;
    if (this.ui.toast) this.ui.toast("Content job cancelled.");
  }

  tickContentJob(){
    const cj = this.player.contentJob;
    if (!cj || !cj.running) return;
    const now = Date.now();
    if (now < cj.endsAt) return;

    // complete
    cj.running = false;
    cj.endsAt = 0;

    const payout = 70 + Math.floor(Math.random()*70) + Math.max(0, Math.floor((this.player.fame||0) / 2));
    this.player.money += payout;
    this.player.fame = (this.player.fame || 0) + 2;

    // costs
    this.player.sleep = clamp(this.player.sleep - 3, 0, 100);
    this.player.hunger = clamp(this.player.hunger - 2, 0, 100);

    this._contentCompletedFlag = true;
    if (this.ui.toast) this.ui.toast(`Content posted. Earned $${payout}. (+Fame)`);
  }

  tickQuest(){
    // simple starter quest for Actor district
    if (!this.player.quests) this.player.quests = { active:"actor_v15", completed:{} };
    if (this.player.quests.active !== "actor_v15") return;

    const total = (this.player.money|0) + ((this.player.vault?.cash|0) || 0);
    const didVault = !!this.player.vaultLastDay;
    const didShowToday = (this.player.lastShowDay === dayKey(Date.now())) || false;
    const didContent = (this._didContentOnce || false);

    // mark content completion once per life
    if (!this._didContentOnce && !this.player.contentJob?.running && this._contentCompletedFlag){
      this._didContentOnce = true;
    }

    // completion condition (starter): reach $250 total + touch vault once + do one income activity
    const incomeDone = didContent || didShowToday;
    if (total >= 250 && didVault && incomeDone){
      this.player.quests.completed["actor_v15"] = true;
      this.player.quests.active = "";
      if (this.ui.toast) this.ui.toast("Quest complete: you proved you can survive the district.");
    }
  }

  buildOverlayData(now){
    const locked = this.vaultLocked(now);
    const unlockText = locked ? "resets at midnight" : "use once today";

    // content remaining text
    const cj = this.player.contentJob || { running:false };
    let remainingText = "";
    if (cj.running){
      const ms = Math.max(0, cj.endsAt - now);
      const s = Math.ceil(ms/1000);
      const m = Math.floor(s/60);
      const r = s%60;
      remainingText = (m>0) ? `${m}m ${r}s` : `${r}s`;
    }

    // quest steps
    const total = (this.player.money|0) + ((this.player.vault?.cash|0) || 0);
    const didVault = !!this.player.vaultLastDay;
    const didShowToday = (this.player.lastShowDay === dayKey(now));
    const didContentOnce = !!this._didContentOnce;

    const steps = [
      { text: "Build your cushion: reach $250 total (cash + vault)", sub: `$${total} / $250`, done: total >= 250 },
      { text: "Use the District Vault once", sub: didVault ? "Done" : "Go to the Vault or open it from E", done: didVault },
      { text: "Earn money today (Show or Content)", sub: (didShowToday || didContentOnce) ? "Done" : "Busk at Stage or do Content at Apartments", done: (didShowToday || didContentOnce) },
    ];

    return {
      status: {
        health: this.player.health,
        stamina: this.player.stamina,
        staminaMax: this.player.staminaMax,
        hunger: this.player.hunger,
        sleep: this.player.sleep,
        hygiene: this.player.hygiene,
        fitness: this.player.fitness,
        fame: this.player.fame,
        streetRep: this.player.streetRep,
        heat: this.player.heat,
        morality: this.player.morality,
      },
      quests: {
        title: "Actor District: Prove You Can Survive",
        desc: "Earn money, save money, show up. This is the first grind loop.",
        steps
      },
      vault: {
        locked,
        unlockText,
        cash: this.player.money,
        vaultCash: (this.player.vault?.cash || 0)
      },
      phone: {
        running: !!cj.running,
        remainingText
      }
    };
  }

  moveWithCollision(dx, dy){
    if (!dx && !dy) return;

    const next = { x: this.player.x + dx, y: this.player.y + dy, w: this.player.w, h: this.player.h };
    if (!this.world.hitsSolid(next)){
      this.player.x = next.x;
      this.player.y = next.y;
      return;
    }

    // small steps to reduce sticky feel
    const steps = 6;
    for (let i=1; i<=steps; i++){
      const sx = dx * (i/steps);
      const sy = dy * (i/steps);
      const test = { x: this.player.x + sx, y: this.player.y + sy, w: this.player.w, h: this.player.h };
      if (!this.world.hitsSolid(test)){
        this.player.x = test.x;
        this.player.y = test.y;
      } else break;
    }
  }

  getAreaName(x,y,role){
    if (y > 1080) return "South Side";
    if (x > 1850 && y > 720) return "Civic District";
    if (y < 700 && x > 980 && x < 1780) return "Studio Row";
    if (x < 900 && y < 760) return "Midtown";
    return "Crossroads";
  }

  render(){
    const ctx = this.ctx;

    // world
    this.world.draw(ctx, this.camera);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // FX under player
    for (let i=0; i<this.fx.length; i++){
      const f = this.fx[i];
      if (f.type === "poof"){
        const p = f.t / f.dur;
        ctx.globalAlpha = (1 - p) * 0.35;
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, 6 + p*12, 3 + p*6, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (f.type === "dash"){
        const p = f.t / f.dur;
        ctx.globalAlpha = (1 - p) * 0.25;
        ctx.strokeStyle = "rgba(138,46,255,.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.x - f.dx*28*p, f.y - f.dy*28*p);
        ctx.lineTo(f.x - f.dx*28*(p+0.25), f.y - f.dy*28*(p+0.25));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // shadow (jump squash)
    const shadowScale = this.player.jumpT > 0 ? 0.78 : 1;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(
      this.player.x + this.player.w/2,
      this.player.y + this.player.h + 5,
      12 * shadowScale,
      6 * shadowScale,
      0, 0, Math.PI*2
    );
    ctx.fill();

    // player sprite
    this.playerSprite.draw(ctx, this.player);

    // above-layer props
    if (this.world.drawAbove) this.world.drawAbove(ctx, this.camera);

    ctx.restore();
  }
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function pad2(n){ return String(n|0).padStart(2, "0"); }

function localClock(ms){
  const d = new Date(ms);
  return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), day: dayKey(ms) };
}

function dayKey(ms){
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function nextTodayAt(nowMs, hh, mm){
  const d = new Date(nowMs);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0).getTime();
  // if already passed, return tomorrow's
  if (target <= nowMs) return new Date(d.getFullYear(), d.getMonth(), d.getDate()+1, hh, mm, 0, 0).getTime();
  return target;
}

function formatCountdown(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}
