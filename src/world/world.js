export class World {
  constructor(){
    // Cozy suburb starter neighborhood (rugged edition)
    this.w = 2200;
    this.h = 1400;

    this.spawns = {
      actor: { x: 520, y: 820, area:"Sunleaf Suburbs" },
      thug:  { x: 520, y: 820, area:"Sunleaf Suburbs" },
      police:{ x: 520, y: 820, area:"Sunleaf Suburbs" },
    };

    // --- SOLIDS (collision) ---
    this.solids = [
      // Houses / buildings blocks (suburbs)
      { x: 220, y: 260, w: 420, h: 240 },
      { x: 760, y: 220, w: 480, h: 260 },
      { x: 1400, y: 280, w: 520, h: 260 },
      { x: 1520, y: 760, w: 420, h: 240 },

      // Water (blocked)
      { x: 0, y: 1160, w: this.w, h: 240 },

      // Cliff/edge near top-right (raised strip)
      { x: 1700, y: 120, w: 420, h: 90 },
    ];

    // --- LANDMARKS (interact) ---
    this.landmarks = [
      { id:"cottage", x: 330, y: 350, text:"Cottage", hint:"Home (soon)" },
      { id:"market",  x: 910, y: 340, text:"Corner Market", hint:"Snacks (soon)" },
      { id:"studio",  x: 1560, y: 390, text:"Acting Studio", hint:"Audition (soon)" },
      { id:"bridge",  x: 1030, y: 1120, text:"Wood Bridge", hint:"Cross" },
    ];

    // --- PATHS ---
    this.paths = [
      { x1: 520,  y1: 820,  x2: 620,  y2: 560,  w: 80 },
      { x1: 620,  y1: 560,  x2: 980,  y2: 420,  w: 86 },
      { x1: 980,  y1: 420,  x2: 1520, y2: 430,  w: 92 },
      { x1: 1520, y1: 430,  x2: 1660, y2: 700,  w: 78 },
      { x1: 1660, y1: 700,  x2: 1120, y2: 920,  w: 86 },
      { x1: 1120, y1: 920,  x2: 520,  y2: 820,  w: 92 },
    ];

    // Water + bridge (bridge is passable visual)
    this.bridge = { x: 920, y: 1110, w: 240, h: 58 };

    // --- PROPS ---
    this.props = [];
    const add = (p) => this.props.push(p);

    // Trees (trunks + canopy)
    addTreeCluster(add, 120, 900, 5);
    addTreeCluster(add, 260, 640, 4);
    addTreeCluster(add, 460, 520, 3);
    addTreeCluster(add, 1760, 980, 5);
    addTreeCluster(add, 1920, 540, 4);

    // Rocks
    add({ type:"rock", x: 700, y: 930, s: 1.0, baseY: 930 });
    add({ type:"rock", x: 1340, y: 860, s: 1.2, baseY: 860 });
    add({ type:"rock", x: 380, y: 1040, s: 0.9, baseY: 1040 });

    // Bushes/flowers
    addBushLine(add, 620, 760, 6);
    addBushLine(add, 1180, 520, 8);
    addFlowerPatch(add, 980, 680);
    addFlowerPatch(add, 1560, 920);

    // Stairs/ramps (cosmetic)
    this.stairs = [
      { x: 1680, y: 210, w: 120, h: 36, baseY: 210 },
      { x: 720,  y: 600, w: 130, h: 36, baseY: 600 },
    ];

    // Cached “above” draw list (tree canopies etc.)
    this._above = [];
  }

  getSpawn(role){
    return this.spawns[role] || this.spawns.actor;
  }

  hitsSolid(rect){
    for (const s of this.solids){
      if (aabb(rect, s)) return true;
    }
    return false;
  }

  nearestLandmark(px, py, radius = 64){
    let best = null;
    let bestD2 = radius * radius;
    for (const lm of this.landmarks){
      const dx = lm.x - px;
      const dy = lm.y - py;
      const d2 = dx*dx + dy*dy;
      if (d2 <= bestD2){
        bestD2 = d2;
        best = lm;
      }
    }
    return best;
  }

  // --- DRAW ---
  draw(ctx, cam){
    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // 1) Grass base (rugged: darker + less candy)
    fillGrass(ctx, 0, 0, this.w, this.h);

    // 2) Dirt paths (more worn + less shiny)
    for (const p of this.paths){
      drawPath(ctx, p.x1, p.y1, p.x2, p.y2, p.w);
    }

    // 3) Water band + shoreline
    drawWater(ctx, 0, 1160, this.w, 240);

    // 4) Bridge
    drawBridge(ctx, this.bridge.x, this.bridge.y, this.bridge.w, this.bridge.h);

    // 5) Buildings blocks (more rugged, less “toy”)
    for (const b of this.solids){
      if (b.y >= 1160) continue;
      if (b.w === 420 && b.h === 90 && b.y === 120) continue;
      drawHouseBlock(ctx, b.x, b.y, b.w, b.h);
    }

    // 6) Cliff/raised strip
    drawCliff(ctx, 1700, 120, 420, 90);

    // 7) Stairs/ramps
    for (const s of this.stairs){
      drawStairs(ctx, s.x, s.y, s.w, s.h);
    }

    // 8) Landmark labels (darker ink)
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(18,10,6,.72)";
    for (const lm of this.landmarks){
      ctx.fillText(lm.text, lm.x, lm.y);
    }

    // 9) Props (below pass)
    this._above.length = 0;

    const propsSorted = [...this.props].sort((a,b)=>(a.baseY||a.y)-(b.baseY||b.y));
    for (const pr of propsSorted){
      if (pr.type === "tree"){
        drawTreeTrunk(ctx, pr.x, pr.y, pr.s);
        this._above.push({ type:"treeCanopy", x: pr.x, y: pr.y, s: pr.s, baseY: pr.baseY });
      } else if (pr.type === "rock"){
        drawRock(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "bush"){
        drawBush(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "flower"){
        drawFlower(ctx, pr.x, pr.y, pr.s);
      }
    }

    // Faint bounds (debug)
    ctx.strokeStyle = "rgba(0,0,0,.10)";
    ctx.strokeRect(0, 0, this.w, this.h);

    ctx.restore();
  }

  // Above-pass (tree canopies) so player can walk behind
  drawAbove(ctx, cam){
    if (!this._above.length) return;

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    const sorted = [...this._above].sort((a,b)=>(a.baseY||a.y)-(b.baseY||b.y));
    for (const a of sorted){
      if (a.type === "treeCanopy"){
        drawTreeCanopy(ctx, a.x, a.y, a.s);
      }
    }
    ctx.restore();
  }
}

/* ====================== Helpers ====================== */

function aabb(a,b){
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function fillGrass(ctx, x, y, w, h){
  // Rugged base: deeper olive, less “baby”
  ctx.fillStyle = "#6e8440";
  ctx.fillRect(x, y, w, h);

  // Soft patches, but locked randomness (no animated wobble)
  ctx.globalAlpha = 0.16;
  for (let i=0; i<220; i++){
    const px = x + r1()*w;
    const py = y + r2()*h;
    const rr = 24 + r3()*84;
    ctx.fillStyle = (i%3===0) ? "#768e45" : (i%3===1 ? "#61783a" : "#7f9750");
    ctx.beginPath();
    // rotation is fixed by r4() (stable per load)
    ctx.ellipse(px, py, rr*1.15, rr*0.75, r4()*0.45, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Very subtle speckle (less “sparkle”)
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = "#ffffff";
  for (let i=0; i<700; i++){
    ctx.fillRect(x + r5()*w, y + r6()*h, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawPath(ctx, x1,y1,x2,y2,width){
  const steps = 28;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // deeper shadow
  ctx.strokeStyle = "rgba(0,0,0,.22)";
  ctx.lineWidth = width + 12;
  ctx.beginPath();
  for (let i=0; i<=steps; i++){
    const t = i/steps;
    const x = lerp(x1,x2,t) + Math.sin(t*3.1)*14;
    const y = lerp(y1,y2,t) + Math.cos(t*2.4)*10;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();

  // main dirt (less bright)
  ctx.strokeStyle = "#b59a63";
  ctx.lineWidth = width;
  ctx.stroke();

  // edge wear
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "#6b5a3a";
  ctx.lineWidth = Math.max(6, width*0.30);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawWater(ctx, x,y,w,h){
  ctx.fillStyle = "#1f6e6b";
  ctx.fillRect(x,y,w,h);

  // shimmer lines (stable randomness)
  ctx.globalAlpha = 0.16;
  for (let i=0; i<60; i++){
    ctx.fillStyle = (i%2===0) ? "#257976" : "#1b6360";
    ctx.fillRect(x + r7()*w, y + r8()*h, 60 + r9()*150, 2);
  }
  ctx.globalAlpha = 1;

  // foam
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (let i=0; i<120; i++){
    const px = x + r10()*w;
    const py = y + 8 + r11()*18;
    ctx.beginPath();
    ctx.ellipse(px, py, 8 + r12()*16, 2 + r13()*4, r14()*0.6, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // bank shadow
  ctx.fillStyle = "rgba(40,28,16,.25)";
  ctx.fillRect(x, y-10, w, 10);
}

function drawBridge(ctx, x,y,w,h){
  ctx.fillStyle = "#6a4a2f";
  roundRect(ctx, x, y, w, h, 10, true);

  // planks
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  for (let i=0; i<12; i++){
    ctx.fillRect(x+10+i*(w/12), y+7, 2, h-14);
  }
  ctx.globalAlpha = 1;

  // rails
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(x+12, y+10, w-24, 4);
  ctx.fillRect(x+12, y+h-14, w-24, 4);
}

function drawHouseBlock(ctx, x,y,w,h){
  // warmer but rugged stucco
  ctx.fillStyle = "#cdb98f";
  roundRect(ctx, x, y, w, h, 14, true);

  // roof shadow
  ctx.fillStyle = "rgba(0,0,0,.14)";
  roundRect(ctx, x+8, y+8, w-16, 18, 10, true);

  // windows: darker + less glossy
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#1d1d25";
  for (let i=0; i<6; i++){
    const wx = x + 40 + (i%3)*(w/3) + (r15()*18);
    const wy = y + 60 + Math.floor(i/3)*80 + (r16()*10);
    roundRect(ctx, wx, wy, 44, 32, 6, true);
  }
  ctx.globalAlpha = 1;

  // subtle violet accent
  ctx.fillStyle = "rgba(138,46,255,.08)";
  ctx.fillRect(x, y, w, 10);
}

function drawCliff(ctx, x,y,w,h){
  ctx.fillStyle = "#a98f5e";
  roundRect(ctx, x, y, w, h, 14, true);
  ctx.fillStyle = "rgba(0,0,0,.16)";
  roundRect(ctx, x, y+10, w, 10, 10, true);

  // texture dots (stable)
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = "#ffffff";
  for (let i=0;i<14;i++){
    ctx.beginPath();
    ctx.ellipse(x+20+r17()*(w-40), y+30+r18()*(h-40), 6+r19()*10, 2+r20()*6, r21()*0.6, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStairs(ctx, x,y,w,h){
  ctx.fillStyle = "rgba(0,0,0,.14)";
  roundRect(ctx, x, y, w, h, 12, true);

  ctx.fillStyle = "#b59a63";
  const steps = 5;
  for (let i=0;i<steps;i++){
    const yy = y + i*(h/steps);
    ctx.globalAlpha = 0.86 - i*0.12;
    roundRect(ctx, x+8, yy+3, w-16, (h/steps)-6, 10, true);
  }
  ctx.globalAlpha = 1;
}

/* ---- Props placement ---- */

function addTreeCluster(add, x, y, count){
  for (let i=0;i<count;i++){
    add({
      type:"tree",
      x: x + i*42 + (r22()*18-9),
      y: y + (r23()*32-16),
      s: 0.9 + r24()*0.4,
      baseY: y + 30 + r25()*30
    });
  }
}

function addBushLine(add, x, y, count){
  for (let i=0;i<count;i++){
    add({
      type:"bush",
      x: x + i*36 + (r26()*14-7),
      y: y + (r27()*16-8),
      s: 0.8 + r28()*0.4,
      baseY: y + 18
    });
  }
}

function addFlowerPatch(add, x, y){
  for (let i=0;i<20;i++){
    add({
      type:"flower",
      x: x + (r29()*110-55),
      y: y + (r30()*60-30),
      s: 0.8 + r31()*0.6,
      baseY: y + 8
    });
  }
}

/* ---- Prop drawing (rugged, less cloud) ---- */

function drawTreeTrunk(ctx, x,y,s){
  const w = 16*s;
  const h = 26*s;

  ctx.fillStyle = "#5b3d24";
  roundRect(ctx, x-w/2, y-h, w, h, 8*s, true);

  // trunk grain
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000";
  ctx.fillRect(x-w/2 + 4*s, y-h + 6*s, 2*s, h-12*s);
  ctx.fillRect(x-w/2 + 9*s, y-h + 8*s, 2*s, h-16*s);
  ctx.globalAlpha = 1;

  // base shadow
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y+4, 16*s, 7*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawTreeCanopy(ctx, x,y,s){
  // Rugged canopy: deeper greens + outline so it reads like foliage
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#4f6f33"; // shadow leaf
  blob(ctx, x+22*s, y-20*s, 34*s, 22*s, 0.14);

  ctx.fillStyle = "#5f7f3b"; // deep leaf
  blob(ctx, x, y-34*s, 44*s, 28*s, 0.10);

  ctx.fillStyle = "#6b8a42"; // mid leaf
  blob(ctx, x-18*s, y-24*s, 36*s, 24*s, -0.08);

  // outline “ink”
  ctx.globalAlpha = 0.30;
  ctx.strokeStyle = "rgba(18,10,6,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y-30*s, 46*s, 30*s, 0.10, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // tiny highlight (muted)
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#fff";
  blob(ctx, x-10*s, y-36*s, 22*s, 12*s, 0.06);
  ctx.globalAlpha = 1;
}

function drawRock(ctx, x,y,s){
  ctx.fillStyle = "#7a7463";
  blob(ctx, x, y, 22*s, 14*s, 0.06);

  // edge outline to stop “cloud” vibe
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(18,10,6,.30)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 23*s, 15*s, 0.06, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // highlight
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#fff";
  blob(ctx, x-6*s, y-6*s, 10*s, 6*s, -0.08);
  ctx.globalAlpha = 1;

  // shadow
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x+2, y+10*s, 18*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBush(ctx, x,y,s){
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#3f6129";
  blob(ctx, x+14*s, y+3*s, 20*s, 12*s, 0.12);

  ctx.fillStyle = "#4f7434";
  blob(ctx, x, y, 26*s, 16*s, 0.08);

  ctx.fillStyle = "#5a8240";
  blob(ctx, x-12*s, y+2*s, 22*s, 14*s, -0.06);

  // outline
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "rgba(18,10,6,.30)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y+1*s, 28*s, 16*s, 0.08, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawFlower(ctx, x,y,s){
  // muted wildflowers (less candy)
  ctx.globalAlpha = 0.85;
  const c = (Math.random() < 0.5) ? "#f3ead6" : "#f1d7e2";
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x, y, 2.2*s, 1.6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---- Shapes ---- */

function roundRect(ctx, x, y, w, h, r, fill){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  if (fill) ctx.fill();
  else ctx.stroke();
}

// IMPORTANT: NO random rotation here (stops “air wobble”)
function blob(ctx, cx, cy, rx, ry, rot = 0){
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI*2);
  ctx.fill();
}

function lerp(a,b,t){ return a + (b-a)*t; }

/* ======================
   Stable randomness per load (NOT per frame)
   We generate a bunch of random streams once.
   ====================== */

let _seed = 1337;
function _rand(){
  _seed ^= _seed << 13; _seed ^= _seed >> 17; _seed ^= _seed << 5;
  return ((_seed >>> 0) % 10000) / 10000;
}

// Pre-baked streams so each call is stable across frames
const R = new Array(64).fill(0).map(()=>_rand());
let Ri = 0;
function nextR(){
  const v = R[Ri % R.length];
  Ri++;
  return v;
}

// Named random taps (so edits don’t shift everything too much)
const r1  = ()=>nextR(); const r2  = ()=>nextR(); const r3  = ()=>nextR(); const r4  = ()=>nextR();
const r5  = ()=>nextR(); const r6  = ()=>nextR(); const r7  = ()=>nextR(); const r8  = ()=>nextR();
const r9  = ()=>nextR(); const r10 = ()=>nextR(); const r11 = ()=>nextR(); const r12 = ()=>nextR();
const r13 = ()=>nextR(); const r14 = ()=>nextR(); const r15 = ()=>nextR(); const r16 = ()=>nextR();
const r17 = ()=>nextR(); const r18 = ()=>nextR(); const r19 = ()=>nextR(); const r20 = ()=>nextR();
const r21 = ()=>nextR(); const r22 = ()=>nextR(); const r23 = ()=>nextR(); const r24 = ()=>nextR();
const r25 = ()=>nextR(); const r26 = ()=>nextR(); const r27 = ()=>nextR(); const r28 = ()=>nextR();
const r29 = ()=>nextR(); const r30 = ()=>nextR(); const r31 = ()=>nextR();
