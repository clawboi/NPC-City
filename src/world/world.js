// NPC City — World (Sandbox v3: NO-COLLISION, Simple Walkthrough)
// Drop-in replacement for world.js ONLY.
//
// What this is:
// - Ultra-simple layout: a few houses + 2 buildings + a tiny plaza + one road loop.
// - NO movement restrictions: hitsSolid() always returns false and solids are empty.
// - Still keeps landmarks + props for UI hints.
// - Deterministic and fast.

export class World {
  constructor(){
    this.w = 2000;
    this.h = 1200;

    // Spawn everyone near the "main loop"
    this.spawns = {
      actor:  { x: 320, y: 620, area:"Sunleaf Sandbox" },
      thug:   { x: 380, y: 620, area:"Sunleaf Sandbox" },
      police: { x: 440, y: 620, area:"Sunleaf Sandbox" },
    };

    // Geometry containers (engine expects these)
    this.buildings = [];
    this.yards = [];
    this.props = [];
    this.solids = []; // intentionally empty

    // Tiny "district" labels (for future)
    this.districts = [
      { id:"sandbox", name:"Sunleaf Sandbox", x: 0, y: 0, w: this.w, h: this.h }
    ];

    // Simple road loop (purely visual)
    this.roads = buildRoadLoop();

    // A few buildings, spaced wide so you can walk around everything
    // Houses (left neighborhood)
    this.buildings.push(
      house(220, 360, 190, 120, 0, 0),
      house(480, 360, 190, 120, 1, 1),
      house(220, 560, 190, 120, 2, 2),
      house(480, 560, 190, 120, 0, 1),
    );

    // Market + Studio (right side)
    this.buildings.push(
      { kind:"market", x: 1320, y: 360, w: 280, h: 180 },
      { kind:"studio", x: 1280, y: 620, w: 360, h: 200 },
    );

    // Plaza pad (center top)
    this.buildings.push(
      { kind:"plaza", x: 760, y: 220, w: 420, h: 190 }
    );

    // Lawns/yards (simple patches)
    const yards = [
      { x: 180, y: 320, w: 270, h: 190 },
      { x: 440, y: 320, w: 270, h: 190 },
      { x: 180, y: 520, w: 270, h: 190 },
      { x: 440, y: 520, w: 270, h: 190 },
      { x: 1240, y: 320, w: 420, h: 250, style:"tight" },
      { x: 1220, y: 590, w: 460, h: 270, style:"tight" },
      { x: 720, y: 190, w: 500, h: 260, style:"plaza" },
    ];
    this.yards.push(...yards);

    // Landmarks for UI hints
    this.landmarks = [
      { id:"homes",   x: 300,  y: 310, text:"Houses",        hint:"Neighborhood" },
      { id:"market",  x: 1360, y: 340, text:"Corner Market", hint:"Snacks (soon)" },
      { id:"studio",  x: 1360, y: 610, text:"Acting Studio", hint:"Audition (soon)" },
      { id:"plaza",   x: 860,  y: 210, text:"Plaza",         hint:"Meetups (soon)" },
      { id:"loop",    x: 980,  y: 520, text:"Main Loop",     hint:"Cruise" },
    ];

    // Props: a few trees/lamps/benches so it doesn't feel empty
    addPropsSimple(this.props);
  }

  getSpawn(role){ return this.spawns[role] || this.spawns.actor; }

  // NO RESTRICTIONS: always allow movement
  hitsSolid(_rect){ return false; }

  nearestLandmark(px, py, radius = 64){
    let best = null;
    let bestD2 = radius * radius;
    for (const lm of this.landmarks){
      const dx = lm.x - px;
      const dy = lm.y - py;
      const d2 = dx*dx + dy*dy;
      if (d2 <= bestD2){ bestD2 = d2; best = lm; }
    }
    return best;
  }

  draw(ctx, cam){
    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    ctx.save();
    const cx = Math.round(cam.x);
    const cy = Math.round(cam.y);
    ctx.translate(-cx, -cy);

    // Ground
    drawGround(ctx, 0, 0, this.w, this.h);

    // Lawns first
    for (const y of this.yards) drawYard(ctx, y);

    // Roads
    drawRoadLoopVisual(ctx, this.roads);

    // Buildings
    for (const b of this.buildings){
      if (b.kind === "house")  drawHouse(ctx, b);
      if (b.kind === "market") drawMarket(ctx, b);
      if (b.kind === "studio") drawStudio(ctx, b);
      if (b.kind === "plaza")  drawPlaza(ctx, b);
    }

    // Labels
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(0,0,0,.45)";
    for (const lm of this.landmarks) ctx.fillText(lm.text, lm.x, lm.y);

    // Props depth sort
    const propsSorted = [...this.props].sort((a,b)=>(a.baseY||a.y)-(b.baseY||b.y));
    for (const pr of propsSorted){
      if (pr.type === "tree")   drawTree(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "lamp")   drawLamp(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "bench")  drawBench(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "mailbox")drawMailbox(ctx, pr.x, pr.y, pr.s||1);
    }

    ctx.restore();
  }

  drawAbove(){ /* intentionally empty */ }
}

/* ===================== Layout ===================== */

function buildRoadLoop(){
  // single loop road (visual only)
  return {
    loop: { x: 120, y: 260, w: 1720, h: 740, r: 54 },
    inner: { x: 220, y: 360, w: 1520, h: 540, r: 44 },
    cross: [
      { x: 740, y: 610, w: 240, h: 110 },
      { x: 1210, y: 520, w: 240, h: 110 },
    ]
  };
}

function house(x,y,w,h,accent,variant){
  return { kind:"house", x,y,w,h, accent, variant };
}

function addPropsSimple(props){
  // Neighborhood trees
  props.push(
    { type:"tree", x: 120,  y: 300, s: 1.15, baseY: 302 },
    { type:"tree", x: 720,  y: 980, s: 1.05, baseY: 982 },
    { type:"tree", x: 1760, y: 340, s: 1.15, baseY: 342 },
    { type:"tree", x: 1700, y: 980, s: 1.05, baseY: 982 },
    { type:"tree", x: 980,  y: 230, s: 1.05, baseY: 232 },
  );

  // Lamps on loop corners
  props.push(
    { type:"lamp", x: 220,  y: 300, s: 1, baseY: 302 },
    { type:"lamp", x: 1760, y: 300, s: 1, baseY: 302 },
    { type:"lamp", x: 220,  y: 980, s: 1, baseY: 982 },
    { type:"lamp", x: 1760, y: 980, s: 1, baseY: 982 },
  );

  // Benches near plaza
  props.push(
    { type:"bench", x: 860, y: 420, s: 1, baseY: 422 },
    { type:"bench", x: 1040, y: 420, s: 1, baseY: 422 },
  );

  // Mailboxes near homes
  props.push(
    { type:"mailbox", x: 200, y: 520, s: 1, baseY: 522 },
    { type:"mailbox", x: 460, y: 520, s: 1, baseY: 522 },
  );
}

/* ===================== Drawing ===================== */

function drawGround(ctx, x, y, w, h){
  ctx.fillStyle = "#556b33";
  ctx.fillRect(x, y, w, h);

  // micro-noise
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0; i<5200; i++){
    const px = (i*37) % w;
    const py = (i*91) % h;
    if ((i % 2) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // warm flecks
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#d9c18b";
  for (let i=0; i<1400; i++){
    const px = (i*53) % w;
    const py = (i*131) % h;
    if ((i % 7) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawYard(ctx, y){
  const grass = (y.style === "plaza") ? "#5a7434" : "#56753a";
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = grass;
  roundRect(ctx, y.x, y.y, y.w, y.h, 18, true);

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#000";
  roundRect(ctx, y.x+10, y.y+y.h-18, y.w-20, 8, 6, true);
  ctx.globalAlpha = 1;
}

function drawRoadLoopVisual(ctx, r){
  // sidewalk ring
  ctx.fillStyle = "#c3bdaa";
  roundRect(ctx, r.loop.x-14, r.loop.y-14, r.loop.w+28, r.loop.h+28, r.loop.r+10, true);
  // asphalt ring
  ctx.fillStyle = "#24242c";
  roundRect(ctx, r.loop.x, r.loop.y, r.loop.w, r.loop.h, r.loop.r, true);
  // carve inner grass
  ctx.fillStyle = "#556b33";
  roundRect(ctx, r.inner.x, r.inner.y, r.inner.w, r.inner.h, r.inner.r, true);

  // lane marks
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = "#efe8d6";
  for (let i=0;i<22;i++){
    ctx.fillRect(r.loop.x + 60 + i*74, r.loop.y + r.loop.h/2, 34, 4);
  }
  ctx.globalAlpha = 1;

  // crosswalks
  for (const c of r.cross){
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(239,232,214,.9)";
    for (let i=0;i<8;i++){
      const xx = c.x + 10 + i*((c.w-20)/8);
      ctx.fillRect(xx, c.y+10, 10, c.h-20);
    }
    ctx.globalAlpha = 1;
  }
}

function drawHouse(ctx, b){
  const { x,y,w,h, accent=0, variant=0 } = b;

  ctx.fillStyle = "#c3ad84";
  roundRect(ctx, x, y, w, h, 14, true);

  // roof
  ctx.fillStyle = "rgba(0,0,0,.18)";
  roundRect(ctx, x+8, y+8, w-16, 22, 10, true);

  // windows
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#16161d";
  if (variant === 0){
    roundRect(ctx, x+24, y+50, 42, 30, 8, true);
    roundRect(ctx, x+w-66, y+50, 42, 30, 8, true);
  } else if (variant === 1){
    roundRect(ctx, x+30, y+46, 46, 32, 8, true);
    roundRect(ctx, x+30, y+86, 46, 32, 8, true);
  } else {
    roundRect(ctx, x+w*0.5-22, y+52, 44, 30, 8, true);
  }
  ctx.globalAlpha = 1;

  // door
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#1a1412";
  roundRect(ctx, x+w*0.5-14, y+h-44, 28, 34, 6, true);
  ctx.globalAlpha = 1;

  // accent strip
  const accents = [
    "rgba(138,46,255,.05)",
    "rgba(138,46,255,.07)",
    "rgba(138,46,255,.09)",
  ];
  ctx.fillStyle = accents[accent % accents.length];
  ctx.fillRect(x, y, w, 10);
}

function drawMarket(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#b9b2a2";
  roundRect(ctx, x, y, w, h, 16, true);

  // awning
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(138,46,255,.20)";
  roundRect(ctx, x+12, y+44, w-24, 28, 10, true);
  ctx.globalAlpha = 1;

  // glass
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#111118";
  roundRect(ctx, x+22, y+82, w-44, h-116, 10, true);
  ctx.globalAlpha = 1;
}

function drawStudio(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#cbbd9c";
  roundRect(ctx, x, y, w, h, 18, true);

  // ribs
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000";
  for (let i=0;i<10;i++){
    ctx.fillRect(x+18 + i*((w-36)/10), y+18, 1, h-36);
  }
  ctx.globalAlpha = 1;

  // door
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#14131a";
  roundRect(ctx, x+w*0.5-22, y+h-52, 44, 42, 10, true);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(138,46,255,.08)";
  ctx.fillRect(x, y+10, w, 8);
}

function drawPlaza(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#b9b0a1";
  roundRect(ctx, x, y, w, h, 22, true);

  // inner pad
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  roundRect(ctx, x+26, y+32, w-52, h-64, 18, true);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(138,46,255,.10)";
  roundRect(ctx, x+20, y+16, w-40, 16, 10, true);
}

/* ===================== Props ===================== */

function drawTree(ctx, x, y, s){
  const trunkW = 12*s, trunkH = 34*s;
  ctx.fillStyle = "#563721";
  roundRect(ctx, x - trunkW/2, y - trunkH, trunkW, trunkH, 8*s, true);

  const topY  = y - 44*s;
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

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 14*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawLamp(ctx, x, y, s){
  const poleH = 52*s;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#2a2523";
  roundRect(ctx, x-3*s, y-poleH, 6*s, poleH, 4*s, true);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#3b3330";
  roundRect(ctx, x-10*s, y-poleH-8*s, 20*s, 10*s, 6*s, true);

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x, y-poleH+12*s, 22*s, 14*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBench(ctx, x, y, s){
  const w = 46*s, h = 10*s;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#5a3a24";
  roundRect(ctx, x-w/2, y-h, w, h, 6, true);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.fillRect(x-w/2+6, y-h+3, w-12, 2);
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#3d2416";
  ctx.fillRect(x-w/2+6, y-h+8, 4, 10*s);
  ctx.fillRect(x+w/2-10, y-h+8, 4, 10*s);
  ctx.globalAlpha = 1;
}

function drawMailbox(ctx, x, y, s){
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#2f2a28";
  roundRect(ctx, x-2*s, y-18*s, 4*s, 18*s, 3*s, true);

  ctx.fillStyle = "rgba(138,46,255,.14)";
  roundRect(ctx, x-10*s, y-26*s, 20*s, 10*s, 6*s, true);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.fillRect(x-8*s, y-23*s, 16*s, 1);
  ctx.globalAlpha = 1;
}

/* ===================== Geometry ===================== */

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
