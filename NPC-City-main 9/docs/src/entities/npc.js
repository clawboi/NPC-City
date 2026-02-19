// src/entities/npc.js
// Tiny NPC system (V2 foundation): walkers + talk prompts + simple gigs

export class NPCSystem {
  constructor(world){
    this.world = world;
    this.list = [];
    this._seed = 1337;
  }

  seed(n){ this._seed = n|0; }

  spawnActorDistrict(){
    this.list.length = 0;

    // Keep it small and readable. We can scale counts later.
    const names = [
      { name:"Mira",  role:"citizen" },
      { name:"Jules", role:"citizen" },
      { name:"Noah",  role:"citizen" },
      { name:"Ivy",   role:"citizen" },
      { name:"Tess",  role:"citizen" },
      { name:"Rio",   role:"citizen" },
      { name:"Sage",  role:"citizen" },
      { name:"Kato",  role:"citizen" },
      { name:"Cass",  role:"agent"   }, // casting agent for gigs
    ];

    // Spawn inside Midtown / Studio Row area
    const base = [
      { x: 1120, y: 560 },
      { x: 980,  y: 640 },
      { x: 1300, y: 610 },
      { x: 760,  y: 620 },
      { x: 860,  y: 520 },
      { x: 1460, y: 540 },
      { x: 1540, y: 700 },
      { x: 1180, y: 420 },
      { x: 1180, y: 520 }, // near the stage (agent)
    ];

    for (let i=0; i<names.length; i++){
      const b = base[i] || { x: 1100, y: 600 };
      const c = palette(i);
      this.list.push({
        id: `npc_${i}`,
        name: names[i].name,
        kind: names[i].role,
        x: b.x + (rand(this)*40-20),
        y: b.y + (rand(this)*40-20),
        w: 18,
        h: 18,
        vx: 0,
        vy: 0,
        faceX: 0,
        faceY: 1,
        t: rand(this)*10,
        wanderT: 0,
        // blink timers (prevents NaN)
        blinkT: 0,
        blinkNext: 1.2 + rand(this)*2.6,
        talkSeed: (i*17+9)|0,
        col: c,
      });
    }
  }

  update(dt){
    const solidsHit = (rect) => this.world?.hitsSolid ? this.world.hitsSolid(rect) : false;
    for (let i=0; i<this.list.length; i++){
      const n = this.list[i];
      n.t += dt;

      // blink
      n.blinkNext -= dt;
      if (n.blinkNext <= 0){
        n.blinkT = 0.12;
        n.blinkNext = 1.4 + rand(this)*3.2;
      }
      if (n.blinkT > 0) n.blinkT = Math.max(0, n.blinkT - dt);

      // Simple wander AI: pick a direction, walk a bit, pause a bit.
      n.wanderT -= dt;
      if (n.wanderT <= 0){
        const mode = rand(this) < 0.25 ? "pause" : "walk";
        if (mode === "pause"){
          n.vx = 0; n.vy = 0;
          n.wanderT = 0.55 + rand(this)*0.85;
        } else {
          const ang = rand(this) * Math.PI * 2;
          const spd = 26 + rand(this)*22;
          n.vx = Math.cos(ang) * spd;
          n.vy = Math.sin(ang) * spd;
          n.wanderT = 0.9 + rand(this)*1.6;
        }
      }

      // Nudge agent to stay near stage
      if (n.kind === "agent"){
        const ax = 1180, ay = 520;
        const dx = ax - n.x;
        const dy = ay - n.y;
        const d = Math.hypot(dx,dy);
        if (d > 140){
          n.vx = (dx/d) * 55;
          n.vy = (dy/d) * 55;
          n.wanderT = 0.35;
        }
      }

      // Movement + basic collision bounce
      const nx = n.x + n.vx * dt;
      const ny = n.y + n.vy * dt;

      // axis collision like player (cheap)
      let tx = nx;
      let ty = n.y;
      if (!solidsHit({ x: tx, y: ty, w: n.w, h: n.h })){
        n.x = tx;
      } else {
        n.vx *= -0.6;
      }
      tx = n.x;
      ty = ny;
      if (!solidsHit({ x: tx, y: ty, w: n.w, h: n.h })){
        n.y = ty;
      } else {
        n.vy *= -0.6;
      }

      // Bounds
      n.x = clamp(n.x, 0, this.world.w - n.w);
      n.y = clamp(n.y, 0, this.world.h - n.h);

      // Facing
      if (Math.abs(n.vx) + Math.abs(n.vy) > 1){
        const ax2 = Math.abs(n.vx), ay2 = Math.abs(n.vy);
        if (ax2 > ay2){
          n.faceX = n.vx > 0 ? 1 : -1;
          n.faceY = 0;
        } else {
          n.faceX = 0;
          n.faceY = n.vy > 0 ? 1 : -1;
        }
      }
    }
  }

  draw(ctx, camera){
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    for (let i=0; i<this.list.length; i++){
      const n = this.list[i];

      // shadow
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(n.x + n.w/2, n.y + n.h + 3, 8, 3, 0, 0, Math.PI*2);
      ctx.fill();

      // body (tiny pixel person)
      drawNPCSprite(ctx, n);
    }
    ctx.restore();
  }

  nearest(px, py, r){
    let best = null;
    let bd = r;
    for (let i=0; i<this.list.length; i++){
      const n = this.list[i];
      const dx = (n.x + n.w/2) - px;
      const dy = (n.y + n.h/2) - py;
      const d = Math.hypot(dx,dy);
      if (d < bd){ bd = d; best = n; }
    }
    return best;
  }

  talkLines(npc){
    // Deterministic-ish lines per NPC
    const s = (npc.talkSeed|0) + (npc.kind === "agent" ? 77 : 0);
    const linesCitizen = [
      "Nice night for a walk.",
      "Rent's brutal out here.",
      "Studio Row got vibes.",
      "I heard the 8PM show gets tips.",
      "You look like you're grinding.",
    ];
    const linesAgent = [
      "You want stage time? Prove you're consistent.",
      "Flyers. Always flyers. Bring the city to the show.",
      "Network. Perform. Repeat.",
      "If you miss 8PM, people forget you.",
    ];
    const pick = (arr) => arr[Math.abs(hash(s + arr.length*13)) % arr.length];
    const a = npc.kind === "agent" ? linesAgent : linesCitizen;
    return [pick(a), pick(a.slice().reverse())];
  }
}

function drawNPCSprite(ctx, n){
  // IMPORTANT (Director Mode request): NPCs should LOOK the same size as the player.
  // Player sprite renders at a 16x20 grid with px=2 (32x40). We draw NPCs at that same visual scale,
  // while keeping their collision box (18x18) unchanged.

  const moving = (Math.abs(n.vx) + Math.abs(n.vy)) > 1;
  const bob = moving ? ((Math.sin(n.t*9) > 0) ? 1 : 0) : 0;
  const blinking = n.blinkT > 0;

  const skin = n.col.skin;
  const hair = n.col.hair;
  const top  = n.col.top;
  const bot  = n.col.bot;

  const px2 = 2;
  const SW = 16, SH = 20;
  const W = SW * px2, H = SH * px2;

  const cx = (n.x + n.w/2);
  const feetY = (n.y + n.h + 2);

  const sx = Math.round(cx - W/2);
  const sy = Math.round(feetY - H + bob);

  const P = (ix, iy, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(sx + ix*px2, sy + iy*px2, px2, px2);
  };

  // grounded shadow (similar scale to player)
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, feetY + 2, 12, 6, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // hair
  for (let x=5; x<=10; x++) P(x,0,hair);
  for (let x=4; x<=11; x++) P(x,1,hair);
  P(4,2,hair); P(11,2,hair);
  P(4,3,hair); P(11,3,hair);

  // face
  for (let y=2; y<=6; y++){
    for (let x=5; x<=10; x++){
      if (y===2 && (x===5 || x===10)) continue;
      P(x,y,skin);
    }
  }

  // eyes
  const ink = "rgba(15,15,22,0.85)";
  const white = "rgba(255,255,255,0.85)";
  if (blinking){
    P(7,4,ink);
    P(8,4,ink);
  } else {
    P(7,4,ink);
    P(9,4,ink);
    P(7,3,white);
    P(9,3,white);
  }

  // torso
  for (let y=7; y<=12; y++){
    for (let x=5; x<=10; x++) P(x,y,top);
  }

  // arms (simple)
  const armX = (n.faceX > 0) ? 11 : (n.faceX < 0 ? 4 : 0);
  if (armX){
    P(armX,8,skin); P(armX,9,skin); P(armX,10,skin);
  } else {
    P(4,8,skin); P(11,8,skin);
    P(4,9,skin); P(11,9,skin);
  }

  // legs
  for (let y=13; y<=17; y++){
    P(7,y,bot); P(8,y,bot);
    P(9,y,bot); P(10,y,bot);
  }
  // shoes
  const shoe = "rgba(15,15,22,0.9)";
  P(7,18,shoe); P(8,18,shoe);
  P(9,18,shoe); P(10,18,shoe);
}

function px(ctx,x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function rand(sys){
  // xorshift32
  let x = sys._seed|0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  sys._seed = x|0;
  return ((x >>> 0) / 4294967296);
}

function hash(n){
  let x = n|0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return x|0;
}

function palette(i){
  const skins = ["#f2c7a1", "#d8a77f", "#b9835a", "#8a5a3b"]; 
  const hairs = ["#121218", "#2a1b12", "#2b2b33", "#4b2a1a"]; 
  const tops  = ["rgba(138,46,255,.95)", "rgba(255,255,255,.75)", "rgba(0,255,156,.75)", "rgba(255,60,120,.75)"]; 
  const bots  = ["rgba(255,255,255,.22)", "rgba(255,255,255,.32)", "rgba(255,255,255,.18)"]; 
  return {
    skin: skins[i % skins.length],
    hair: hairs[(i*2) % hairs.length],
    top: tops[(i*3) % tops.length],
    bot: bots[(i*5) % bots.length]
  };
}
