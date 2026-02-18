// src/entities/player.js
// NPC City Player — Reference Sprite Skeleton v8 (pure pixels, no images)
// What this version fixes/adds (without changing your game API):
// - Walk = classic Pokémon: legs go OUT/IN (no thrust). Feet only, clean cadence.
// - Side walk = simple up/down foot swap, but body/legs are a touch wider.
// - Punch = an actual SWING: wind-up -> arc forward -> recoil.
//   Full-length arm segments follow the swing, in the facing direction.
// - Back (N) = hair + real head/neck (no “hair-only head”).
// - Inventory/held item hook: if p.held (string/object) or p.item is set,
//   it draws a small pixel “tool/weapon” in the active hand.
//   (You can patch in different icons easily in _drawHeldItem()).

export class Player {
  constructor(){
    this._lastX = 0;
    this._lastY = 0;
    this._lastT = 0;

    this._blinkNext = 1.6;
    this._blinkHold = 0;

    this._step = 0;
    this._facing = "S";
  }

  reset(p){
    this._lastX = p.x;
    this._lastY = p.y;
    this._lastT = performance.now();
    this._blinkNext = 1.2 + Math.random()*2.4;
    this._blinkHold = 0;
    this._step = 0;
    this._facing = this._faceDir(p.faceX || 0, p.faceY || 1);
  }

  draw(ctx, p){
    const now = performance.now();
    if (!this._lastT) this.reset(p);

    // dt clamp
    let dt = (now - this._lastT) / 1000;
    if (!isFinite(dt) || dt <= 0) dt = 1/60;
    if (dt < 1/144) dt = 1/144;
    if (dt > 1/24)  dt = 1/24;

    const vx = (p.x - this._lastX) / dt;
    const vy = (p.y - this._lastY) / dt;
    const speed = Math.hypot(vx, vy);

    this._lastX = p.x;
    this._lastY = p.y;
    this._lastT = now;

    const moving  = speed > 8;
    const running = speed > 165;

    // update facing only with intent (prevents twitch)
    const fx = p.faceX || 0, fy = p.faceY || 0;
    if (Math.abs(fx) + Math.abs(fy) > 0.25) this._facing = this._faceDir(fx, fy);
    const face = this._facing;

    const punching = p.punchT > 0;
    const acting = punching || (p.jumpT > 0) || (p.dodgeT > 0);

    // step cadence (Pokémon-ish)
    const stepRate = moving ? (running ? 13.5 : 8.6) : 1.0;
    this._step += dt * stepRate;

    // blink
    if (this._blinkHold > 0){
      this._blinkHold = Math.max(0, this._blinkHold - dt);
    } else {
      this._blinkNext -= dt;
      if (this._blinkNext <= 0){
        this._blinkHold = 0.10;
        this._blinkNext = 1.1 + Math.random()*3.0;
      }
    }
    const blinking = this._blinkHold > 0;

    // size + anchor
    const px = 2;
    const SW = 16, SH = 20;
    const W = SW * px, H = SH * px;

    const cx = p.x + p.w/2;
    const feetY = p.y + p.h + 2;

    // tiny idle breathe only
    const bob = (!moving && !acting) ? (Math.sin(now * 0.0017) * 0.25) : 0;

    const sx = Math.round(cx - W/2);
    const sy = Math.round(feetY - H - (p.z || 0) + bob);

    // palette (from your reference)
    const C = {
      teal:   "#309988",
      tealS:  "#3B6364",
      navy:   "#31325A",
      hair:   "#402632",
      pants:  "#4D5499",
      shirt1: "#703E50",
      shirt2: "#7E3541",
      shirt3: "#7F3441",
      skin:   "#F9BEA6",
      blush:  "#EE8C7B",
      white:  "#FFFFFF",
      // held-item accents (safe defaults)
      steel:  "#cfd6e6",
      steelS: "#7a86a6",
      wood:   "#8a5a2b",
      glow:   "#ffea6a"
    };

    const P = (ix, iy, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(sx + ix*px, sy + iy*px, px, px);
    };

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, feetY + 2, 12, 6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // 4-frame walk: 0 idle, 1 stepA, 2 idle, 3 stepB
    let frame = 0;
    if (moving && !acting){
      const t = this._step % 4;
      frame = (t < 1) ? 0 : (t < 2) ? 1 : (t < 3) ? 2 : 3;
    }
    const stepA = (frame === 1);
    const stepB = (frame === 3);

    // run = slightly larger spread
    const stride = moving ? (running ? 2 : 1) : 0;

    // =========================
    // CLEAN WALK OFFSETS (NO THRUST)
    // =========================
    // N/S: feet spread OUT/IN in X only (primary). Optional tiny 0/1 lift on stepping foot.
    // E/W: feet alternate UP/DOWN in Y (classic side shuffle), with a *tiny* run-only nudge.
    const isNS = (face === "N" || face === "S");
    const isEW = (face === "E" || face === "W");

    let lfX = 0, lfY = 0, rfX = 0, rfY = 0;

    if (moving && !acting){
      if (isNS){
        const spread = stride; // 1 walk / 2 run
        lfX = stepA ? -spread : stepB ? spread : 0;
        rfX = stepA ?  spread : stepB ? -spread : 0;

        // optional tiny lift: only 1px, only the stepping foot, keeps it readable
        lfY = stepA ? -1 : 0;
        rfY = stepB ? -1 : 0;
      } else if (isEW){
        const lift = 1;
        lfY = stepA ? -lift : stepB ? lift : 0;
        rfY = stepA ?  lift : stepB ? -lift : 0;

        const nudge = running ? 1 : 0;
        if (face === "E"){ lfX = stepA ? nudge : 0; rfX = stepB ? nudge : 0; }
        if (face === "W"){ lfX = stepA ? -nudge : 0; rfX = stepB ? -nudge : 0; }
      }
    }

    // hip weight shift: perpendicular only
    let hipX = 0, hipY = 0;
    if (moving && !acting){
      if (isNS) hipX = stepA ? 1 : stepB ? -1 : 0;
      else     hipY = stepA ? 1 : stepB ? -1 : 0;
    }

    // walk arm swing: opposite step (1px)
    const armSwing = (moving && !acting) ? 1 : 0;
    const lArmOff = stepA ? -armSwing : stepB ? armSwing : 0;
    const rArmOff = stepA ?  armSwing : stepB ? -armSwing : 0;

    // =========================
    // PUNCH = REAL SWING (windup -> arc -> recoil)
    // =========================
    // We keep using p.punchT (0..1, counting down in your code).
    // swingP goes 0..1 forward through the animation.
    let swingP = 0;
    if (punching){
      const t = Math.max(0, Math.min(1, p.punchT));
      swingP = 1 - t;
    }

    // Direction vector (grid pixels)
    const dir = this._dirVec(face); // {dx,dy} in {-1,0,1}
    const perp = { dx: -dir.dy, dy: dir.dx };

    // Swing curve:
    // - windup: pull back slightly (0..0.25)
    // - strike: sweep forward in an arc (0.25..0.65)
    // - recoil: come back toward neutral (0.65..1)
    const swing = this._swingOffsets(swingP, dir, perp);

    // Which arm leads (feels natural per facing)
    // S/E = right leads, N/W = left leads
    const rightLeads = (face === "S" || face === "E");

    // =========================
    // HELD ITEM (inventory hook)
    // =========================
    const held = p.held ?? null; // ONLY show held item when p.held is set

    // Route draw by facing
    if (face === "S"){
      this._drawFront(P, C, {
        blinking, hipX, hipY,
        lfX, lfY, rfX, rfY,
        lArmOff, rArmOff,
        punching, swing, rightLeads,
        held
      });
    } else if (face === "N"){
      this._drawBack(P, C, {
        hipX, hipY,
        lfX, lfY, rfX, rfY,
        lArmOff, rArmOff,
        punching, swing, rightLeads,
        held
      });
    } else if (face === "E"){
      this._drawSide(P, C, {
        dir:"E", hipX, hipY,
        lfX, lfY, rfX, rfY,
        lArmOff, rArmOff,
        punching, swing,
        held
      });
    } else {
      this._drawSide(P, C, {
        dir:"W", hipX, hipY,
        lfX, lfY, rfX, rfY,
        lArmOff, rArmOff,
        punching, swing,
        held
      });
    }

    // spark can stay if you like it (optional). It now follows the real swing tip.
    if (punching){
      this._drawPunchSpark(ctx, p, face);
    }
  }

  // ==========================================================
  // FRONT (S)
  // ==========================================================
  _drawFront(P, C, s){
    const {
      blinking, hipX, hipY,
      lfX, lfY, rfX, rfY,
      lArmOff, rArmOff,
      punching, swing, rightLeads,
      held
    } = s;

    // ---- HAIR (fuller mass + bun) ----
    [
      [6,0],[7,0],[8,0],[9,0],
      [5,1],[6,1],[7,1],[8,1],[9,1],[10,1],
      [5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
      [5,3],[6,3],[7,3],[8,3],[9,3],[10,3],
      [5,4],[10,4],
      [4,2],[4,3],[11,2],[11,3],
      [4,4],[11,4]
    ].forEach(([x,y])=>P(x,y,C.hair));

    // ---- FACE ----
    [
      [6,3],[7,3],[8,3],[9,3],
      [5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
      [5,5],[6,5],[7,5],[8,5],[9,5],[10,5],
      [6,6],[7,6],[8,6],[9,6],
    ].forEach(([x,y])=>P(x,y,C.skin));
    P(6,6,C.blush); P(9,6,C.blush);

    // eyes
    if (blinking){
      P(7,5,C.hair); P(8,5,C.hair);
    } else {
      P(7,5,C.white); P(8,5,C.white);
      P(7,5,C.navy);  P(8,5,C.navy);
      P(7,4,C.white);
    }

    // ---- BODY (shifted by hip sway) ----
    const bx = hipX, by = hipY;

    [
      [5,7],[6,7],[7,7],[8,7],[9,7],[10,7],
      [4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],
      [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],
      [4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
      [5,11],[6,11],[7,11],[8,11],[9,11],[10,11],
    ].forEach(([x,y])=>P(x+bx,y+by,C.shirt2));

    [ [10,8],[10,9],[10,10],[9,10],[9,9] ].forEach(([x,y])=>P(x+bx,y+by,C.shirt1));
    [ [6,10],[7,10],[8,10] ].forEach(([x,y])=>P(x+bx,y+by,C.shirt3));

    // straps
    [ [5,8],[5,9],[5,10] ].forEach(([x,y])=>P(x+bx,y+by,C.teal));
    [ [10,8],[10,9],[10,10] ].forEach(([x,y])=>P(x+bx,y+by,C.teal));
    [ [6,9],[9,9] ].forEach(([x,y])=>P(x+bx,y+by,C.tealS));
    P(3+bx,9+by,C.tealS);
    P(12+bx,9+by,C.tealS);

    // ---- ARMS ----
    // Hand anchor points (front)
    const Lhand = { x: 4+bx,  y: 13+by + lArmOff };
    const Rhand = { x: 11+bx, y: 13+by + rArmOff };

    if (!punching){
      // left sleeve + hand
      P(4+bx, 11+by + lArmOff, C.shirt2);
      P(4+bx, 12+by + lArmOff, C.shirt1);
      P(Lhand.x, Lhand.y, C.skin);

      // right sleeve + hand
      P(11+bx, 11+by + rArmOff, C.shirt2);
      P(11+bx, 12+by + rArmOff, C.shirt1);
      P(Rhand.x, Rhand.y, C.skin);

      // held item in the “active” hand (right by default)
      if (held) this._drawHeldItem(P, C, held, "S", /*hand*/Rhand);
    } else {
      // swinging punch
      const lead = rightLeads ? "R" : "L";
      const leadHand = (lead === "R") ? Rhand : Lhand;
      const rearHand = (lead === "R") ? Lhand : Rhand;

      // rear arm stays tucked (2px)
      this._drawArmSegments(P, C, rearHand, { dx: 0, dy: -1 }, 2, /*hand*/false);

      // lead arm swing: arc offsets in swing.tipOff and swing.midOff
      // draw 3-5 segments so it feels like a real arm, not a stick
      this._drawSwingArm(P, C, leadHand, swing, /*segments*/4);

     // HELD ITEM — attaches to correct hand position
if (held){
  const handX = (rightLeads ? 11 : 4) + hipX;
  const handY = 12 + hipY + (rightLeads ? rArmOff : lArmOff);

  this._drawHeldItem(P, C, held, face, {
    x: handX,
    y: handY
  });
}
    }

    // ---- PANTS ----
    [
      [5,12],[6,12],[7,12],[8,12],[9,12],[10,12],
      [5,13],[6,13],[7,13],[8,13],[9,13],[10,13],
    ].forEach(([x,y])=>P(x+bx,y+by,C.pants));
    [ [9,13],[10,13],[10,12] ].forEach(([x,y])=>P(x+bx,y+by,C.navy));

    // ---- LEGS (short) + SOCKS ----
    const Lx = 6+bx, Rx = 9+bx;
    const y14 = 14+by, y15 = 15+by, y16 = 16+by;

    // compact leg read: swing leg bends at y15
    const Lswing = (lfX !== 0 || lfY !== 0);
    const Rswing = (rfX !== 0 || rfY !== 0);

    if (!Lswing){ P(Lx,y14,C.skin); P(Lx,y15,C.skin); }
    else { P(Lx,y15,C.skin); P(Lx+1,y15,C.skin); }

    if (!Rswing){ P(Rx,y14,C.skin); P(Rx,y15,C.skin); }
    else { P(Rx,y15,C.skin); P(Rx-1,y15,C.skin); }

    P(Lx,y16,C.white);
    P(Rx,y16,C.white);

    // ---- SHOES (spread / lift only) ----
    const shoeY = 17+by;

    const lfx = Lx + lfX, lfy = shoeY + lfY;
    P(lfx,   lfy,   C.navy);
    P(lfx,   lfy+1, C.navy);
    P(lfx+1, lfy+1, C.navy);
    P(lfx,   lfy+2, C.white);

    const rfx = Rx + rfX, rfy = shoeY + rfY;
    P(rfx,   rfy,   C.navy);
    P(rfx,   rfy+1, C.navy);
    P(rfx-1, rfy+1, C.navy);
    P(rfx,   rfy+2, C.white);
  }

  // ==========================================================
  // BACK (N) — head/neck exists
  // ==========================================================
  _drawBack(P, C, s){
    const {
      hipX, hipY,
      lfX, lfY, rfX, rfY,
      lArmOff, rArmOff,
      punching, swing, rightLeads,
      held
    } = s;

    const bx = hipX, by = hipY;

    // hair back mass
    [
      [6,0],[7,0],[8,0],[9,0],
      [5,1],[6,1],[7,1],[8,1],[9,1],[10,1],
      [5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
      [5,3],[6,3],[7,3],[8,3],[9,3],[10,3],
      [4,2],[4,3],[11,2],[11,3],
      [4,4],[5,4],[10,4],[11,4],
    ].forEach(([x,y])=>P(x,y,C.hair));

    // head/neck under hair
    [
      [6,5],[7,5],[8,5],[9,5],
      [7,6],[8,6],
    ].forEach(([x,y])=>P(x,y,C.skin));

    // hoodie back
    [
      [5,7],[6,7],[7,7],[8,7],[9,7],[10,7],
      [4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],
      [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],
      [4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
      [5,11],[6,11],[7,11],[8,11],[9,11],[10,11],
    ].forEach(([x,y])=>P(x+bx,y+by,C.shirt2));

    // straps more visible in back
    [ [5,8],[5,9],[5,10] ].forEach(([x,y])=>P(x+bx,y+by,C.tealS));
    [ [10,8],[10,9],[10,10] ].forEach(([x,y])=>P(x+bx,y+by,C.tealS));
    P(3+bx,9+by,C.tealS);
    P(12+bx,9+by,C.tealS);

    // arms (back view: simpler)
    const Lhand = { x: 4+bx,  y: 13+by + lArmOff };
    const Rhand = { x: 11+bx, y: 13+by + rArmOff };

    if (!punching){
      P(4+bx, 11+by + lArmOff, C.shirt2);
      P(4+bx, 12+by + lArmOff, C.shirt1);

      P(11+bx, 11+by + rArmOff, C.shirt2);
      P(11+bx, 12+by + rArmOff, C.shirt1);

      // held item (show in right hand by default)
      if (held) this._drawHeldItem(P, C, held, "N", Rhand);
    } else {
      // a visible swing from behind: lead arm sweeps a bit
      const lead = rightLeads ? Rhand : Lhand;
      this._drawSwingArm(P, C, lead, swing, 4);

      if (held) this._drawHeldItem(P, C, held, "N", {
        x: lead.x + swing.tipOff.dx,
        y: lead.y + swing.tipOff.dy
      });
    }

    // pants
    [
      [5,12],[6,12],[7,12],[8,12],[9,12],[10,12],
      [5,13],[6,13],[7,13],[8,13],[9,13],[10,13],
    ].forEach(([x,y])=>P(x+bx,y+by,C.pants));
    [ [9,13],[10,13],[10,12] ].forEach(([x,y])=>P(x+bx,y+by,C.navy));

    // legs short + animated
    const Lx = 6+bx, Rx = 9+bx;
    const y14 = 14+by, y15 = 15+by, y16 = 16+by;

    const Lswing = (lfX !== 0 || lfY !== 0);
    const Rswing = (rfX !== 0 || rfY !== 0);

    if (!Lswing){ P(Lx,y14,C.skin); P(Lx,y15,C.skin); }
    else { P(Lx,y15,C.skin); P(Lx+1,y15,C.skin); }

    if (!Rswing){ P(Rx,y14,C.skin); P(Rx,y15,C.skin); }
    else { P(Rx,y15,C.skin); P(Rx-1,y15,C.skin); }

    P(Lx,y16,C.white);
    P(Rx,y16,C.white);

    const shoeY = 17+by;

    const lfx = Lx + lfX, lfy = shoeY + lfY;
    P(lfx,   lfy,   C.navy);
    P(lfx,   lfy+1, C.navy);
    P(lfx+1, lfy+1, C.navy);
    P(lfx,   lfy+2, C.white);

    const rfx = Rx + rfX, rfy = shoeY + rfY;
    P(rfx,   rfy,   C.navy);
    P(rfx,   rfy+1, C.navy);
    P(rfx-1, rfy+1, C.navy);
    P(rfx,   rfy+2, C.white);
  }

  // ==========================================================
  // SIDE (E/W) — slightly wider
  // ==========================================================
  _drawSide(P, C, s){
    const {
      dir, hipX, hipY,
      lfX, lfY, rfX, rfY,
      lArmOff, rArmOff,
      punching, swing,
      held
    } = s;

    const bx = hipX, by = hipY;
    const flip = (x) => dir === "E" ? x : (15 - x);

    // hair profile + back mass
    [
      [6,0],[7,0],[8,0],
      [5,1],[6,1],[7,1],[8,1],[9,1],
      [5,2],[6,2],[7,2],[8,2],[9,2],
      [5,3],[6,3],[7,3],[8,3],[9,3],
      [5,4],[9,4],
      [4,3],[4,4],
      [10,2],[10,3]
    ].forEach(([x,y])=>P(flip(x),y,C.hair));

    // face profile (slightly wider)
    [
      [7,3],[8,3],[9,3],
      [7,4],[8,4],[9,4],
      [7,5],[8,5],[9,5],
      [7,6],[8,6],
    ].forEach(([x,y])=>P(flip(x),y,C.skin));
    P(flip(9),5,C.navy);

    // hoodie body (wider)
    [
      [6,7],[7,7],[8,7],[9,7],
      [5,8],[6,8],[7,8],[8,8],[9,8],
      [5,9],[6,9],[7,9],[8,9],[9,9],
      [5,10],[6,10],[7,10],[8,10],[9,10],
      [6,11],[7,11],[8,11],[9,11],
    ].forEach(([x,y])=>P(flip(x+bx),y+by,C.shirt2));

    // strap hint
    P(flip(5+bx),9+by,C.tealS);
    P(flip(6+bx),9+by,C.teal);

    // arms (profile)
    const hand = { x: flip(4+bx), y: 13+by + ((dir==="E")?lArmOff:rArmOff) };

    if (!punching){
      const aOff = (dir === "E") ? lArmOff : rArmOff;
      P(flip(4+bx), 11+by + aOff, C.shirt2);
      P(flip(4+bx), 12+by + aOff, C.shirt1);
      P(hand.x, hand.y, C.skin);

      if (held) this._drawHeldItem(P, C, held, dir, hand);
    } else {
      // swing punch in profile: arm arcs forward
      // start point is shoulder-ish (profile)
      const shoulder = { x: flip(5+bx), y: 12+by };
      const tip = { x: shoulder.x + (dir==="E" ? swing.tipOff.dx : -swing.tipOff.dx), y: shoulder.y + swing.tipOff.dy };
      const mid = { x: shoulder.x + (dir==="E" ? swing.midOff.dx : -swing.midOff.dx), y: shoulder.y + swing.midOff.dy };

      // segments
      this._plotLine(P, C, shoulder, mid, C.shirt2);
      this._plotLine(P, C, mid, tip, C.shirt2);
      P(tip.x, tip.y, C.skin);

      if (held) this._drawHeldItem(P, C, held, dir, tip);
    }

    // pants (wider)
    [
      [6,12],[7,12],[8,12],[9,12],
      [6,13],[7,13],[8,13],[9,13]
    ].forEach(([x,y])=>P(flip(x+bx),y+by,C.pants));
    P(flip(9+bx),13+by,C.navy);

    // legs (short)
    const legX = flip(8+bx);
    const y14 = 14+by, y15 = 15+by, y16 = 16+by;

    const swingLeg = (lfY || rfY || lfX || rfX);
    if (!swingLeg){
      P(legX,y14,C.skin);
      P(legX,y15,C.skin);
    } else {
      P(legX,y15,C.skin);
      P(legX + (dir==="E"?-1:1), y15, C.skin);
    }
    P(legX,y16,C.white);

    // shoe (profile)
    const shoeY = 17+by;
    const offY = (lfY || rfY);
    const offX = (lfX || rfX);

    const sx = legX + (dir==="E"?offX:-offX);
    const sy = shoeY + offY;

    P(sx, sy, C.navy);
    P(sx, sy+1, C.navy);
    P(sx + (dir==="E"?1:-1), sy+1, C.navy);
    P(sx, sy+2, C.white);
  }

  // ==========================================================
  // SWING HELPERS
  // ==========================================================
  _dirVec(face){
    if (face === "E") return { dx: 1, dy: 0 };
    if (face === "W") return { dx: -1, dy: 0 };
    if (face === "N") return { dx: 0, dy: -1 };
    return { dx: 0, dy: 1 }; // S
  }

  _swingOffsets(p, dir, perp){
    // clamp
    p = Math.max(0, Math.min(1, p));

    // phases
    const windEnd = 0.25;
    const hitEnd  = 0.65;

    // base reach
    const reach = 4; // full arm feel
    const arc   = 2; // sideways arc amount

    let tip = { dx: 0, dy: 0 };
    let mid = { dx: 0, dy: 0 };

    if (p < windEnd){
      // windup: pull back a bit, slight opposite-perp
      const t = p / windEnd;
      const back = Math.round((1 - t) * 2);
      const side = Math.round((1 - t) * 1);
      tip = { dx: -dir.dx * back - perp.dx * side, dy: -dir.dy * back - perp.dy * side };
      mid = { dx: Math.round(tip.dx * 0.6), dy: Math.round(tip.dy * 0.6) };
    } else if (p < hitEnd){
      // strike: sweep forward with arc
      const t = (p - windEnd) / (hitEnd - windEnd); // 0..1
      const f = Math.round(t * reach);
      const s = Math.round(Math.sin(t * Math.PI) * arc); // arc bulge mid-swing
      tip = { dx: dir.dx * f + perp.dx * s, dy: dir.dy * f + perp.dy * s };
      mid = { dx: Math.round(dir.dx * (f * 0.55) + perp.dx * (s * 0.6)),
              dy: Math.round(dir.dy * (f * 0.55) + perp.dy * (s * 0.6)) };
    } else {
      // recoil: ease back toward near-forward (not all the way)
      const t = (p - hitEnd) / (1 - hitEnd);
      const f = Math.round(reach * (1 - 0.35*t));
      const s = Math.round((1 - t) * 1);
      tip = { dx: dir.dx * f + perp.dx * s, dy: dir.dy * f + perp.dy * s };
      mid = { dx: Math.round(dir.dx * (f * 0.55) + perp.dx * (s * 0.6)),
              dy: Math.round(dir.dy * (f * 0.55) + perp.dy * (s * 0.6)) };
    }

    return { tipOff: tip, midOff: mid };
  }

  _drawSwingArm(P, C, handBase, swing, segments){
    // Shoulder is 2px “above” the handBase for front/back readability
    const shoulder = { x: handBase.x, y: handBase.y - 2 };
    const mid = { x: handBase.x + swing.midOff.dx, y: handBase.y + swing.midOff.dy };
    const tip = { x: handBase.x + swing.tipOff.dx, y: handBase.y + swing.tipOff.dy };

    // Draw sleeve from shoulder->mid->tip (hand)
    this._plotLine(P, C, shoulder, mid, C.shirt2);
    this._plotLine(P, C, mid, tip, C.shirt2);

    // Shade on a couple pixels to give “thickness”
    P(mid.x, mid.y, C.shirt1);

    // Hand
    P(tip.x, tip.y, C.skin);
  }

  _drawArmSegments(P, C, handBase, dir, len, drawHand=true){
    // Draw a simple tucked arm (no swing)
    for (let i = 0; i < len; i++){
      const x = handBase.x;
      const y = handBase.y - i;
      P(x, y, (i === len-1 && drawHand) ? C.skin : C.shirt2);
      if (i === 1) P(x, y, C.shirt1);
    }
  }

  _plotLine(P, C, a, b, col){
    // tiny Bresenham-ish for pixel arms/tools
    let x0 = a.x|0, y0 = a.y|0;
    let x1 = b.x|0, y1 = b.y|0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true){
      P(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy){ err += dy; x0 += sx; }
      if (e2 <= dx){ err += dx; y0 += sy; }
    }
  }

  // ==========================================================
  // HELD ITEM (inventory hook)
  // ==========================================================
  _drawHeldItem(P, C, held, faceOrDir, hand){
    // held can be string ("knife","bat","wrench","gun","flashlight")
    // or object: { type:"knife", tint:"#..." }
    const type = (typeof held === "string") ? held : (held?.type || "tool");
    const tint = (typeof held === "object" && held?.tint) ? held.tint : null;

    // point the item outward based on facing
    const face = faceOrDir;
    let dx = 0, dy = 0;
    if (face === "E"){ dx = 1; dy = 0; }
    else if (face === "W"){ dx = -1; dy = 0; }
    else if (face === "N"){ dx = 0; dy = -1; }
    else { dx = 0; dy = 1; } // S and "S-like"

    // tiny offset so it sits in the hand, not on top of it
    const origin = { x: hand.x + dx, y: hand.y + dy };

    // icons are deliberately tiny so they don't destroy the sprite
    if (type === "knife"){
      // handle + blade
      P(origin.x, origin.y, C.wood);
      P(origin.x + dx, origin.y + dy, tint || C.steel);
      P(origin.x + dx*2, origin.y + dy*2, tint || C.steel);
      P(origin.x + dx*2 + (dy!==0?1:0), origin.y + dy*2 + (dx!==0?1:0), C.white);
    } else if (type === "bat"){
      // long stick
      P(origin.x, origin.y, C.wood);
      P(origin.x + dx, origin.y + dy, C.wood);
      P(origin.x + dx*2, origin.y + dy*2, C.wood);
      P(origin.x + dx*3, origin.y + dy*3, C.wood);
    } else if (type === "wrench" || type === "tool"){
      P(origin.x, origin.y, C.steelS);
      P(origin.x + dx, origin.y + dy, tint || C.steel);
      P(origin.x + dx*2, origin.y + dy*2, tint || C.steel);
      P(origin.x + dx*2 + (dy!==0?1:0), origin.y + dy*2 + (dx!==0?1:0), C.steelS);
    } else if (type === "gun"){
      // tiny L-shape
      P(origin.x, origin.y, C.navy);
      P(origin.x + dx, origin.y + dy, C.navy);
      P(origin.x + (dy!==0?1:0), origin.y + (dx!==0?1:0), C.navy);
      P(origin.x + dx*2, origin.y + dy*2, C.steelS);
    } else if (type === "flashlight"){
      P(origin.x, origin.y, C.steelS);
      P(origin.x + dx, origin.y + dy, C.steelS);
      P(origin.x + dx*2, origin.y + dy*2, C.glow);
    } else {
      // fallback: simple dot
      P(origin.x, origin.y, tint || C.steel);
    }
  }

  // ==========================================================
  // MISC
  // ==========================================================
  _faceDir(fx, fy){
    if (Math.abs(fx) > Math.abs(fy)) return fx >= 0 ? "E" : "W";
    return fy >= 0 ? "S" : "N";
  }

  _drawPunchSpark(ctx, p, face){
    const cx = p.x + p.w/2;
    const cy = p.y + p.h/2 - (p.z || 0);

    let ox = 0, oy = 0;
    if (face === "E") ox = 18;
    if (face === "W") ox = -18;
    if (face === "N") oy = -18;
    if (face === "S") oy = 18;

    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 8, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}
