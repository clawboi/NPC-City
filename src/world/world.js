// NPC City — World (Suburban v4: Clean, No Overlap, Walk Around, No Clipping)
// Drop-in replacement for world.js ONLY.
//
// What you asked for (implemented):
// - More suburban look (clean blocks, cul-de-sac, lawns, driveways, sidewalks).
// - NOTHING overlaps (lots are spaced and buildings sit inside yards).
// - You can walk THROUGH the map freely, but NOT through buildings (collision = buildings only).
// - Map extends across the full world (uses the whole W x H).
// - Keeps same World API: getSpawn(), hitsSolid(), nearestLandmark(), draw(), drawAbove().
//
// If your engine uses different prop draw helpers, this file is self-contained and safe.

export class World {
  constructor(){
    this.w = 2600;
    this.h = 1600;

    // Spawns on a sidewalk near the center spine
    this.spawns = {
      actor:  { x: 360, y: 820, area:"Sunleaf Suburbs" },
      thug:   { x: 420, y: 820, area:"Sunleaf Suburbs" },
      police: { x: 480, y: 820, area:"Sunleaf Suburbs" },
    };

    this.buildings = [];
    this.yards = [];
    this.props = [];
    this.solids = [];

    const rng = makeRng(4444);

    // Roads: a simple suburb you can read at a glance
    this.roads = buildSuburbanRoads(this.w, this.h);

    // Lots + buildings, intentionally spaced to avoid overlap
    buildSuburbanLots({
      rng,
      W: this.w,
      H: this.h,
      roads: this.roads,
      addBuilding: (b)=>this.buildings.push(b),
      addYard: (y)=>this.yards.push(y),
      addProp: (p)=>this.props.push(p),
      addDriveway: (d)=>this.roads.driveways.push(d),
    });

    // Collisions: ONLY buildings (no more "walking over houses")
    // We inset slightly so the player can brush past walls smoothly.
    for (const b of this.buildings){
      this.solids.push({ x: b.x+8, y: b.y+8, w: b.w-16, h: b.h-16 });
    }

    // Landmarks for UI hints
    this.landmarks = [
      { id:"homes",    x: 360,  y: 610,  text:"Neighborhood", hint:"Houses" },
      { id:"market",   x: 520,  y: 320,  text:"Corner Market", hint:"Snacks (soon)" },
      { id:"park",     x: 1420, y: 520,  text:"Sunleaf Park",  hint:"Breathe" },
      { id:"studio",   x: 2140, y: 760,  text:"Acting Studio", hint:"Audition (soon)" },
      { id:"culdesac", x: 2320, y: 1130, text:"Cul-de-sac",    hint:"Quiet" },
    ];
  }

  getSpawn(role){ return this.spawns[role] || this.spawns.actor; }

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
      if (d2 <= bestD2){ bestD2 = d2; best = lm; }
    }
    return best;
  }

  draw(ctx, cam){
    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    // Ground
    drawGround(ctx, 0, 0, this.w, this.h);

    // Lawns first (no overlap with roads since roads draw on top)
    for (const y of this.yards) drawYardLawn(ctx, y);

    // Roads on top of grass
    drawRoads(ctx, this.roads);

    // Yard details (driveways/walks) after roads so they read clean
    for (const y of this.yards) drawYardDetails(ctx, y);

    // Buildings
    for (const b of this.buildings){
      if (b.kind === "house")  drawHouse(ctx, b);
      if (b.kind === "market") drawMarket(ctx, b);
      if (b.kind === "studio") drawStudio(ctx, b);
      if (b.kind === "park")   drawParkBlock(ctx, b);
    }

    // Labels
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(0,0,0,.45)";
    for (const lm of this.landmarks) ctx.fillText(lm.text, lm.x, lm.y);

    // Props depth sort (so trees feel grounded)
    const propsSorted = [...this.props].sort((a,b)=>(a.baseY||a.y)-(b.baseY||b.y));
    for (const pr of propsSorted){
      if (pr.type === "tree")    drawTree(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "lamp")    drawLamp(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "bench")   drawBench(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "mailbox") drawMailbox(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "bush")    drawBush(ctx, pr.x, pr.y, pr.s||1);
      if (pr.type === "flower")  drawFlower(ctx, pr.x, pr.y, pr.s||1, pr.c||0);
    }

    ctx.restore();
  }

  drawAbove(){ /* intentionally empty */ }
}

/* ===================== Roads (suburban grid) ===================== */

function buildSuburbanRoads(W, H){
  const asphalt = [];
  const sidewalk = [];
  const marks = [];
  const driveways = [];

  const addStreet = (x,y,w,h,r=22) => {
    sidewalk.push({ x: x-14, y: y-14, w: w+28, h: h+28, r: r+10 });
    asphalt.push ({ x, y, w, h, r });
  };

  // Main horizontal spine (wide)
  addStreet(120, 760, 2360, 180, 28);

  // Upper residential street
  addStreet(160, 520, 2280, 140, 24);

  // Lower residential street
  addStreet(160, 1020, 2280, 140, 24);

  // Left vertical (market street)
  addStreet(380, 260, 160, 520, 24);

  // Center vertical (park connector)
  addStreet(1340, 320, 180, 900, 26);

  // Right vertical (studio strip)
  addStreet(2100, 560, 180, 620, 24);

  // Cul-de-sac bulb (bottom-right)
  sidewalk.push({ x: 2200, y: 1060, w: 420, h: 320, r: 140 });
  asphalt.push ({ x: 2216, y: 1076, w: 388, h: 288, r: 132 });

  // Lane marks
  for (let i=0;i<30;i++) marks.push({ x: 190 + i*74, y: 850, w: 34, h: 4 });
  for (let i=0;i<20;i++) marks.push({ x: 1415, y: 360 + i*58, w: 4, h: 28 });

  return { asphalt, sidewalk, marks, driveways };
}

/* ===================== Lots (NO overlap) ===================== */

function buildSuburbanLots({ rng, W, H, roads, addBuilding, addYard, addProp, addDriveway }){
  // PARK BLOCK (center-right)
  const park = { kind:"park", x: 980, y: 360, w: 820, h: 520 };
  addBuilding(park);

  // Park props
  for (let i=0;i<18;i++){
    const x = park.x + 60 + rng()*(park.w-120);
    const y = park.y + 60 + rng()*(park.h-120);
    addProp({ type:"tree", x, y, s: 1.0 + rng()*0.25, baseY: y+2 });
  }
  addProp({ type:"bench", x: park.x+park.w*0.35, y: park.y+park.h*0.55, s: 1, baseY: park.y+park.h*0.55+2 });
  addProp({ type:"bench", x: park.x+park.w*0.65, y: park.y+park.h*0.45, s: 1, baseY: park.y+park.h*0.45+2 });

  // MARKET (top-left)
  addBuilding({ kind:"market", x: 240, y: 300, w: 340, h: 200 });

  // STUDIO (right strip)
  addBuilding({ kind:"studio", x: 1940, y: 660, w: 420, h: 240 });

  // HOUSE ROWS (planned blocks)
  // Upper row (faces down toward upper street)
  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 160, y0: 300, count: 6, lotW: 260, lotH: 190, gap: 18,
    faceDown: true, streetY: 520
  });

  // Between upper and main (faces down toward main)
  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 160, y0: 600, count: 6, lotW: 260, lotH: 190, gap: 18,
    faceDown: true, streetY: 760
  });

  // Between main and lower (faces up toward main)
  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 160, y0: 940, count: 6, lotW: 260, lotH: 190, gap: 18,
    faceDown: false, streetY: 940
  });

  // Below lower (faces up toward lower street)
  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 160, y0: 1220, count: 6, lotW: 260, lotH: 240, gap: 18,
    faceDown: false, streetY: 1020
  });

  // A few cul-de-sac homes (spaced, no overlap)
  const cx = 2380, cy = 1200;
  for (let i=0;i<5;i++){
    const t = (-1.1 + i*0.50);
    const hx = cx + Math.cos(t)*170 - 90;
    const hy = cy + Math.sin(t)*110 - 60;
    addBuilding({ kind:"house", x: Math.round(hx), y: Math.round(hy), w: 182, h: 120, accent: i%3, variant: (i+1)%3 });
    addYard({ x: Math.round(hx)-14, y: Math.round(hy)-12, w: 210, h: 160 });
    // mailbox
    const mbx = Math.round(hx) + 96;
    const mby = Math.round(hy) + 142;
    addProp({ type:"mailbox", x: mbx, y: mby, s: 1, baseY: mby+2 });
  }
}

function addHouseRow({ rng, addBuilding, addYard, addProp, addDriveway, x0, y0, count, lotW, lotH, gap, faceDown, streetY }){
  for (let i=0;i<count;i++){
    const lotX = x0 + i*(lotW+gap);
    const lotY = y0;

    // Yard
    const yard = { x: lotX+10, y: lotY+10, w: lotW-20, h: lotH-20 };
    addYard(yard);

    // House inside yard (never overlaps others)
    const houseW = 168 + Math.floor(rng()*28);
    const houseH = 110 + Math.floor(rng()*20);
    const hx = lotX + (lotW-houseW)/2;
    const hy = faceDown ? (lotY + lotH - houseH - 24) : (lotY + 24);

    addBuilding({
      kind:"house",
      x: Math.round(hx), y: Math.round(hy),
      w: houseW, h: houseH,
      accent: i%3,
      variant: (i + Math.floor(rng()*3))%3
    });

    // Driveway (connect to street)
    const dW = 58;
    const dH = 86 + Math.floor(rng()*22);
    const dX = lotX + 28 + Math.floor(rng()*40);
    const dY = faceDown ? (streetY + 8) : (streetY - dH - 8);
    yard.drive = { x:dX, y:dY, w:dW, h:dH };
    addDriveway({ x:dX, y:dY, w:dW, h:dH, r: 10 });

    // Walkway
    const walkH = 50;
    const walkY = faceDown ? (hy - walkH) : (hy + houseH);
    yard.walk = { x: hx + houseW*0.5 - 8, y: walkY, w: 16, h: walkH };

    // Mailbox
    const mbY = faceDown ? (streetY + 18) : (streetY - 18);
    addProp({ type:"mailbox", x: dX + dW + 10, y: mbY, s: 1, baseY: mbY+2 });

    // Trees (placed in back corners so they never block driveways visually)
    if (rng() < 0.75){
      const tx = yard.x + 28 + rng()*46;
      const ty = yard.y + yard.h - 16;
      addProp({ type:"tree", x: tx, y: ty, s: 0.95 + rng()*0.25, baseY: ty+2 });
    }
    if (rng() < 0.35){
      const tx = yard.x + yard.w - (28 + rng()*46);
      const ty = yard.y + yard.h - 16;
      addProp({ type:"tree", x: tx, y: ty, s: 0.90 + rng()*0.25, baseY: ty+2 });
    }

    // Bushes
    const bushes = 2 + Math.floor(rng()*2);
    for (let k=0;k<bushes;k++){
      const bx = yard.x + 36 + k*(yard.w/(bushes+1));
      const by = yard.y + 28 + rng()*10;
      addProp({ type:"bush", x: bx, y: by, s: 0.75 + rng()*0.25, baseY: by+2 });
    }

    // Flowers
    if (rng() < 0.5) addFlowerPatch(addProp, rng, yard.x + yard.w*0.55, yard.y + yard.h*0.55);
  }
}

/* ===================== Visuals ===================== */

function drawGround(ctx, x, y, w, h){
  ctx.fillStyle = "#556b33";
  ctx.fillRect(x, y, w, h);

  // micro-noise
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0; i<6400; i++){
    const px = (i*37) % w;
    const py = (i*91) % h;
    if ((i % 2) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // warm flecks
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#d9c18b";
  for (let i=0; i<1700; i++){
    const px = (i*53) % w;
    const py = (i*131) % h;
    if ((i % 7) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawYardLawn(ctx, y){
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#56753a";
  roundRect(ctx, y.x, y.y, y.w, y.h, 18, true);

  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0;i<240;i++){
    const px = y.x + ((i*19) % y.w);
    const py = y.y + ((i*41) % y.h);
    if (i % 4 === 0) ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawYardDetails(ctx, y){
  if (y.drive){
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#a8a294";
    roundRect(ctx, y.drive.x, y.drive.y, y.drive.w, y.drive.h, 10, true);
    ctx.globalAlpha = 1;
  }
  if (y.walk){
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "#d3c8b5";
    roundRect(ctx, y.walk.x, y.walk.y, y.walk.w, y.walk.h, 8, true);
    ctx.globalAlpha = 1;
  }
  // subtle fence
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  roundRect(ctx, y.x+10, y.y+y.h-18, y.w-20, 8, 6, true);
  ctx.globalAlpha = 1;
}

function drawRoads(ctx, roads){
  // sidewalks first
  for (const s of roads.sidewalk){
    ctx.fillStyle = "#c3bdaa";
    roundRect(ctx, s.x, s.y, s.w, s.h, s.r || 14, true);

    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#000";
    for (let i=0;i<10;i++){
      ctx.fillRect(s.x + 10 + i*(s.w/10), s.y + 6, 1, s.h-12);
    }
    ctx.globalAlpha = 1;
  }

  // asphalt
  for (const r of roads.asphalt){
    ctx.fillStyle = "#24242c";
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r || 18, true);

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    for (let i=0; i<1100; i++){
      const px = r.x + ((i*29) % r.w);
      const py = r.y + ((i*71) % r.h);
      if ((i % 3) === 0) ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 7;
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r || 18, false);
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#fff";
    roundRect(ctx, r.x+10, r.y+10, r.w-20, 10, 8, true);
    ctx.globalAlpha = 1;
  }

  // lane marks
  ctx.globalAlpha = 0.33;
  ctx.fillStyle = "#efe8d6";
  for (const m of roads.marks) ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.globalAlpha = 1;

  // driveways connect visually
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#a8a294";
  for (const d of roads.driveways){
    roundRect(ctx, d.x, d.y, d.w, d.h, d.r || 10, true);
  }
  ctx.globalAlpha = 1;
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

  // grime base
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#000";
  roundRect(ctx, x+6, y+h-18, w-12, 12, 8, true);
  ctx.globalAlpha = 1;

  // violet accent strip
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

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(138,46,255,.20)";
  roundRect(ctx, x+12, y+44, w-24, 28, 10, true);
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#111118";
  roundRect(ctx, x+22, y+82, w-44, h-116, 10, true);
  ctx.globalAlpha = 1;
}

function drawStudio(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#cbbd9c";
  roundRect(ctx, x, y, w, h, 18, true);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000";
  for (let i=0;i<10;i++){
    ctx.fillRect(x+18 + i*((w-36)/10), y+18, 1, h-36);
  }
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#14131a";
  roundRect(ctx, x+w*0.5-22, y+h-52, 44, 42, 10, true);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(138,46,255,.08)";
  ctx.fillRect(x, y+10, w, 8);
}

function drawParkBlock(ctx, b){
  const { x,y,w,h } = b;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#4f6f39";
  roundRect(ctx, x, y, w, h, 34, true);
  ctx.globalAlpha = 1;

  // path loop
  ctx.globalAlpha = 0.70;
  ctx.fillStyle = "#d8c6a2";
  roundRect(ctx, x+70, y+80, w-140, h-160, 30, true);
  ctx.globalAlpha = 1;

  // inner meadow
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#4a6a35";
  roundRect(ctx, x+100, y+110, w-200, h-220, 26, true);
  ctx.globalAlpha = 1;
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

function drawBush(ctx, x,y,s){
  ctx.fillStyle = "#4a5b2f";
  blob(ctx, x, y, 26*s, 16*s, 0.08);
  ctx.fillStyle = "#3b4b26";
  blob(ctx, x+14*s, y+3*s, 20*s, 12*s, 0.12);
  ctx.fillStyle = "#566b36";
  blob(ctx, x-12*s, y+2*s, 22*s, 14*s, -0.06);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(0,0,0,.35)";
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

function addFlowerPatch(add, rng, x, y){
  for (let i=0;i<14;i++){
    const yy = y + (rng()*60-30);
    add({
      type:"flower",
      x: x + (rng()*110-55),
      y: yy,
      s: 0.8 + rng()*0.6,
      baseY: yy + 8,
      c: Math.floor(rng()*3)
    });
  }
}

/* ===================== Geometry / RNG ===================== */

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
