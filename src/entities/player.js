// src/entities/player.js
// NPC City Player — "Reference Sprite" remake (no images, pure pixel placements)
// Matches the provided sprite: sizing, palette, shape, straps, hoodie, pants, shoes.
// 16x20 grid, px=2. Simple pleasing walk: alternating leg lift + tiny arm swing.

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

    // facing (kept for punch spark direction)
    const fx = p.faceX || 0, fy = p.faceY || 0;
    if (Math.abs(fx) + Math.abs(fy) > 0.25) this._facing = this._faceDir(fx, fy);
    const face = this._facing;

    const acting = (p.jumpT > 0) || (p.dodgeT > 0) || (p.punchT > 0);

    // step
    const stepRate = moving ? (running ? 10.0 : 7.3) : 1.0;
    this._step += dt * stepRate;

    // blink
    if (this._blinkHold > 0){
      this._blinkHold = Math.max(0, this._blinkHold - dt);
    } else {
      this._blinkNext -= dt;
      if (this._blinkNext <= 0){
        this._blinkHold = 0.10;
        this._blinkNext = 1.3 + Math.random()*2.6;
      }
    }
    const blinking = this._blinkHold > 0;

    // ===== SIZE (matches reference feel) =====
    const px = 2;
    const SW = 16;
    const SH = 20;
    const W = SW * px;
    const H = SH * px;

    // anchor at feet
    const cx = p.x + p.w/2;
    const feetY = p.y + p.h + 2;

    // tiny bob (very subtle)
    const bob = (!acting && moving) ? Math.sin(this._step * 2.0) * 0.35 : 0;

    const sx = Math.round(cx - W/2);
    const sy = Math.round(feetY - H - (p.z || 0) + bob);

    // ===== exact palette sampled from your reference =====
    const C = {
      teal:   "#309988", // (48,153,136)
      tealS:  "#3B6364", // (59,99,100)
      navy:   "#31325A", // (49,50,90)
      hair:   "#402632", // (64,38,50~51)
      pants:  "#4D5499", // (77,84,153)
      shirt1: "#703E50", // (112,62,80)
      shirt2: "#7E3541", // (126,53,65)
      shirt3: "#7F3441", // (127,52~53,65)
      skin:   "#F9BEA6", // (249,190,166)
      blush:  "#EE8C7B", // (238,140,123)
      white:  "#FFFFFF"
    };

    const P = (ix, iy, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(sx + ix*px, sy + iy*px, px, px);
    };

    // shadow (soft)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, feetY + 2, 12, 6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // ===== walk offsets (pleasant, minimal) =====
    // Alternate leg lift by 1px and micro arm swing.
    const a = Math.sin(this._step);
    const b = Math.sin(this._step + Math.PI);

    const liftA = moving ? Math.round(Math.max(0, a) * 1) : 0;
    const liftB = moving ? Math.round(Math.max(0, b) * 1) : 0;

    const armA = moving ? Math.round((-a) * 1) : 0;
    const armB = moving ? Math.round((-b) * 1) : 0;

    const punching = p.punchT > 0;

    // ==========================================================
    // DRAW ORDER: hair -> face -> hoodie/straps -> arms -> pants -> legs/shoes
    // ==========================================================

    // ---- HAIR (bun/top + sides) ----
    // top bun block
    [
      [6,0],[7,0],[8,0],[9,0],
      [5,1],[6,1],[7,1],[8,1],[9,1],[10,1],
      [5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
      [5,3],[6,3],[7,3],[8,3],[9,3],[10,3],
      [5,4],[10,4],
    ].forEach(([x,y])=>P(x,y,C.hair));
    // side hair lumps
    [ [4,3],[4,4],[11,3],[11,4] ].forEach(([x,y])=>P(x,y,C.hair));

    // ---- FACE ----
    [
      [6,3],[7,3],[8,3],[9,3],
      [5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
      [5,5],[6,5],[7,5],[8,5],[9,5],[10,5],
      [6,6],[7,6],[8,6],[9,6],
    ].forEach(([x,y])=>P(x,y,C.skin));

    // blush dots
    P(6,6,C.blush); P(9,6,C.blush);

    // eyes (tiny, like ref)
    if (blinking){
      P(7,5,C.hair); P(8,5,C.hair);
    } else {
      P(7,5,C.navy); P(8,5,C.navy);
    }

    // ---- HOODIE / SHIRT (maroon) ----
    // shoulders/hoodie top
    [
      [5,7],[6,7],[7,7],[8,7],[9,7],[10,7],
      [4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],
      [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],
      [4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
      [5,11],[6,11],[7,11],[8,11],[9,11],[10,11],
    ].forEach(([x,y])=>P(x,y,C.shirt2));

    // hoodie shading (subtle)
    [ [10,8],[10,9],[10,10],[9,10],[9,9] ].forEach(([x,y])=>P(x,y,C.shirt1));
    [ [6,10],[7,10],[8,10] ].forEach(([x,y])=>P(x,y,C.shirt3));

    // ---- STRAPS (teal) ----
    // left strap
    [ [5,8],[5,9],[5,10] ].forEach(([x,y])=>P(x,y,C.teal));
    // right strap
    [ [10,8],[10,9],[10,10] ].forEach(([x,y])=>P(x,y,C.teal));
    // strap shadow bits (like ref tealS)
    [ [6,9],[9,9] ].forEach(([x,y])=>P(x,y,C.tealS));

    // small backpack side nubs
    P(3,9,C.tealS);
    P(12,9,C.tealS);

    // ---- ARMS (hoodie sleeves) + HANDS ----
    if (!punching){
      // left sleeve
      P(4,11 + armA, C.shirt2);
      P(4,12 + armA, C.shirt1);
      // left hand
      P(4,13 + armA, C.skin);

      // right sleeve
      P(11,11 + armB, C.shirt2);
      P(11,12 + armB, C.shirt1);
      // right hand
      P(11,13 + armB, C.skin);
    } else {
      // punch pose: extend toward facing
      let pxDirX = 0, pxDirY = 0;
      if (face === "E") pxDirX = 2;
      if (face === "W") pxDirX = -2;
      if (face === "N") pxDirY = -2;
      if (face === "S") pxDirY = 2;

      P(4 + pxDirX, 12 + pxDirY, C.shirt2);
      P(5 + pxDirX, 12 + pxDirY, C.shirt1);
      P(6 + pxDirX, 12 + pxDirY, C.skin);

      P(11 + pxDirX, 12 + pxDirY, C.shirt2);
      P(10 + pxDirX, 12 + pxDirY, C.shirt1);
      P(9 + pxDirX, 12 + pxDirY, C.skin);

      this._drawPunchSpark(ctx, p, face);
    }

    // ---- PANTS / SHORTS (blue) ----
    [
      [5,12],[6,12],[7,12],[8,12],[9,12],[10,12],
      [5,13],[6,13],[7,13],[8,13],[9,13],[10,13],
    ].forEach(([x,y])=>P(x,y,C.pants));

    // pants shading (tiny)
    [ [9,13],[10,13],[10,12] ].forEach(([x,y])=>P(x,y,C.navy));

    // ---- LEGS (skin) + SOCKS (white) + SHOES (navy) ----
    // Legs are skinny like ref, with alternating lift.
    // Left leg
    P(6,14 + (0 - liftA), C.skin);
    P(6,15 + (0 - liftA), C.skin);
    P(6,16 + (0 - liftA), C.white); // sock
    P(6,17 + (0 - liftA), C.navy);  // shoe
    P(6,18 + (0 - liftA), C.navy);

    // Right leg
    P(9,14 + (0 - liftB), C.skin);
    P(9,15 + (0 - liftB), C.skin);
    P(9,16 + (0 - liftB), C.white);
    P(9,17 + (0 - liftB), C.navy);
    P(9,18 + (0 - liftB), C.navy);

    // a couple extra shoe pixels to match chunk
    P(7,18 + (0 - liftA), C.navy);
    P(8,18 + (0 - liftB), C.navy);

    // tiny white toe highlight like ref
    P(6,19 + (0 - liftA), C.white);
    P(9,19 + (0 - liftB), C.white);
  }

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
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 8, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}
