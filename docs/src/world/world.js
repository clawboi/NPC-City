// NPC City — World v5 (Apartments split 6 units + manager bottom)
// Director Mode: geometry is intentional, no mass prop spam.

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

export class World{
  constructor(){
    this.w = 2400;
    this.h = 1400;

    this.spawns = { actor:{ x:1200, y:700, area:"Crossroads" }, thug:{ x:1180,y:720, area:"Crossroads" }, police:{ x:1220,y:720, area:"Crossroads" } };

    this.buildings = [];
    this.solids = [];
    this.doors = [];
    this.landmarks = [];
    this.trees = [];

    // ROADS (border ring)
    const roadW = 200;
    this.roads = [
      {x:0,y:0,w:this.w,h:roadW},
      {x:0,y:this.h-roadW,w:this.w,h:roadW},
      {x:0,y:0,w:roadW,h:this.h},
      {x:this.w-roadW,y:0,w:roadW,h:this.h},
    ];

    // PARK (center)
    this.park = { x:840, y:440, w:720, h:520 };

    // ===== BUILDINGS =====
    // Top apartments (3 units, doors on SOUTH edge)
    this.topApts = { x:820, y:220, w:760, h:170, name:"Top Apartments" };
    this._addBlockWithDoors(this.topApts, "south", [
      { homeId:3, label:"Apt 4" },
      { homeId:4, label:"Apt 5" },
      { homeId:5, label:"Apt 6" },
    ]);

    // Left apartments (3 units, doors on EAST edge)
    this.leftApts = { x:420, y:440, w:300, h:520, name:"Left Apartments" };
    this._addBlockWithDoors(this.leftApts, "east", [
      { homeId:0, label:"Apt 1" },
      { homeId:1, label:"Apt 2" },
      { homeId:2, label:"Apt 3" },
    ]);

    // Manager building (BOTTOM, centered)
    this.manager = { x:this.w/2-90, y:1100, w:180, h:110, name:"Management" };
    this._addBlockWithDoors(this.manager, "north", [{ target:"management", label:"Management" }]);

    // mailbox/payphone box
    this.box = {x:240,y:1080,w:60,h:60};
    this.solids.push(this.box);

    // AMENITIES
    this.pool   = {x:1700,y:460,w:420,h:220};
    this.tennis = {x:1700,y:740,w:420,h:260};

    // fence around amenities (keeps them contained but accessible)
    this.fence = {x:1680,y:440,w:460,h:580};
    this.solids.push(
      {x:this.fence.x,y:this.fence.y,w:this.fence.w,h:10},
      {x:this.fence.x,y:this.fence.y+this.fence.h-10,w:this.fence.w,h:10},
      {x:this.fence.x,y:this.fence.y,w:10,h:this.fence.h},
      {x:this.fence.x+this.fence.w-10,y:this.fence.y,w:10,h:this.fence.h}
    );

    // ===== HOMES (ownership + NPC routines) =====
    // We treat each apartment door as a purchasable home unit.
    this.homes = [];
    for (const d of this.doors){
      if (typeof d.homeId === "number"){
        this.homes.push({
          id: d.homeId,
          label: d.label || ("Apt " + (d.homeId+1)),
          price: 220 + d.homeId*40, // simple tiered pricing
          door: d
        });
      }
    }
    // Keep deterministic ordering
    this.homes.sort((a,b)=>a.id-b.id);

    // ===== LANDMARKS (for E-interact prompts) =====
    this._buildLandmarks();
  }

  // Adds a single building collision + one or more doors.
  _addBlockWithDoors(rect, doorSide, doorSpecs){
    const {x,y,w,h} = rect;
    const b={x,y,w,h,type:"building"};
    this.buildings.push(b);

    // collision margin (feels less sticky)
    this.solids.push({x:x+10,y:y+10,w:w-20,h:h-20});

    // compute door anchors
    const mkDoor = (t) => {
      let dx=x+w/2-18;
      let dy=y+h-18;

      if(doorSide==="north") dy=y-18;
      if(doorSide==="south") dy=y+h-6;
      if(doorSide==="east"){ dx=x+w-6; dy=y+h/2-18; }
      if(doorSide==="west"){ dx=x-18; dy=y+h/2-18; }

      const door = {x:dx,y:dy,w:36,h:36,target:(t.target||"apt"), homeId:t.homeId, label:t.label};
      this.doors.push(door);
      return door;
    };

    if (!doorSpecs || !doorSpecs.length){
      mkDoor({ target:"building", label:"Door" });
      return;
    }

    if (doorSpecs.length === 1){
      // Single door: center
      mkDoor(doorSpecs[0]);
      return;
    }

    // Multiple doors: evenly distribute along the relevant edge
    for (let i=0; i<doorSpecs.length; i++){
      const spec = doorSpecs[i];
      const door = mkDoor(spec);

      // shift per-door placement
      const t = (i+1)/(doorSpecs.length+1); // 0..1
      if (doorSide==="south" || doorSide==="north"){
        door.x = x + t*w - door.w/2;
      } else {
        door.y = y + t*h - door.h/2;
      }
    }
  }

  _buildLandmarks(){
    this.landmarks.length = 0;

    const parkPts = [
      { x:this.park.x+this.park.w*0.22, y:this.park.y+this.park.h*0.25 },
      { x:this.park.x+this.park.w*0.78, y:this.park.y+this.park.h*0.28 },
      { x:this.park.x+this.park.w*0.30, y:this.park.y+this.park.h*0.72 },
      { x:this.park.x+this.park.w*0.68, y:this.park.y+this.park.h*0.70 },
      { x:this.park.x+this.park.w*0.52, y:this.park.y+this.park.h*0.52 },
    ];

    // Core interactables
    this.landmarks.push(
      { id:"park",   x:parkPts[4].x, y:parkPts[4].y, text:"Park", hint:"Breathe / Flyers" },
      { id:"stage",  x:parkPts[0].x, y:parkPts[0].y, text:"Stage", hint:"Perform" },
      { id:"pool",   x:this.pool.x + this.pool.w*0.5, y:this.pool.y + this.pool.h*0.5, text:"Pool", hint:"Wash up" },
      { id:"tennis", x:this.tennis.x + this.tennis.w*0.5, y:this.tennis.y + this.tennis.h*0.5, text:"Tennis Court", hint:"Workout" },
      { id:"box",    x:this.box.x + this.box.w*0.5, y:this.box.y + this.box.h*0.5, text:"Mailbox / Payphone", hint:"Messages" },
    );

    // Management door landmark
    const mgmt = this.doors.find(d=>d.target==="management");
    if (mgmt){
      this.mgmtDoor = mgmt;
      this.landmarks.push({ id:"vault", x:mgmt.x+mgmt.w*0.5, y:mgmt.y+mgmt.h*0.5, text:"Management", hint:"Vault / Office" });
    } else {
      this.mgmtDoor = null;
    }

    // Apartment door landmarks (6)
    for (const home of this.homes){
      const d = home.door;
      this.landmarks.push({
        id:"apt",
        homeId: home.id,
        x: d.x + d.w*0.5,
        y: d.y + d.h*0.5,
        text: home.label,
        hint:"Home"
      });
    }

    // POI points for NPC routing (used by npc.js)
    this.poiPoints = {
      park: parkPts,
      pool: [
        { x:this.pool.x+this.pool.w*0.35, y:this.pool.y+this.pool.h*0.55 },
        { x:this.pool.x+this.pool.w*0.65, y:this.pool.y+this.pool.h*0.55 },
        { x:this.pool.x+this.pool.w*0.50, y:this.pool.y+this.pool.h*0.25 },
      ],
      tennis: [
        { x:this.tennis.x+this.tennis.w*0.30, y:this.tennis.y+this.tennis.h*0.35 },
        { x:this.tennis.x+this.tennis.w*0.70, y:this.tennis.y+this.tennis.h*0.35 },
        { x:this.tennis.x+this.tennis.w*0.50, y:this.tennis.y+this.tennis.h*0.70 },
      ],
      box: [
        { x:this.box.x+this.box.w*0.5, y:this.box.y+this.box.h*0.5 },
        { x:this.box.x+this.box.w*0.5 + 36, y:this.box.y+this.box.h*0.5 + 6 },
      ],
      stage: [
        { x:this.park.x+this.park.w*0.22, y:this.park.y+this.park.h*0.25 },
        { x:this.park.x+this.park.w*0.78, y:this.park.y+this.park.h*0.28 },
      ],
      homes: this.homes.map(h=>({ x:h.door.x+h.door.w*0.5, y:h.door.y+h.door.h*0.5, homeId:h.id })),
      mgmt: mgmt ? [{ x:mgmt.x+mgmt.w*0.5, y:mgmt.y+mgmt.h*0.5 }] : []
    };
  }

  hitsSolid(r){
    for(const s of this.solids){
      if(r.x<s.x+s.w && r.x+r.w>s.x && r.y<s.y+s.h && r.y+r.h>s.y) return true;
    }
    return false;
  }

  getSpawn(role="actor"){
    return this.spawns[role] || this.spawns.actor;
  }

  nearestLandmark(px,py,d=70){
    let best=null,bd=d*d;
    for(const l of this.landmarks){
      const dx=l.x-px, dy=l.y-py;
      const dd=dx*dx+dy*dy;
      if(dd<bd){ bd=dd; best=l; }
    }
    return best;
  }

  draw(ctx, camera){
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);

    // base asphalt
    ctx.fillStyle = "#1a1a1f";
    ctx.fillRect(0,0,this.w,this.h);

    // road ring
    ctx.fillStyle = "#3d3d46";
    for(const r of this.roads) ctx.fillRect(r.x, r.y, r.w, r.h);

    // park
    ctx.fillStyle = "#1f5a35";
    ctx.fillRect(this.park.x, this.park.y, this.park.w, this.park.h);

    // pool area
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(this.fence.x, this.fence.y, this.fence.w, this.fence.h);

    // pool water
    ctx.fillStyle = "#2b6cff";
    ctx.fillRect(this.pool.x+10, this.pool.y+10, this.pool.w-20, this.pool.h-20);

    // tennis court
    ctx.fillStyle = "#1f8a44";
    ctx.fillRect(this.tennis.x+10, this.tennis.y+10, this.tennis.w-20, this.tennis.h-20);
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.strokeRect(this.tennis.x+20, this.tennis.y+20, this.tennis.w-40, this.tennis.h-40);

    // buildings
    for(const b of this.buildings){
      ctx.fillStyle = (b === this.manager) ? "#2b2b33" : "#2a2a31";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "rgba(255,255,255,.06)";
      ctx.fillRect(b.x+8, b.y+8, b.w-16, b.h-16);
    }

    // doors
    for(const d of this.doors){
      ctx.fillStyle = (d.target === "management") ? "#8a2eff" : "rgba(255,255,255,.14)";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(d.x+6, d.y+6, d.w-12, d.h-12);
    }

    // box
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(this.box.x, this.box.y, this.box.w, this.box.h);
  }
}
