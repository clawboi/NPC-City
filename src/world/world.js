// NPC City — World (Sunleaf District v2)
// Drop-in replacement for world.js ONLY.
// Goal: cleaner flow, readable districts, fewer "random rectangles", better composition.
//
// Notes:
// - Keeps the same exported World class API used by the engine.
// - No external assets required.
// - Deterministic layout via seeded RNG.
// - Designed for top-down, pixel-ish, cozy suburb/city blend.

export class World {
  constructor(){
    // Bigger, more intentional canvas
    this.w = 2600;
    this.h = 1700;

    // ========= District anchors (for vibes + future missions) =========
    // North: "Old Plaza" (small civic block)
    // Center: "Sunleaf Park" (big)
    // South: "Creekline" river walk + bridge
    // East: "Cul-de-sac" + studio strip
    // West: "Cottage Row" + market corner

    this.districts = [
      { id:"plaza",   name:"Old Plaza",         x: 160,  y: 120,  w: 820,  h: 420 },
      { id:"park",    name:"Sunleaf Park",      x: 980,  y: 250,  w: 1040, h: 720 },
      { id:"suburbs", name:"Sunleaf Suburbs",   x: 120,  y: 560,  w: 2320, h: 720 },
      { id:"river",   name:"Creekline",         x: 0,    y: 1320, w: this.w, h: 300 },
    ];

    // Spawns: safely on sidewalks, not inside solids
    this.spawns = {
      actor:  { x: 420, y: 860, area:"Sunleaf Suburbs" },
      thug:   { x: 520, y: 860, area:"Sunleaf Suburbs" },
      police: { x: 620, y: 860, area:"Sunleaf Suburbs" },
    };

    const rng = makeRng(20260217);

    // ========= River (diagonal feel) =========
    // Instead of a flat band, we draw a tapered "creek" with banks for readability.
    // Collisions use a simplified belt with bridge gap.
    this.river = {
      y: 1360, h: 260,
      // "banks" are for drawing only
      bankTop: 1340,
      bankBot: 1638
    };

    this.bridge = { x: 1420, y: 1346, w: 320, h: 84 };

    // ========= Roads (blocky but human) =========
    this.roads = buildDistrictRoads(this.w, this.h, this.bridge, this.districts, rng);

    // ========= Visible geometry =========
    this.buildings = [];
    this.yards = [];
    this.props = [];

    // ========= Build lots/buildings around roads =========
    buildLotsV2({
      rng,
      W: this.w,
      H: this.h,
      districts: this.districts,
      river: this.river,
      bridge: this.bridge,
      roads: this.roads,
      addBuilding: (b)=>this.buildings.push(b),
      addYard: (y)=>this.yards.push(y),
      addProp: (p)=>this.props.push(p),
      addDriveway: (d)=>this.roads.driveways.push(d),
    });

    // ========= SOLIDS (collision) =========
    this.solids = [];

    // Buildings collide (slight inset so it feels smooth)
    for (const b of this.buildings){
      this.solids.push({ x: b.x+6, y: b.y+6, w: b.w-12, h: b.h-12 });
    }

    // Creek collision belt, with bridge gap
    // (We keep it simple for speed.)
    const gapL = this.bridge.x - 12;
    const gapR = this.bridge.x + this.bridge.w + 12;
    this.solids.push({ x: 0,   y: this.river.y, w: gapL, h: this.river.h });
    this.solids.push({ x: gapR, y: this.river.y, w: this.w-gapR, h: this.river.h });

    // Small raised plaza steps (visual landmark)
    this.raised = { x: 760, y: 210, w: 360, h: 86 };
    this.solids.push({ x: this.raised.x, y: this.raised.y, w: this.raised.w, h: this.raised.h });

    this.stairs = [
      { x: 820,  y: 298, w: 130, h: 44 }, // Plaza stairs
      { x: 1880, y: 1040, w: 150, h: 44 }, // Small overlook stairs near east strip
    ];

    // ========= Landmarks =========
    // These are used by UI/tooltips and future missions.
    const park = this.districts.find(d=>d.id==="park");
    this.landmarks = [
      { id:"cottage",  x: 260,  y: 740,  text:"Cottage Row",     hint:"Home (soon)" },
      { id:"market",   x: 340,  y: 520,  text:"Corner Market",   hint:"Snacks (soon)" },
      { id:"plaza",    x: 560,  y: 250,  text:"Old Plaza",       hint:"Meetups (soon)" },
      { id:"studio",   x: 2100, y: 700,  text:"Acting Studio",   hint:"Audition (soon)" },
      { id:"park",     x: park.x + park.w*0.52, y: park.y + park.h*0.56, text:"Sunleaf Park", hint:"Breathe" },
      { id:"bridge",   x: this.bridge.x + 40, y: this.bridge.y - 10, text:"Creek Bridge", hint:"Cross" },
      { id:"culdesac", x: 2360, y: 980,  text:"Cul-de-sac",      hint:"Quiet" },
      { id:"riverwalk",x: 520,  y: 1460, text:"Creekline Walk",  hint:"Drift" },
    ];

    // ========= Dressings =========
    addParkDressingsV2((p)=>this.props.push(p), rng, park);
    addStreetDressings((p)=>this.props.push(p), rng, this.roads, this.districts);

    // Creekline reeds/rocks (kept close to bank)
    for (let i=0;i<34;i++){
      const x = 80 + i*72 + (rng()*26-13);
      const y = this.river.y - 8 + (rng()*18-9);
      this.props.push({ type:"reed", x, y, s: 0.8+rng()*0.6, baseY: y+2 });
    }
    for (let i=0;i<10;i++){
      const x = 140 + i*230 + (rng()*40-20);
      const y = this.river.y - 10 + (rng()*12-6);
      this.props.push({ type:"rock", x, y, s: 0.9+rng()*0.6, baseY: y+2 });
    }
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
    // ========= Backdrop =========
    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    ctx.save();
    const cx = Math.round(cam.x);
    const cy = Math.round(cam.y);
    ctx.translate(-cx, -cy);

    // Ground base
    drawGroundV2(ctx, 0, 0, this.w, this.h);

    // District underlays (subtle tints to separate areas)
    for (const d of this.districts) drawDistrictWash(ctx, d);

    // Roads (sidewalk first, then asphalt, then markings)
    drawRoadsV2(ctx, this.roads);

    // Park
    const park = this.districts.find(d=>d.id==="park");
    drawParkV2(ctx, park);

    // Creek (water + banks)
    drawCreek(ctx, 0, this.river.y, this.w, this.river.h, this.river);

    // Bridge
    drawBridgeV2(ctx, this.bridge.x, this.bridge.y, this.bridge.w, this.bridge.h);

    // Plaza raised stage + stairs
    drawRaised(ctx, this.raised.x, this.raised.y, this.raised.w, this.raised.h);
    for (const s of this.stairs) drawStairs(ctx, s.x, s.y, s.w, s.h);

    // Yards (lawns + details)
    for (const y of this.yards) drawYardLawnV2(ctx, y);
    for (const y of this.yards) drawYardDetailsV2(ctx, y);

    // Buildings
    for (const b of this.buildings){
      if (b.kind === "house")  drawHouseBlockV2(ctx, b);
      if (b.kind === "market") drawMarketBlockV2(ctx, b);
      if (b.kind === "studio") drawStudioBlockV2(ctx, b);
      if (b.kind === "plaza")  drawPlazaBlock(ctx, b);
    }

    // Labels (soft, not loud)
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(0,0,0,.45)";
    for (const lm of this.landmarks) ctx.fillText(lm.text, lm.x, lm.y);

    // Props (depth sort by baseY)
    const propsSorted = [...this.props].sort((a,b)=>(a.baseY||a.y)-(b.baseY||b.y));
    for (const pr of propsSorted){
      if (pr.type === "tree"){
        drawTree(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "rock"){
        drawRock(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "bush"){
        drawBush(ctx, pr.x, pr.y, pr.s);
      } else if (pr.type === "flower"){
        drawFlower(ctx, pr.x, pr.y, pr.s, pr.c || 0);
      } else if (pr.type === "bench"){
        drawBench(ctx, pr.x, pr.y, pr.s || 1);
      } else if (pr.type === "lamp"){
        drawLamp(ctx, pr.x, pr.y, pr.s || 1);
      } else if (pr.type === "mailbox"){
        drawMailbox(ctx, pr.x, pr.y, pr.s || 1);
      } else if (pr.type === "reed"){
        drawReed(ctx, pr.x, pr.y, pr.s || 1);
      } else if (pr.type === "cone"){
        drawCone(ctx, pr.x, pr.y, pr.s || 1);
      } else if (pr.type === "sign"){
        drawStreetSign(ctx, pr.x, pr.y, pr.s || 1, pr.t || "");
      }
    }

    ctx.restore();
  }

  drawAbove(){ /* intentionally empty */ }
}

/* ===================== Layout + Generation ===================== */

function buildDistrictRoads(W, H, bridge, districts, rng){
  const asphalt = [];
  const sidewalk = [];
  const marks = [];
  const driveways = [];
  const crossings = [];

  // Helper to add a "street" with curb
  const addStreet = (x,y,w,h, r=18) => {
    sidewalk.push({ x: x-14, y: y-14, w: w+28, h: h+28, r: r+10 });
    asphalt.push ({ x, y, w, h, r });
  };

  // MAIN SPINE: west <-> east (suburbs)
  addStreet(120, 800, 2360, 160, 26);

  // NORTH CONNECTOR: plaza to park to suburbs
  addStreet(860, 300, 170, 780, 26);

  // PARK LOOP ROAD (soft)
  const park = districts.find(d=>d.id==="park");
  addStreet(park.x+70, park.y+84, park.w-140, park.h-170, 36);

  // WEST MARKET STREET (vertical)
  addStreet(310, 420, 150, 620, 22);

  // EAST STRIP (studio street)
  addStreet(2060, 560, 170, 620, 22);

  // SOUTH ACCESS to bridge/creek
  addStreet(1350, 1040, 170, 360, 22);

  // Bridge approach
  addStreet(bridge.x-260, bridge.y+12, bridge.w+520, 112, 24);

  // Cul-de-sac bulb
  sidewalk.push({ x: 2220, y: 900, w: 380, h: 300, r: 120 });
  asphalt.push ({ x: 2236, y: 916, w: 348, h: 268, r: 112 });

  // Markings (dashes)
  for (let i=0;i<30;i++) marks.push({ x: 180 + i*74, y: 880, w: 34, h: 4 });
  for (let i=0;i<12;i++) marks.push({ x: 930, y: 360 + i*64, w: 4, h: 30 });
  for (let i=0;i<10;i++) marks.push({ x: 360, y: 470 + i*62, w: 4, h: 28 });
  for (let i=0;i<10;i++) marks.push({ x: 2115, y: 610 + i*62, w: 4, h: 28 });

  // Crossings (zebra)
  crossings.push({ x: 840, y: 820, w: 240, h: 120 });
  crossings.push({ x: 270, y: 740, w: 220, h: 120 });
  crossings.push({ x: 2000, y: 740, w: 220, h: 120 });
  crossings.push({ x: bridge.x + 26, y: bridge.y + 20, w: bridge.w - 52, h: bridge.h - 40 });

  return { asphalt, sidewalk, marks, driveways, crossings };
}

function buildLotsV2({ rng, W, H, districts, river, bridge, roads, addBuilding, addYard, addProp, addDriveway }){
  const park = districts.find(d=>d.id==="park");
  const plaza = districts.find(d=>d.id==="plaza");

  // ========= Plaza block =========
  addBuilding({ kind:"plaza", x: plaza.x+120, y: plaza.y+110, w: 560, h: 260 });

  // ========= Market corner (west) =========
  addBuilding({ kind:"market", x: 230, y: 460, w: 300, h: 190 });

  // ========= Studio strip (east) =========
  addBuilding({ kind:"studio", x: 1920, y: 620, w: 360, h: 210 });

  // ========= Cottage row (west suburbs) =========
  // Planned lots facing the main spine.
  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 120, y0: 620, count: 5, lotW: 260, lotH: 220, gap: 18,
    faceDown: true, streetY: 800, flavor:"cottage"
  });

  // ========= Suburb blocks (center + east) =========
  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 520, y0: 620, count: 7, lotW: 250, lotH: 220, gap: 18,
    faceDown: true, streetY: 800, flavor:"suburb"
  });

  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 520, y0: 980, count: 7, lotW: 250, lotH: 220, gap: 18,
    faceDown: false, streetY: 960, flavor:"suburb"
  });

  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 1400, y0: 620, count: 6, lotW: 255, lotH: 220, gap: 18,
    faceDown: true, streetY: 800, flavor:"suburb"
  });

  addHouseRow({
    rng, addBuilding, addYard, addProp, addDriveway,
    x0: 1400, y0: 980, count: 6, lotW: 255, lotH: 220, gap: 18,
    faceDown: false, streetY: 960, flavor:"suburb"
  });

  // ========= Cul-de-sac homes =========
  const cx = 2410, cy = 1030;
  for (let i=0;i<6;i++){
    const t = (-1.05 + i*0.42);
    const hx = cx + Math.cos(t)*190 - 92;
    const hy = cy + Math.sin(t)*115 - 60;
    addBuilding({
      kind:"house", x: Math.round(hx), y: Math.round(hy),
      w: 182, h: 120, accent: i%3, variant: (i+1)%3
    });
    // tiny front yard patches
    addYard({ x: Math.round(hx)-12, y: Math.round(hy)-10, w: 206, h: 154, style:"tight" });
  }

  // ========= Creekline promenade props =========
  // Lamps along the river walk (top bank)
  for (let i=0;i<10;i++){
    const x = 240 + i*220 + (rng()*30-15);
    const y = river.y - 28;
    addProp({ type:"lamp", x, y, s: 1, baseY: y+2 });
  }
  // Benches looking at the water
  for (let i=0;i<5;i++){
    const x = 360 + i*400;
    const y = river.y - 40;
    addProp({ type:"bench", x, y, s: 1, baseY: y+2 });
  }

  // ========= Park inner props (flowers/trees) =========
  // Trees ring + flower beds
  const ringN = 24;
  for (let i=0;i<ringN;i++){
    const t = i/ringN * Math.PI*2;
    const x = park.x + park.w*0.5 + Math.cos(t)* (park.w*0.42) + (rng()*34-17);
    const y = park.y + park.h*0.56 + Math.sin(t)* (park.h*0.32) + (rng()*34-17);
    addProp({ type:"tree", x, y, s: 1.0 + rng()*0.25, baseY: y+2 });
  }
  addFlowerPatch(addProp, rng, park.x+140, park.y+120);
  addFlowerPatch(addProp, rng, park.x+park.w-140, park.y+120);
  addFlowerPatch(addProp, rng, park.x+140, park.y+park.h-140);
  addFlowerPatch(addProp, rng, park.x+park.w-140, park.y+park.h-140);
}

function addHouseRow({ rng, addBuilding, addYard, addProp, addDriveway, x0, y0, count, lotW, lotH, gap, faceDown, streetY, flavor }){
  for (let i=0;i<count;i++){
    const lotX = x0 + i*(lotW+gap);
    const lotY = y0;

    const yard = { x: lotX+10, y: lotY+10, w: lotW-20, h: lotH-20, style: flavor };
    addYard(yard);

    const houseW = 168 + Math.floor(rng()*34);
    const houseH = 110 + Math.floor(rng()*22);
    const hx = lotX + (lotW-houseW)/2;

    const hy = faceDown ? (lotY + lotH - houseH - 28) : (lotY + 28);

    addBuilding({
      kind:"house",
      x: Math.round(hx), y: Math.round(hy),
      w: houseW, h: houseH,
      accent: (i + (faceDown?0:1)) % 3,
      variant: (i + Math.floor(rng()*3)) % 3,
      flavor
    });

    // Driveway connected to street band
    const dW = 58;
    const dH = 86 + Math.floor(rng()*26);
    const dX = lotX + 26 + Math.floor(rng()*42);
    const dY = faceDown ? (streetY + 10) : (streetY - dH - 10);

    yard.drive = { x:dX, y:dY, w:dW, h:dH };
    addDriveway({ x:dX, y:dY, w:dW, h:dH, r: 10 });

    // Walkway from house to driveway
    const walkH = 52;
    const walkY = faceDown ? (hy - walkH) : (hy + houseH);
    yard.walk = { x: hx + houseW*0.5 - 8, y: walkY, w: 16, h: walkH };

    // Mailbox near driveway
    const mbY = faceDown ? (streetY + 18) : (streetY - 18);
    addProp({ type:"mailbox", x: dX + dW + 10, y: mbY, s: 1, baseY: mbY+2 });

    // Lamp every other lot (clean spacing)
    if ((i % 2) === 0){
      const lampY = faceDown ? (streetY + 86) : (streetY + 56);
      addProp({ type:"lamp", x: lotX + lotW/2, y: lampY, s: 1, baseY: lampY+2 });
    }

    // Yard bushes and a tree or two
    const bushes = 2 + Math.floor(rng()*3);
    for (let k=0;k<bushes;k++){
      const bx = yard.x + 26 + k*(yard.w/(bushes+1));
      const by = yard.y + 26 + rng()*10;
      addProp({ type:"bush", x: bx, y: by, s: 0.70 + rng()*0.34, baseY: by+2 });
    }

    if (rng() < 0.65) addFlowerPatch(addProp, rng, yard.x + yard.w*0.55, yard.y + yard.h*0.58);
    if (rng() < 0.80) addProp({ type:"tree", x: yard.x + 32 + rng()*46, y: yard.y + yard.h - 16, s: 0.95 + rng()*0.25, baseY: yard.y + yard.h });
    if (rng() < 0.40) addProp({ type:"tree", x: yard.x + yard.w - (32 + rng()*46), y: yard.y + yard.h - 16, s: 0.90 + rng()*0.25, baseY: yard.y + yard.h });
  }
}

/* ===================== Drawing (World) ===================== */

function drawDistrictWash(ctx, d){
  // Very subtle overlays to separate districts
  const map = {
    plaza:   "rgba(138,46,255,.03)",
    park:    "rgba(255,255,255,.02)",
    suburbs: "rgba(0,0,0,.02)",
    river:   "rgba(29,107,102,.02)",
  };
  ctx.fillStyle = map[d.id] || "rgba(255,255,255,.01)";
  roundRect(ctx, d.x, d.y, d.w, d.h, 28, true);
}

function drawGroundV2(ctx, x, y, w, h){
  ctx.fillStyle = "#556b33";
  ctx.fillRect(x, y, w, h);

  // Stable micro-noise
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0; i<6400; i++){
    const px = (i*37) % w;
    const py = (i*91) % h;
    if ((i % 2) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Warm flecks
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#d9c18b";
  for (let i=0; i<1700; i++){
    const px = (i*53) % w;
    const py = (i*131) % h;
    if ((i % 7) === 0) ctx.fillRect(x + px, y + py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Worn ovals (foot traffic)
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#6f8440";
  for (let i=0; i<54; i++){
    const px = x + ((i*173) % w);
    const py = y + ((i*269) % h);
    ctx.beginPath();
    ctx.ellipse(px, py, 74, 48, 0.10, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRoadsV2(ctx, roads){
  // Sidewalks
  for (const s of roads.sidewalk){
    ctx.fillStyle = "#c3bdaa";
    roundRect(ctx, s.x, s.y, s.w, s.h, s.r || 14, true);

    // expansion joints
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#000";
    for (let i=0;i<10;i++){
      ctx.fillRect(s.x + 10 + i*(s.w/10), s.y + 6, 1, s.h-12);
    }
    ctx.globalAlpha = 1;
  }

  // Asphalt
  for (const r of roads.asphalt){
    ctx.fillStyle = "#24242c";
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r || 18, true);

    // asphalt speckle
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    for (let i=0; i<1100; i++){
      const px = r.x + ((i*29) % r.w);
      const py = r.y + ((i*71) % r.h);
      if ((i % 3) === 0) ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalAlpha = 1;

    // edge shadow
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 7;
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r || 18, false);
    ctx.globalAlpha = 1;

    // soft center sheen
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#fff";
    roundRect(ctx, r.x+10, r.y+10, r.w-20, 10, 8, true);
    ctx.globalAlpha = 1;
  }

  // Lane marks
  ctx.globalAlpha = 0.33;
  ctx.fillStyle = "#efe8d6";
  for (const m of roads.marks) ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.globalAlpha = 1;

  // Crossings
  for (const c of roads.crossings){
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(239,232,214,.9)";
    for (let i=0;i<8;i++){
      const xx = c.x + 10 + i*((c.w-20)/8);
      ctx.fillRect(xx, c.y+10, 10, c.h-20);
    }
    ctx.globalAlpha = 1;
  }

  // Driveways
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#a9a293";
  for (const d of roads.driveways){
    roundRect(ctx, d.x, d.y, d.w, d.h, d.r || 10, true);
  }
  ctx.globalAlpha = 1;
}

function drawParkV2(ctx, p){
  // park grass
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#4f6f39";
  roundRect(ctx, p.x, p.y, p.w, p.h, 40, true);

  // inner meadow
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#4a6a35";
  roundRect(ctx, p.x+70, p.y+84, p.w-140, p.h-168, 34, true);

  // pond
  const pond = { x: p.x + p.w*0.52 - 130, y: p.y + p.h*0.55 - 30, w: 260, h: 130 };
  drawWaterStatic(ctx, pond.x, pond.y, pond.w, pond.h);

  // playground pad
  ctx.globalAlpha = 0.90;
  ctx.fillStyle = "#b28f5d";
  roundRect(ctx, p.x+p.w*0.70, p.y+p.h*0.42, 200, 130, 18, true);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000";
  roundRect(ctx, p.x+p.w*0.70+10, p.y+p.h*0.42+10, 180, 110, 14, true);
  ctx.globalAlpha = 1;

  // swing set silhouette
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#2b241f";
  const sx = p.x+p.w*0.74, sy = p.y+p.h*0.42+30;
  ctx.fillRect(sx, sy, 6, 76);
  ctx.fillRect(sx+90, sy, 6, 76);
  ctx.fillRect(sx, sy, 96, 6);
  ctx.globalAlpha = 1;
}

function drawCreek(ctx, x, y, w, h, river){
  // banks
  ctx.fillStyle = "#3b2a1a";
  ctx.fillRect(x, y-18, w, 18);
  ctx.fillRect(x, y+h, w, 14);

  // water body
  ctx.fillStyle = "#1d6b66";
  ctx.fillRect(x, y, w, h);

  // diagonal ripple vibe (still cheap)
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#2a7c76";
  for (let i=0; i<190; i++){
    const px = x + ((i*97) % w);
    const py = y + 20 + ((i*43) % Math.max(1,(h-40)));
    ctx.fillRect(px, py, 76, 2);
  }
  ctx.globalAlpha = 1;

  // highlights near top bank
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#fff";
  for (let i=0; i<130; i++){
    const px = x + ((i*123) % w);
    const py = y + 10 + ((i*19) % 16);
    ctx.beginPath();
    ctx.ellipse(px, py, 14, 4, 0.10, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBridgeV2(ctx, x,y,w,h){
  ctx.fillStyle = "#5e4128";
  roundRect(ctx, x, y, w, h, 12, true);

  // planks
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  for (let i=0; i<14; i++){
    ctx.fillRect(x+12+i*(w/14), y+10, 2, h-20);
  }
  ctx.globalAlpha = 1;

  // rails
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(x+12, y+10, w-24, 4);
  ctx.fillRect(x+12, y+h-14, w-24, 4);

  // crossing stripes (already drawn by crossings, but a tiny edge helps)
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.lineWidth = 6;
  roundRect(ctx, x, y, w, h, 12, false);
  ctx.globalAlpha = 1;
}

/* ===================== Buildings + Yards ===================== */

function drawYardLawnV2(ctx, y){
  const style = y.style || "suburb";
  const grass = (style === "cottage") ? "#5a7b3f" : (style === "tight" ? "#527238" : "#56753a");

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = grass;
  roundRect(ctx, y.x, y.y, y.w, y.h, 18, true);

  // lawn grain
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0;i<260;i++){
    const px = y.x + ((i*19) % y.w);
    const py = y.y + ((i*41) % y.h);
    if (i % 4 === 0) ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawYardDetailsV2(ctx, y){
  // driveway
  if (y.drive){
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#a8a294";
    roundRect(ctx, y.drive.x, y.drive.y, y.drive.w, y.drive.h, 10, true);
    ctx.globalAlpha = 1;
  }

  // walkway
  if (y.walk){
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "#d3c8b5";
    roundRect(ctx, y.walk.x, y.walk.y, y.walk.w, y.walk.h, 8, true);
    ctx.globalAlpha = 1;
  }

  // back fence
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  roundRect(ctx, y.x+10, y.y+y.h-18, y.w-20, 8, 6, true);
  ctx.globalAlpha = 1;
}

function drawHouseBlockV2(ctx, b){
  const { x,y,w,h, accent=0, variant=0, flavor="suburb" } = b;

  // base
  const base = (flavor === "cottage") ? "#c6b08a" : "#c3ad84";
  ctx.fillStyle = base;
  roundRect(ctx, x, y, w, h, 14, true);

  // stucco grain
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  for (let i=0; i<900; i++){
    const px = x + ((i*23) % w);
    const py = y + ((i*67) % h);
    if ((i % 4) === 0) ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // roof band
  ctx.fillStyle = "rgba(0,0,0,.18)";
  const roofH = (variant === 2) ? 24 : 20;
  roundRect(ctx, x+8, y+8, w-16, roofH, 10, true);

  // windows (layouts)
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#16161d";
  if (variant === 0){
    for (let i=0; i<6; i++){
      const wx = x + 26 + (i%3)*(w/3);
      const wy = y + 44 + Math.floor(i/3)*52;
      roundRect(ctx, wx, wy, 38, 28, 6, true);
    }
  } else if (variant === 1){
    for (let i=0; i<4; i++){
      const wx = x + 30 + (i%2)*(w*0.52);
      const wy = y + 46 + Math.floor(i/2)*62;
      roundRect(ctx, wx, wy, 44, 30, 8, true);
    }
    roundRect(ctx, x+w*0.5-20, y+46, 40, 30, 8, true);
  } else {
    for (let i=0; i<5; i++){
      const wx = x + 24 + (i%3)*(w/3);
      const wy = y + 46 + Math.floor(i/3)*60;
      roundRect(ctx, wx, wy, 36, 26, 6, true);
    }
  }
  ctx.globalAlpha = 1;

  // door
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#1a1412";
  roundRect(ctx, x+w*0.5-14, y+h-44, 28, 34, 6, true);
  ctx.globalAlpha = 1;

  // porch shadow
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  roundRect(ctx, x+w*0.5-22, y+h-10, 44, 6, 4, true);
  ctx.globalAlpha = 1;

  // grime base
  ctx.globalAlpha = 0.18;
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

function drawMarketBlockV2(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#b9b2a2";
  roundRect(ctx, x, y, w, h, 16, true);

  // awning
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(138,46,255,.20)";
  roundRect(ctx, x+10, y+44, w-20, 28, 10, true);
  ctx.globalAlpha = 1;

  // windows
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#111118";
  roundRect(ctx, x+22, y+82, w-44, h-116, 10, true);
  ctx.globalAlpha = 1;

  // sign
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  roundRect(ctx, x+20, y+14, w-40, 22, 10, true);
  ctx.globalAlpha = 1;
}

function drawStudioBlockV2(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#cbbd9c";
  roundRect(ctx, x, y, w, h, 18, true);

  // vertical ribs
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

  // violet band
  ctx.fillStyle = "rgba(138,46,255,.08)";
  ctx.fillRect(x, y+10, w, 8);
}

function drawPlazaBlock(ctx, b){
  const { x,y,w,h } = b;
  ctx.fillStyle = "#b9b0a1";
  roundRect(ctx, x, y, w, h, 22, true);

  // inner courtyard
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  roundRect(ctx, x+32, y+36, w-64, h-72, 18, true);
  ctx.globalAlpha = 1;

  // pillars
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#fff";
  for (let i=0;i<10;i++){
    ctx.fillRect(x+40 + i*((w-80)/10), y+26, 2, h-52);
  }
  ctx.globalAlpha = 1;

  // emblem strip
  ctx.fillStyle = "rgba(138,46,255,.10)";
  roundRect(ctx, x+22, y+16, w-44, 16, 10, true);
}

/* ===================== Props ===================== */

function addParkDressingsV2(add, rng, p){
  // benches
  add({ type:"bench", x: p.x+p.w*0.38, y: p.y+p.h*0.56, s: 1, baseY: p.y+p.h*0.56+2 });
  add({ type:"bench", x: p.x+p.w*0.62, y: p.y+p.h*0.48, s: 1, baseY: p.y+p.h*0.48+2 });

  // lamps at park edges
  add({ type:"lamp", x: p.x+50,     y: p.y+p.h-40, s: 1, baseY: p.y+p.h-38 });
  add({ type:"lamp", x: p.x+p.w-50, y: p.y+p.h-40, s: 1, baseY: p.y+p.h-38 });

  // extra trees near corners
  add({ type:"tree", x: p.x+90, y: p.y+90, s: 1.1, baseY: p.y+92 });
  add({ type:"tree", x: p.x+p.w-90, y: p.y+90, s: 1.05, baseY: p.y+92 });
}

function addStreetDressings(add, rng, roads, districts){
  // A few cones + street signs for "alive" city vibes
  const cones = [
    { x: 900, y: 910 }, { x: 940, y: 910 }, { x: 980, y: 910 },
    { x: 2120, y: 820 }, { x: 2160, y: 820 },
  ];
  for (const c of cones) add({ type:"cone", x:c.x, y:c.y, s: 1, baseY: c.y+2 });

  add({ type:"sign", x: 860, y: 790, s: 1, baseY: 792, t:"PLAZA" });
  add({ type:"sign", x: 310, y: 430, s: 1, baseY: 432, t:"MARKET" });
  add({ type:"sign", x: 2060, y: 570, s: 1, baseY: 572, t:"STUDIO" });
}

/* --- Prop draw helpers --- */

function drawTree(ctx, x, y, s){
  // trunk
  const trunkW = 12*s, trunkH = 34*s;
  ctx.fillStyle = "#563721";
  roundRect(ctx, x - trunkW/2, y - trunkH, trunkW, trunkH, 8*s, true);

  // canopy blobs
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

  // shadow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 14*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRock(ctx, x,y,s){
  ctx.fillStyle = "#706a5c";
  blob(ctx, x, y, 22*s, 14*s, 0.06);

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 23*s, 15*s, 0.06, 0, Math.PI*2);
  ctx.stroke();
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

function drawLamp(ctx, x, y, s){
  const poleH = 52*s;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#2a2523";
  roundRect(ctx, x-3*s, y-poleH, 6*s, poleH, 4*s, true);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#3b3330";
  roundRect(ctx, x-10*s, y-poleH-8*s, 20*s, 10*s, 6*s, true);

  // glow
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x, y-poleH+12*s, 22*s, 14*s, 0, 0, Math.PI*2);
  ctx.fill();
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

function drawReed(ctx, x, y, s){
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#3b5a2a";
  for (let i=0;i<4;i++){
    const dx = (i*3 - 4)*s;
    ctx.fillRect(x+dx, y-18*s, 2*s, 18*s);
  }
  ctx.globalAlpha = 1;
}

function drawCone(ctx, x, y, s){
  // little traffic cone
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#d56b2a";
  ctx.beginPath();
  ctx.moveTo(x, y-18*s);
  ctx.lineTo(x-8*s, y);
  ctx.lineTo(x+8*s, y);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x-6*s, y-8*s, 12*s, 2*s);
  ctx.globalAlpha = 1;
}

function drawStreetSign(ctx, x, y, s, t){
  // pole
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#2a2523";
  roundRect(ctx, x-2*s, y-28*s, 4*s, 28*s, 3*s, true);

  // plate
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(138,46,255,.18)";
  roundRect(ctx, x-22*s, y-42*s, 44*s, 12*s, 6*s, true);

  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#fff";
  ctx.font = `${10*s}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
  ctx.fillText(t, x-18*s, y-33*s);
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

/* ===================== Shared blocks (kept from v1 style) ===================== */

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

function drawWaterStatic(ctx, x,y,w,h){
  ctx.fillStyle = "#1d6b66";
  ctx.fillRect(x,y,w,h);

  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#2a7c76";
  for (let i=0; i<120; i++){
    const px = x + ((i*97) % w);
    const py = y + 20 + ((i*43) % Math.max(1,(h-40)));
    ctx.fillRect(px, py, 80, 2);
  }
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#fff";
  for (let i=0; i<90; i++){
    const px = x + ((i*123) % w);
    const py = y + 10 + ((i*19) % 16);
    ctx.beginPath();
    ctx.ellipse(px, py, 14, 4, 0.10, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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
