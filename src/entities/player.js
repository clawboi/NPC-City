// src/entities/player.js
// Cute (but slightly dark) Ghibli-ish pixel girl. Subtle motion: blink, tiny feet + arms.
// Punch pose works for N/S/E/W.

export class Player {
  constructor(){
    // internal animation state (not saved)
    this._lastX = 0;
    this._lastY = 0;
    this._lastT = 0;

    this._blinkNext = 1.6;
    this._blinkHold = 0;

    this._stepPhase = 0;
  }

  reset(p){
    this._lastX = p.x;
    this._lastY = p.y;
    this._lastT = performance.now();
    this._blinkNext = 1.2 + Math.random()*2.4;
    this._blinkHold = 0;
    this._stepPhase = 0;
  }

  draw(ctx, p){
    const now = performance.now();
    if (!this._lastT) this.reset(p);

    // estimate speed (no touching gameplay code)
    let dt = (now - this._lastT) / 1000;
    if (!isFinite(dt) || dt <= 0) dt = 1/60;
    if (dt < 1/120) dt = 1/120;
    if (dt > 1/20)  dt = 1/20;

    const vx = (p.x - this._lastX) / dt;
    const vy = (p.y - this._lastY) / dt;
    const speed = Math.hypot(vx, vy);

    this._lastX = p.x;
    this._lastY = p.y;
    this._lastT = now;

    const moving  = speed > 8;
    const running = speed > 165;

    // step phase (subtle)
    this._stepPhase += dt * (moving ? (running ? 10.0 : 7.0) : 1.2);

    // blink
    if (this._blinkHold > 0){
      this._blinkHold = Math.max(0, this._blinkHold - dt);
    } else {
      this._blinkNext -= dt;
      if (this._blinkNext <= 0){
        this._blinkHold = 0.10;
        this._blinkNext = 1.4 + Math.random()*2.6;
      }
    }
    const blinking = this._blinkHold > 0;

    // idle breathe (tiny)
    const acting = (p.jumpT > 0) || (p.dodgeT > 0) || (p.punchT > 0);
    const breathe = (!moving && !acting) ? Math.round(Math.sin(now * 0.0016) * 1) : 0;

    // micro motion: feet + hands only (no “spider legs”)
    const wave = Math.sin(this._stepPhase);
    const footA = moving ? Math.round(wave * 1) : 0;
    const footB = moving ? Math.round(-wave * 1) : 0;
    const handA = moving ? Math.round(-wave * 1) : 0;
    const handB = moving ? Math.round(wave * 1) : 0;

    // resolve facing dir to N/S/E/W for punch pose
    const face = this._faceDir(p.faceX || 0, p.faceY || 1);

    // Size: basically the same, just slightly “present”
    // (True 0.5% isn’t meaningful in pixel blocks, so we keep it stable and cute.)
    const px = 2;
    const W = 18 * px;
    const H = 22 * px;

    // anchor: centered on collider, feet at bottom
    const cx = p.x + p.w/2;
    const feetY = p.y + p.h + 2;
    const sx = Math.round(cx - W/2);
    const sy = Math.round(feetY - H - (p.z || 0));
    const y  = sy + breathe;

    // palette: cute but night-leaning
    const outline = "rgba(12,12,20,.55)";
    const skin    = "#f3ccb6";
    const blush   = "rgba(255,120,160,.18)";
    const hair    = "#f6e08a";   // blonde
    const hairS   = "#cbb25b";
    const coat    = "#1b1b24";   // dark
    const coatS   = "#2a2a36";
    const scarf   = "rgba(138,46,255,.85)";
    const boot    = "#101017";
    const sock    = "#c9c0ae";
    const eyeLine = "#101018";
    const blue    = "#4aa8ff";
    const blueS   = "#2b6ea8";
    const white   = "rgba(255,255,255,.88)";

    const fill = (x1,y1,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x1,y1,w,h); };
    const stroke = (x1,y1,w,h)=>{ ctx.strokeStyle=outline; ctx.lineWidth=2; ctx.strokeRect(x1,y1,w,h); };

    // ground shadow (extra anchor)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, feetY + 2, 12, 6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // ===== HEAD =====
    fill(sx+5*px, y+1*px, 8*px, 7*px, skin);
    fill(sx+6*px, y+0*px, 6*px, 1*px, skin);

    // hair cap + side strands
    fill(sx+5*px, y+1*px, 8*px, 3*px, hairS);
    fill(sx+5*px, y+1*px, 8*px, 2*px, hair);
    fill(sx+4*px, y+3*px, 2*px, 4*px, hairS);
    fill(sx+12*px, y+3*px, 2*px, 4*px, hairS);

    // eyes (bigger + blue, not creepy)
    if (blinking){
      fill(sx+7*px, y+5*px, 2*px, 1*px, eyeLine);
      fill(sx+10*px, y+5*px, 2*px, 1*px, eyeLine);
    } else {
      fill(sx+7*px,  y+4*px, 2*px, 3*px, blueS);
      fill(sx+10*px, y+4*px, 2*px, 3*px, blueS);

      fill(sx+7*px,  y+4*px, 1*px, 1*px, blue);
      fill(sx+10*px, y+4*px, 1*px, 1*px, blue);

      fill(sx+8*px,  y+6*px, 1*px, 1*px, eyeLine);
      fill(sx+11*px, y+6*px, 1*px, 1*px, eyeLine);

      fill(sx+8*px,  y+4*px, 1*px, 1*px, white);
      fill(sx+11*px, y+4*px, 1*px, 1*px, white);
    }

    // blush
    ctx.save();
    ctx.globalAlpha = 0.85;
    fill(sx+6*px, y+6*px, 1*px, 1*px, blush);
    fill(sx+12*px, y+6*px, 1*px, 1*px, blush);
    ctx.restore();

    stroke(sx+5*px, y+1*px, 8*px, 7*px);

    // ===== scarf (violet accent) =====
    fill(sx+6*px, y+8*px, 6*px, 2*px, scarf);
    stroke(sx+6*px, y+8*px, 6*px, 2*px);

    // ===== body (dark coat) =====
    fill(sx+6*px, y+10*px, 6*px, 7*px, coat);
    ctx.save();
    ctx.globalAlpha = 0.55;
    fill(sx+9*px, y+10*px, 3*px, 7*px, coatS);
    ctx.restore();
    stroke(sx+6*px, y+10*px, 6*px, 7*px);

    // ===== arms =====
    const punching = p.punchT > 0;
    if (!punching){
      fill(sx+4*px,  y+(11+handA)*px, 2*px, 5*px, coat);
      fill(sx+12*px, y+(11+handB)*px, 2*px, 5*px, coat);
      stroke(sx+4*px,  y+(11+handA)*px, 2*px, 5*px);
      stroke(sx+12*px, y+(11+handB)*px, 2*px, 5*px);
    } else {
      this._drawPunchArms(ctx, sx, y, px, coat, outline, face);
      this._drawPunchSpark(ctx, p, face);
    }

    // ===== feet (tiny step only) =====
    fill(sx+7*px,  y+(17+footA)*px, 2*px, 2*px, sock);
    fill(sx+10*px, y+(17+footB)*px, 2*px, 2*px, sock);

    fill(sx+7*px,  y+(19+footA)*px, 2*px, 3*px, boot);
    fill(sx+10*px, y+(19+footB)*px, 2*px, 3*px, boot);
    stroke(sx+7*px,  y+(19+footA)*px, 2*px, 3*px);
    stroke(sx+10*px, y+(19+footB)*px, 2*px, 3*px);
  }

  _faceDir(fx, fy){
    if (Math.abs(fx) > Math.abs(fy)) return fx >= 0 ? "E" : "W";
    return fy >= 0 ? "S" : "N";
  }

  _drawPunchArms(ctx, sx, y, px, coat, outline, face){
    const fill = (x1,y1,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x1,y1,w,h); };
    const stroke = (x1,y1,w,h)=>{ ctx.strokeStyle=outline; ctx.lineWidth=2; ctx.strokeRect(x1,y1,w,h); };

    // base arm positions
    let lx = sx + 4*px,  ly = y + 11*px;
    let rx = sx + 12*px, ry = y + 11*px;

    // extend one arm based on face direction
    if (face === "E") rx += 2*px;
    if (face === "W") lx -= 2*px;
    if (face === "N") { ly -= 2*px; ry -= 2*px; }
    if (face === "S") { ly += 1*px; ry += 1*px; }

    fill(lx, ly, 2*px, 5*px, coat);
    fill(rx, ry, 2*px, 5*px, coat);
    stroke(lx, ly, 2*px, 5*px);
    stroke(rx, ry, 2*px, 5*px);
  }

  _drawPunchSpark(ctx, p, face){
    // tiny sparkle ring in the punch direction (still subtle)
    const cx = p.x + p.w/2;
    const cy = p.y + p.h/2 - (p.z || 0);

    let ox = 0, oy = 0;
    if (face === "E") ox = 16;
    if (face === "W") ox = -16;
    if (face === "N") oy = -16;
    if (face === "S") oy = 16;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 8, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}
