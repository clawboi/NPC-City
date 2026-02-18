// src/entities/player.js
// NPC City Player v3: keep the improved head, but make the whole character smaller + shorter,
// and upgrade torso/legs to feel more "person" and less blocky.
// Changes:
// - px back to 2 (not huge)
// - sprite grid is 16x17 (actually shorter)
// - better legs + coat taper
// - smoother step roll (less stiff)

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

    // ---- size: smaller + actually shorter ----
    const px = 2;

    const SW = 16;
    const SH = 17; // SHORTER than before (was 20)
    const W = SW * px;
    const H = SH * px;

    const cx = p.x + p.w/2;
    const feetY = p.y + p.h + 2;

    // tiny bob, subtle
    const idle = (!moving && !acting) ? Math.sin(now * 0.0017) : 0;
    const bob  = (!acting)
      ? (moving ? Math.sin(this._step * 2.0) * 0.5 : idle * 0.6)
      : 0;

    const sx = Math.round(cx - W/2);
    const sy = Math.round(feetY - H - (p.z || 0) + bob);

    // palette
    const outline = "rgba(12,12,20,.70)";
    const skin    = "#f3ccb6";
    const hair    = "#f6e08a";
    const hairS   = "#cbb25b";
    const coat    = "#1b1b24";
    const coatS   = "#2a2a36";
    const scarf   = "rgba(138,46,255,.85)";
    const boot    = "#101017";
    const sock    = "#c9c0ae";
    const eyeLine = "#101018";
    const blue    = "#4aa8ff";
    const blueS   = "#2b6ea8";
    const white   = "rgba(255,255,255,.90)";
    const blush   = "rgba(255,120,160,.16)";

    const P = (ix, iy, c) => {
      ctx.fillStyle = c;
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

    // --- motion: step roll ---
    const a = Math.sin(this._step);
    const b = Math.sin(this._step + Math.PI);

    const side = (face === "E" || face === "W");
    const dirSign = (face === "E" || face === "S") ? 1 : -1;

    const stride = moving ? (running ? 2 : 1) : 0;
    const lift   = moving ? 1 : 0;

    const fA = a * stride * dirSign;
    const fB = b * stride * dirSign;

    // softer lift (knees, not pogo)
    const upA = Math.max(0, Math.sin(this._step)) * lift;
    const upB = Math.max(0, Math.sin(this._step + Math.PI)) * lift;

    const footAx = side ? Math.round(fA) : 0;
    const footAy = side ? -Math.round(upA) : Math.round(fA);
    const footBx = side ? Math.round(fB) : 0;
    const footBy = side ? -Math.round(upB) : Math.round(fB);

    // subtle hip sway + coat tail lag
    const hip = (moving && !acting) ? Math.round(Math.sin(this._step) * 1) : 0;
    const tail = (moving && !acting) ? Math.round(Math.sin(this._step - 0.7) * 1) : 0;

    // arms swing opposite
    const armSwing = moving ? 1 : 0;
    const armA = -a * armSwing * dirSign;
    const armB = -b * armSwing * dirSign;
    const armAx = side ? Math.round(armA) : 0;
    const armAy = side ? 0 : -Math.round(armA);
    const armBx = side ? Math.round(armB) : 0;
    const armBy = side ? 0 : -Math.round(armB);

    const punching = p.punchT > 0;

    // ==========================================================
    // DRAW: Head (same style you liked)
    // ==========================================================
    // head outline pixels
    [
      [6,0],[7,0],[8,0],[9,0],
      [5,1],[10,1],
      [4,2],[11,2],
      [4,3],[11,3],
      [4,4],[11,4],
      [5,5],[10,5],
      [6,6],[7,6],[8,6],[9,6]
    ].forEach(([ix,iy])=>P(ix,iy,outline));

    // hair silhouette + tufts (breaks box)
    [
      [5,1],[6,1],[7,1],[8,1],[9,1],[10,1],
      [5,2],[10,2],
      [5,3],[10,3],
      [4,4],[12,4],
      [4,5],[12,5]
    ].forEach(([ix,iy])=>P(ix,iy,hairS));
    [
      [6,1],[7,1],[8,1],[9,1],
      [6,2],[7,2],[8,2],[9,2],
      [6,3],[7,3],[8,3],[9,3]
    ].forEach(([ix,iy])=>P(ix,iy,hair));

    // face skin (rounded)
    [
      [5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
      [5,3],[6,3],[7,3],[8,3],[9,3],[10,3],
      [5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
      [6,5],[7,5],[8,5],[9,5]
    ].forEach(([ix,iy])=>P(ix,iy,skin));

    // blush
    P(6,5,blush); P(9,5,blush);

    // eyes
    if (blinking){
      P(6,4,eyeLine); P(9,4,eyeLine);
    } else {
      P(6,4,blueS); P(9,4,blueS);
      P(6,5,blue);  P(9,5,blue);
      P(7,4,white); P(10,4,white);
      P(7,5,eyeLine); P(10,5,eyeLine);
    }

    // scarf (smaller)
    [ [6,7],[7,7],[8,7],[9,7], [7,8],[8,8] ].forEach(([ix,iy])=>P(ix,iy,scarf));

    // ==========================================================
    // DRAW: Body + legs (better + shorter)
    // Grid rows left:
    // y=9..16 for torso/legs/feet
    // ==========================================================

    const bodyX = hip;

    // shoulders (thin taper)
    P(6+bodyX, 9, coat);
    P(7+bodyX, 9, coat);
    P(8+bodyX, 9, coat);
    P(9+bodyX, 9, coatS);

    // torso (tapered coat)
    // top torso
    for (let ix=6; ix<=9; ix++) P(ix+bodyX, 10, coat);
    P(9+bodyX,10,coatS);

    // mid torso (slightly narrower)
    for (let ix=6; ix<=8; ix++) P(ix+bodyX, 11, coat);
    P(9+bodyX,11,coatS);

    // lower torso
    for (let ix=6; ix<=8; ix++) P(ix+bodyX, 12, coat);
    P(9+bodyX,12,coatS);

    // coat tail (short, lag)
    P(7+bodyX+tail, 13, coat);
    P(8+bodyX+tail, 13, coatS);

    // arms (shorter, cleaner)
    if (!punching){
      // left
      P(5+bodyX+armAx, 10+armAy, coat);
      P(5+bodyX+armAx, 11+armAy, coatS);

      // right
      P(10+bodyX+armBx, 10+armBy, coat);
      P(10+bodyX+armBx, 11+armBy, coatS);
    } else {
      let pxDirX = 0, pxDirY = 0;
      if (face === "E") pxDirX = 2;
      if (face === "W") pxDirX = -2;
      if (face === "N") pxDirY = -1;
      if (face === "S") pxDirY = 1;

      P(6+bodyX+pxDirX, 11+pxDirY, coat);
      P(7+bodyX+pxDirX, 11+pxDirY, coatS);
      P(9+bodyX+pxDirX, 11+pxDirY, coat);
      this._drawPunchSpark(ctx, p, face);
    }

    // legs: add knee pixel so it reads as walking, not blocks
    const legBaseY = 14;

    // left leg (A)
    P(7+bodyX, legBaseY, coatS); // hip/short
    P(7+bodyX+footAx, legBaseY+1, sock);
    P(7+bodyX+footAx, legBaseY+2+footAy, boot);

    // right leg (B)
    P(8+bodyX, legBaseY, coatS);
    P(8+bodyX+footBx, legBaseY+1, sock);
    P(8+bodyX+footBx, legBaseY+2+footBy, boot);

    // second boot pixels (weight)
    P(7+bodyX+footAx, legBaseY+3+footAy, boot);
    P(8+bodyX+footBx, legBaseY+3+footBy, boot);
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
