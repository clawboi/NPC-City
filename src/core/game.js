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

      // facing direction (used for dodge/punch)
      faceX: 0, faceY: 1,

      // action state
      z: 0,          // jump height (visual)
      jumpT: 0,
      dodgeT: 0,
      dodgeCd: 0,
      punchT: 0,
      punchCd: 0,
      iFrames: 0,    // invulnerability window (for later combat)

      stamina: 100,
      staminaMax: 100,

      money: 40,
      area: "",
    };

    this.camera = {
      x: 0, y: 0,
      vw: canvas.width,
      vh: canvas.height,
    };

    // FX
    this.fx = []; // {t, dur, type, ...}

    // UI hooks
    ui.onStart = (role) => this.startNew(role);
    ui.onContinue = () => this.continueGame();
    ui.onNew = () => this.newGameMenu();
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
    this.player.area = spawn.area;

    // reset actions
    this.player.faceX = 0; this.player.faceY = 1;
    this.player.z = 0;
    this.player.jumpT = 0;
    this.player.dodgeT = 0;
    this.player.dodgeCd = 0;
    this.player.punchT = 0;
    this.player.punchCd = 0;
    this.player.iFrames = 0;
    this.player.stamina = this.player.staminaMax;

    this.fx.length = 0;

    this.state = "play";
    this.ui.hideMenu();
    this.persist();
  }

  continueGame(){
    const data = this.save.load();
    if (!data) return this.newGameMenu();
    this.player = { ...this.player, ...data.player };

    // safety: ensure action fields exist for older saves
    this.player.faceX ??= 0; this.player.faceY ??= 1;
    this.player.z ??= 0;
    this.player.jumpT ??= 0;
    this.player.dodgeT ??= 0;
    this.player.dodgeCd ??= 0;
    this.player.punchT ??= 0;
    this.player.punchCd ??= 0;
    this.player.iFrames ??= 0;
    this.player.staminaMax ??= 100;
    this.player.stamina = clamp(this.player.stamina ?? this.player.staminaMax, 0, this.player.staminaMax);

    this.state = "play";
    this.ui.hideMenu();
  }

  persist(){
    this.save.write({
      v: 2,
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
      }
    });
  }

  loop(t){
    const dt = Math.min(0.033, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;

    this.update(dt);
    this.render();

    this.input.endFrame();
    requestAnimationFrame((tt)=>this.loop(tt));
  }

  update(dt){
    if (this.state !== "play") return;

    // timers
    this.player.dodgeCd = Math.max(0, this.player.dodgeCd - dt);
    this.player.punchCd = Math.max(0, this.player.punchCd - dt);
    this.player.iFrames = Math.max(0, this.player.iFrames - dt);

    // stamina regen (slow while acting)
    const acting = (this.player.dodgeT > 0) || (this.player.punchT > 0) || (this.player.jumpT > 0);
    const regen = acting ? 12 : 22;
    this.player.stamina = clamp(this.player.stamina + regen * dt, 0, this.player.staminaMax);

    // Reset spawn quick dev key
    if (this.input.pressed("r")){
      const sp = this.world.getSpawn(this.player.role);
      this.player.x = sp.x;
      this.player.y = sp.y;
      this.player.area = sp.area;
      this.persist();
      this.ui.toast?.("Reset spawn");
    }

    // ===== INPUT AXIS + FACING =====
    const a = this.input.axis();
    let ax = a.x, ay = a.y;
    const amag = Math.hypot(ax, ay);
    if (amag > 0){
      ax /= amag; ay /= amag;
      // update facing (only when you actually move)
      this.player.faceX = ax;
      this.player.faceY = ay;
    }

    // ===== ACTIONS =====
    // Controls:
    //   Shift: run
    //   Space: jump (visual)
    //   C: dodge
    //   F: punch
    //   E: interact

    // Jump (visual hop with shadow squash)
    if (this.input.pressed(" ") && this.player.jumpT <= 0){
      const cost = 12;
      if (this.player.stamina >= cost){
        this.player.stamina -= cost;
        this.player.jumpT = 0.28;
        this.fx.push({ type:"poof", x:this.player.x+this.player.w/2, y:this.player.y+this.player.h+6, t:0, dur:0.22 });
      }
    }

    // Dodge (burst in facing direction)
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

    // Punch (short swing, for now just visual)
    if (this.input.pressed("f") && this.player.punchCd <= 0 && this.player.punchT <= 0){
      const cost = 10;
      if (this.player.stamina >= cost){
        this.player.stamina -= cost;
        this.player.punchT = 0.12;
        this.player.punchCd = 0.18;
      }
    }

    // Interact prompt (near landmarks)
    const lm = this.world.nearestLandmark?.(
      this.player.x + this.player.w/2,
      this.player.y + this.player.h/2,
      62
    );
    if (lm){
      this.ui.setPrompt?.(`E · ${lm.text}  ·  ${lm.hint || "Interact"}`);
      if (this.input.pressed("e")){
        this.handleInteract(lm);
      }
    } else {
      this.ui.setPrompt?.("");
    }

    // ===== MOVEMENT =====
    // if dodging, override movement with burst
    let dx = 0, dy = 0;

    if (this.player.dodgeT > 0){
      this.player.dodgeT = Math.max(0, this.player.dodgeT - dt);
      const spd = 520;
      dx = this.player.faceX * spd * dt;
      dy = this.player.faceY * spd * dt;
    } else {
      // normal movement
      const run = this.input.down("shift");
      const speed = run ? 220 : 150;

      // slight slowdown while punching/jumping
      const slow = (this.player.punchT > 0) ? 0.55 : (this.player.jumpT > 0 ? 0.85 : 1.0);
      dx = ax * speed * slow * dt;
      dy = ay * speed * slow * dt;
    }

    // tick action timers
    if (this.player.punchT > 0) this.player.punchT = Math.max(0, this.player.punchT - dt);
    if (this.player.jumpT > 0) this.player.jumpT = Math.max(0, this.player.jumpT - dt);

    // apply jump curve (visual)
    if (this.player.jumpT > 0){
      const p = 1 - (this.player.jumpT / 0.28);
      this.player.z = Math.sin(p * Math.PI) * 10;
    } else {
      this.player.z = 0;
    }

    // Collide per-axis for smooth sliding
    this.moveWithCollision(dx, 0);
    this.moveWithCollision(0, dy);

    // Clamp to world bounds
    this.player.x = clamp(this.player.x, 0, this.world.w - this.player.w);
    this.player.y = clamp(this.player.y, 0, this.world.h - this.player.h);

    // Camera follow (smooth, then pixel-snap to stop shimmer)
const targetX = this.player.x + this.player.w * 0.5 - this.camera.vw * 0.5;
const targetY = this.player.y + this.player.h * 0.5 - this.camera.vh * 0.5;

const clampedX = clamp(targetX, 0, this.world.w - this.camera.vw);
const clampedY = clamp(targetY, 0, this.world.h - this.camera.vh);

// Smooth follow
this.camera.x = lerp(this.camera.x, clampedX, 0.12);
this.camera.y = lerp(this.camera.y, clampedY, 0.12);

// Pixel-snap (kills the “static/shaky” look)
this.camera.x = Math.round(this.camera.x);
this.camera.y = Math.round(this.camera.y);

    // Determine area name (simple rule: based on regions)
    this.player.area = this.getAreaName(this.player.x, this.player.y, this.player.role);

    // HUD
    this.ui.setHUD({
      role: this.player.role,
      area: this.player.area,
      money: this.player.money,
      stamina: this.player.stamina,
      staminaMax: this.player.staminaMax
    });

    // FX tick
    for (const f of this.fx){
      f.t += dt;
    }
    this.fx = this.fx.filter(f => f.t < f.dur);

    // Autosave (light)
    this._saveTimer = (this._saveTimer || 0) + dt;
    if (this._saveTimer > 1.5){
      this._saveTimer = 0;
      this.persist();
    }
  }

  handleInteract(lm){
    // Tiny “placeholder interactions” so the city feels alive immediately.
    switch (lm.id){
      case "bodega":
        this.ui.toast?.("Bodega: snacks + items coming soon");
        break;
      case "studio":
        this.ui.toast?.("Studio Gate: auditions coming soon");
        break;
      case "police_hq":
        this.ui.toast?.("Police HQ: jobs + heat system coming soon");
        break;
      case "bus_stop":
        this.ui.toast?.("Bus Stop: fast travel coming soon");
        break;
      default:
        this.ui.toast?.(lm.text);
    }
  }

  moveWithCollision(dx, dy){
    if (!dx && !dy) return;
    const next = {
      x: this.player.x + dx,
      y: this.player.y + dy,
      w: this.player.w,
      h: this.player.h
    };
    if (!this.world.hitsSolid(next)){
      this.player.x = next.x;
      this.player.y = next.y;
      return;
    }
    // If collision, try smaller step to avoid “sticky” feel
    const steps = 6;
    for (let i=1; i<=steps; i++){
      const sx = dx * (i/steps);
      const sy = dy * (i/steps);
      const test = { x: this.player.x + sx, y: this.player.y + sy, w:this.player.w, h:this.player.h };
      if (!this.world.hitsSolid(test)){
        this.player.x = test.x;
        this.player.y = test.y;
      } else {
        break;
      }
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

    // World
    this.world.draw(ctx, this.camera);

    // Entities + FX
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // FX under player
    for (const f of this.fx){
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

    // Shadow (squash when jumping)
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

    drawPlayerGhibliZelda(ctx, this.player);

    // Punch ring (visual)
    if (this.player.punchT > 0){
      const fx = this.player.faceX || 0;
      const fy = this.player.faceY || 1;
      const cx = this.player.x + this.player.w/2 + fx*16;
      const cy = this.player.y + this.player.h/2 + fy*16 + liftY;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ... draw player ...

// NEW: draw above-layer props (tree canopies, etc.)
this.world.drawAbove?.(ctx, this.camera);

ctx.restore();

  }
}

// ===== PLAYER SPRITE: Studio Ghibli x Zelda (no images) =====
// Design notes (why it feels right):
// - Big readable head + eyes (Ghibli warmth) but compact silhouette (Zelda clarity)
// - Tunic + belt + satchel strap = "adventure" without needing gear systems yet
// - Soft outline (not harsh black) so it blends with your dreamy UI
// - Tiny idle-breath bob so the character feels alive even when standing

function drawPlayerGhibliZelda(ctx, p){
  // Base sprite size in "pixel units"
  const px = 2; // pixel scale (2 = crisp but detailed on 960x540)
  const W = 16 * px;
  const H = 22 * px;

  // Anchor: center on collider, feet at bottom
  const cx = p.x + p.w/2;
  const feetY = p.y + p.h + 2;
  const sx = Math.round(cx - W/2);
  const sy = Math.round(feetY - H - (p.z || 0));

  // Gentle idle bob (breathing)
  const t = performance.now() * 0.002;
  const bob = (p.jumpT > 0 || p.dodgeT > 0 || p.punchT > 0) ? 0 : Math.round(Math.sin(t) * 1);
  const y = sy + bob;

  // Palette (warm, painterly, "Ghibli-ish" but still game readable)
  const outline = "rgba(10,10,18,.55)";
  const skin    = "#f1c7a6";
  const blush   = "rgba(255,120,160,.28)";
  const hair    = "#2a1b14";
  const tunic   = "#2faa53";     // classic heroic green
  const tunic2  = "#1f7f42";     // shadow green
  const belt    = "#6b4b2a";
  const metal   = "#c9c0ae";
  const boots   = "#2a1f18";
  const strap   = "#4a3424";
  const bag     = "#7a5a3a";
  const eye     = "#1a1a1a";
  const eye2    = "rgba(255,255,255,.85)";

  // Shadow on ground (already in your code too, but this helps sprite feel anchored)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, feetY + 2, 12, 6, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Helper: chunky pixel rect with optional outline
  function box(x, y, w, h, fill){
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  function oBox(x, y, w, h, fill){
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  // ========= SILHOUETTE LAYERS =========

  // Cape-ish back cloth (subtle, not full cape)
  ctx.save();
  ctx.globalAlpha = 0.65;
  box(sx + 3*px, y + 9*px, 10*px, 10*px, "rgba(20,40,30,.45)");
  ctx.restore();

  // ---- HEAD (big + soft) ----
  // Head base (stepped edges)
  box(sx + 4*px, y + 1*px, 8*px, 7*px, skin);
  box(sx + 5*px, y + 0*px, 6*px, 1*px, skin); // top rounding hint

  // Hair cap
  box(sx + 4*px, y + 1*px, 8*px, 3*px, hair);
  box(sx + 3*px, y + 2*px, 10*px, 2*px, hair);

  // Side bangs (Ghibli softness)
  box(sx + 3*px, y + 4*px, 2*px, 2*px, hair);
  box(sx + 11*px, y + 4*px, 2*px, 2*px, hair);

  // Eyes (big but not anime)
  box(sx + 6*px, y + 4*px, 1*px, 1*px, eye);
  box(sx + 9*px, y + 4*px, 1*px, 1*px, eye);
  // tiny highlight
  ctx.save();
  ctx.globalAlpha = 0.9;
  box(sx + 6*px, y + 3*px, 1*px, 1*px, eye2);
  box(sx + 9*px, y + 3*px, 1*px, 1*px, eye2);
  ctx.restore();

  // Blush
  ctx.save();
  ctx.globalAlpha = 0.9;
  box(sx + 5*px, y + 5*px, 1*px, 1*px, blush);
  box(sx + 10*px, y + 5*px, 1*px, 1*px, blush);
  ctx.restore();

  // ---- BODY / TUNIC (Zelda read) ----
  // Torso
  oBox(sx + 4*px, y + 8*px, 8*px, 7*px, tunic);
  // Shadow side
  ctx.save();
  ctx.globalAlpha = 0.55;
  box(sx + 9*px, y + 8*px, 3*px, 7*px, tunic2);
  ctx.restore();

  // Belt
  box(sx + 4*px, y + 12*px, 8*px, 2*px, belt);
  // Buckle
  box(sx + 7*px, y + 12*px, 2*px, 2*px, metal);

  // Strap (satchel strap)
  ctx.save();
  ctx.globalAlpha = 0.9;
  box(sx + 5*px, y + 9*px, 1*px, 6*px, strap);
  box(sx + 6*px, y + 10*px, 1*px, 6*px, strap);
  ctx.restore();

  // Satchel (small, adventure vibe)
  oBox(sx + 2*px, y + 12*px, 3*px, 3*px, bag);

  // ---- ARMS ----
  // Left arm
  box(sx + 2*px, y + 9*px, 2*px, 5*px, tunic);
  box(sx + 2*px, y + 14*px, 2*px, 2*px, skin);
  // Right arm
  box(sx + 12*px, y + 9*px, 2*px, 5*px, tunic);
  box(sx + 12*px, y + 14*px, 2*px, 2*px, skin);

  // ---- LEGS / BOOTS ----
  // Shorts/undercloth hint
  ctx.save();
  ctx.globalAlpha = 0.35;
  box(sx + 5*px, y + 15*px, 6*px, 1*px, "rgba(0,0,0,.5)");
  ctx.restore();

  // Boots
  oBox(sx + 5*px, y + 16*px, 3*px, 4*px, boots);
  oBox(sx + 8*px, y + 16*px, 3*px, 4*px, boots);

  // Tiny toe shine (makes it feel “painted” not flat)
  ctx.save();
  ctx.globalAlpha = 0.18;
  box(sx + 6*px, y + 18*px, 1*px, 1*px, "#fff");
  box(sx + 9*px, y + 18*px, 1*px, 1*px, "#fff");
  ctx.restore();
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
