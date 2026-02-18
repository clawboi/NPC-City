export class World {
  constructor(){
    this.w = 2400;
    this.h = 1500;

    this.spawns = {
      actor: { x: 520, y: 820, area:"Sunleaf Suburbs" },
      thug:  { x: 520, y: 820, area:"Sunleaf Suburbs" },
      police:{ x: 520, y: 820, area:"Sunleaf Suburbs" },
    };

    this.roads = buildRoads();

    // --- SOLIDS (collision) ---
    this.solids = [
      { x: 240, y: 220, w: 420, h: 250 },
      { x: 780, y: 220, w: 520, h: 270 },
      { x: 1440, y: 260, w: 560, h: 280 },
      { x: 1580, y: 820, w: 460, h: 260 },

      { x: 1820, y: 430, w: 360, h: 210 },
      { x: 1920, y: 690, w: 330, h: 200 },

      { x: 0, y: 1210, w: this.w, h: 290 },
      { x: 1760, y: 120, w: 520, h: 95 },
    ];

    this.bridge = { x: 1010, y: 1170, w: 260, h: 64 };

    this.landmarks = [
      { id:"cottage", x: 340,  y: 350, text:"Cottage",       hint:"Home (soon)" },
      { id:"market",  x: 920,  y: 340, text:"Corner Market", hint:"Snacks (soon)" },
      { id:"studio",  x: 1600, y: 390, text:"Acting Studio", hint:"Audition (soon)" },
      { id:"bridge",  x: this.bridge.x + 70, y: this.bridge.y + 20, text:"Bridge", hint:"Cross" },
      { id:"culdesac",x: 2040, y: 590, text:"Cul-de-sac",    hint:"Quiet" },
    ];

    this.stairs = [
      { x: 1760, y: 215, w: 150, h: 40 },
      { x: 860,  y: 620, w: 150, h: 40 },
    ];

    // --- PROPS ---
    this.props = [];
    const add = (p) => this.props.push(p);
    const rng = makeRng(1337);

    addTreeLine(add, rng, 320, 560, 7, 44);
    addTreeLine(add, rng, 640, 980, 10, 52);
    addTreeLine(add, rng, 1420, 740, 9, 56);
    addTreeLine(add, rng, 1700, 980, 8, 52);

    addTreeCluster(add, rng, 1960, 520, 4);
    addTreeCluster(add, rng, 2100, 740, 4);

    addBushStrip(add, rng, 340, 500, 10);
    addBushStrip(add, rng, 880, 520, 12);
    addBushStrip(add, rng, 1500, 560, 10);

    add({ type:"rock", x: 520,  y: 1140, s: 1.0,  baseY: 1140 });
    add({ type:"rock", x: 1260, y: 1138, s: 1.2,  baseY: 1138 });
    add({ type:"rock", x: 1780, y: 1144, s: 0.95, baseY: 1144 });

    addFlowerPatch(add, rng, 980, 680);
    addFlowerPatch(add, rng, 1560, 920);
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

  draw(ctx, cam){
    // clear screen
    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    ctx.save();
    const cx = Math.round(cam.x);
    const cy = Math.round(cam.y);
    ctx.translate(-cx, -cy);

    // --- WORLD BASE ---
    drawGround(ctx, 0, 0, this.w, this.h);

    // --- ROADS ---
    drawRoads(ctx, this.roads);

    // --- RAISED / STAIRS ---
    drawRaised(ctx, 1760, 120, 520, 95);
    for (const s of this.stairs) drawStairs(ctx, s.x, s.y, s.w, s.h);

    // --- BRIDGE ---
    drawBridge(ctx, this.bridge.x, this.bridge.y, this.bridge.w, this.bridge.h);

    // --- LANDMARK TEXT ---
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(18,10,6,.70)";
    for (const lm of this.landmarks){
      ctx.fillText(lm.text, lm.x, lm.y);
    }

    // --- PROPS (depth-sorted) ---
    const propsSorted = [...this.props].sort((a,b)=>(a.baseY||a.y)-(b.baseY||b.y));
    for (const pr of propsSorted){
      if (pr.type === "tree"){
        drawTreeTrunk(ctx, pr.x, pr.y, pr.s);
        drawTreeCanopy(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "rock"){
        drawRock(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "bush"){
        drawBush(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "flower"){
        drawFlower(ctx, pr.x, pr.y, pr.s, pr.c || 0);
      }
    }

    ctx.restore();
  }

  drawAbove(){ /* intentionally empty */ }
}

/* ===================== Drawing ===================== */

function drawGround(ctx, x, y, w, h){
  ctx.fillStyle = "#5a6d34";
  ctx.fillRect(x, y, w, h);

  // Micro-noise (stable)
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0; i<5200; i++){
    const px = (i*37) % w;
    const py = (i*91) % h;
    ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Straw flecks
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#c7b07a";
  for (let i=0; i<1400; i++){
    const px = (i*53) % w;
    const py = (i*131) % h;
    if ((i % 7) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Worn ovals
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#6a8040";
  for (let i=0; i<40; i++){
    const px = x + ((i*173) % w);
    const py = y + ((i*269) % h);
    ctx.beginPath();
    ctx.ellipse(px, py, 70, 45, 0.10, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRoads(ctx, roads){
  // Asphalt
  for (const r of roads.asphalt){
    ctx.fillStyle = "#25252c";
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r || 18, true);

    // speckle
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    for (let i=0; i<900; i++){
      const px = r.x + ((i*29) % r.w);
      const py = r.y + ((i*71) % r.h);
      if ((i % 3) === 0) ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalAlpha = 1;

    // edge grime
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 7;
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r || 18, false);
    ctx.globalAlpha = 1;

    // highlight strip
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "#fff";
    roundRect(ctx, r.x+8, r.y+10, r.w-16, 10, 8, true);
    ctx.globalAlpha = 1;
  }

  // Sidewalk
  for (const s of roads.sidewalk){
    ctx.fillStyle = "#bfb9a8";
    roundRect(ctx, s.x, s.y, s.w, s.h, s.r || 14, true);

    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#000";
    for (let i=0;i<8;i++){
      ctx.fillRect(s.x + 10 + i*(s.w/8), s.y + 6, 1, s.h-12);
    }
    ctx.globalAlpha = 1;
  }

  // Lane marks
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#efe8d6";
  for (const m of roads.marks){
    ctx.fillRect(m.x, m.y, m.w, m.h);
  }
  ctx.globalAlpha = 1;

  // Driveways
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#a8a294";
  for (const d of roads.driveways){
    roundRect(ctx, d.x, d.y, d.w, d.h, 10, true);
  }
  ctx.globalAlpha = 1;
}

function drawBridge(ctx, x,y,w,h){
  ctx.fillStyle = "#5e4128";
  roundRect(ctx, x, y, w, h, 10, true);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  for (let i=0; i<12; i++){
    ctx.fillRect(x+10+i*(w/12), y+8, 2, h-16);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(x+12, y+10, w-24, 4);
  ctx.fillRect(x+12, y+h-14, w-24, 4);
}

function drawRaised(ctx, x,y,w,h){
  ctx.fillStyle = "#9d865b";
  roundRect(ctx, x, y, w, h, 14, true);
  ctx.fillStyle = "rgba(0,0,0,.16)";
  roundRect(ctx, x, y+10, w, 10, 10, true);
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

/* ===================== Props ===================== */

function drawTreeTrunk(ctx, x, y, s){
  s *= 0.80;
  const trunkW = 14*s;
  const trunkH = 38*s;

  ctx.fillStyle = "#563721";
  roundRect(ctx, x - trunkW/2, y - trunkH, trunkW, trunkH, 8*s, true);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#fff";
  roundRect(ctx, x - trunkW/2 + 3*s, y - trunkH + 6*s, 3*s, trunkH - 12*s, 6*s, true);
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 14*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawTreeCanopy(ctx, x, y, s){
  s *= 0.80;

  const topY  = y - 46*s;
  const midY  = y - 30*s;
  const baseY = y - 16*s;

  ctx.fillStyle = "#2f4e22";
  blob(ctx, x, baseY, 22*s, 12*s, 0.06);
  blob(ctx, x-14*s, baseY+2*s, 16*s, 10*s, -0.08);
  blob(ctx, x+14*s, baseY+2*s, 16*s, 10*s, 0.10);

  ctx.fillStyle = "#3a5b2a";
  blob(ctx, x, midY, 30*s, 18*s, 0.06);
  blob(ctx, x-18*s, midY+2*s, 20*s, 14*s, -0.10);
  blob(ctx, x+18*s, midY+2*s, 20*s, 14*s, 0.10);

  ctx.fillStyle = "#476b33";
  blob(ctx, x, topY, 24*s, 14*s, 0.06);

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(18,10,6,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 30*s, 36*s, 26*s, 0.08, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawRock(ctx, x,y,s){
  ctx.fillStyle = "#706a5c";
  blob(ctx, x, y, 22*s, 14*s, 0.06);

  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(18,10,6,.30)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 23*s, 15*s, 0.06, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#fff";
  blob(ctx, x-6*s, y-6*s, 10*s, 6*s, -0.08);
  ctx.globalAlpha = 1;
}

function drawBush(ctx, x,y,s){
  ctx.fillStyle = "#4a5b2f";
  blob(ctx, x, y, 26*s, 16*s, 0.08);

  ctx.fillStyle = "#3b4b26";
  blob(ctx, x+14*s, y+3*s, 20*s, 12*s, 0.12);

  ctx.fillStyle = "#566b36";
  blob(ctx, x-12*s, y+2*s, 22*s, 14*s, -0.06);

  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(18,10,6,.30)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y+1*s, 28*s, 16*s, 0.08, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawFlower(ctx, x,y,s,cIndex){
  const colors = ["#f2ead8", "#f0d7e2", "#e9f0d9"];
  const c = colors[cIndex % colors.length];
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x, y, 2.2*s, 1.6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ===================== Layout Builders ===================== */

function buildRoads(){
  const asphalt = [];
  const sidewalk = [];
  const marks = [];
  const driveways = [];

  asphalt.push({ x: 120, y: 740, w: 1900, h: 160, r: 24 });
  sidewalk.push({ x: 110, y: 730, w: 1920, h: 180, r: 26 });

  asphalt.push({ x: 920, y: 360, w: 160, h: 560, r: 24 });
  sidewalk.push({ x: 910, y: 350, w: 180, h: 580, r: 26 });

  asphalt.push({ x: 760, y: 470, w: 320, h: 140, r: 22 });
  sidewalk.push({ x: 750, y: 460, w: 340, h: 160, r: 24 });

  asphalt.push({ x: 1840, y: 520, w: 520, h: 320, r: 90 });
  sidewalk.push({ x: 1830, y: 510, w: 540, h: 340, r: 96 });

  for (let i=0;i<26;i++) marks.push({ x: 160 + i*70, y: 818, w: 32, h: 4 });
  for (let i=0;i<9;i++)  marks.push({ x: 998, y: 390 + i*60, w: 4, h: 28 });

  driveways.push({ x: 330,  y: 630, w: 70, h: 110 });
  driveways.push({ x: 520,  y: 630, w: 70, h: 110 });
  driveways.push({ x: 900,  y: 630, w: 70, h: 110 });
  driveways.push({ x: 1520, y: 630, w: 70, h: 110 });
  driveways.push({ x: 1960, y: 840, w: 70, h: 110 });

  return { asphalt, sidewalk, marks, driveways };
}

function addTreeLine(add, rng, x, y, count, step){
  for (let i=0;i<count;i++){
    const yy = y + (rng()*26-13);
    add({
      type:"tree",
      x: x + i*step + (rng()*18-9),
      y: yy,
      s: 0.85 + rng()*0.35,
      baseY: yy + 2
    });
  }
}

function addTreeCluster(add, rng, x, y, count){
  for (let i=0;i<count;i++){
    const yy = y + (rng()*90-45);
    add({
      type:"tree",
      x: x + (rng()*120-60),
      y: yy,
      s: 0.9 + rng()*0.4,
      baseY: yy + 2
    });
  }
}

function addBushStrip(add, rng, x, y, count){
  for (let i=0;i<count;i++){
    const yy = y + (rng()*10-5);
    add({
      type:"bush",
      x: x + i*34 + (rng()*10-5),
      y: yy,
      s: 0.75 + rng()*0.35,
      baseY: yy + 2
    });
  }
}

function addFlowerPatch(add, rng, x, y){
  for (let i=0;i<18;i++){
    add({
      type:"flower",
      x: x + (rng()*110-55),
      y: y + (rng()*60-30),
      s: 0.8 + rng()*0.6,
      baseY: y + 8,
      c: Math.floor(rng()*3)
    });
  }
}

/* ===================== Geometry ===================== */

function aabb(a,b){
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

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

function blob(ctx, cx, cy, rx, ry, rot = 0){
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI*2);
  ctx.fill();
}

function makeRng(seed){
  let s = seed >>> 0;
  return function(){
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}
