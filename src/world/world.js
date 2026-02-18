
// NPC City — World v1 (clean expansion tweak)

export class World{
  constructor(){

    this.w = 2400;
    this.h = 1400;

    this.spawns = { actor:{ x:1200, y:700 } };

    this.buildings = [];
    this.solids = [];
    this.doors = [];
    this.landmarks = [];

    // ROADS (thicker now)
    this.roads = [
      {x:0,y:0,w:this.w,h:160},
      {x:0,y:this.h-160,w:this.w,h:160},
      {x:0,y:0,w:160,h:this.h},
      {x:this.w-160,y:0,w:160,h:this.h},
    ];

    // SMALLER PARK
    this.park = {
      x:820,
      y:420,
      w:760,
      h:560
    };

    // BIGGER BUILDINGS
    this.addBuilding(780,160,840,160,"south");
    this.addBuilding(780,1080,840,160,"north");
    this.addBuilding(560,420,180,560,"east");

    // EAST SIDE AMENITIES INSTEAD OF BUILDINGS
    this.pool = {x:1680,y:440,w:420,h:220};
    this.tennis = {x:1680,y:720,w:420,h:260};

    // PARKING LOT
    this.parking = {x:500,y:1120,w:1400,h:180};

    // MANAGEMENT BUILDING
    this.addBuilding(1100,1240,220,140,"north","management");

    // WORLD BOUNDS
    this.solids.push({x:-200,y:-200,w:this.w+400,h:200});
    this.solids.push({x:-200,y:this.h,w:this.w+400,h:200});
    this.solids.push({x:-200,y:-200,w:200,h:this.h+400});
    this.solids.push({x:this.w,y:-200,w:200,h:this.h+400});

    // LANDMARKS
    this.landmarks.push({
      x:this.park.x+this.park.w/2,
      y:this.park.y-20,
      text:"Central Park"
    });

    this.landmarks.push({
      x:this.pool.x+60,
      y:this.pool.y-10,
      text:"Pool"
    });

    this.landmarks.push({
      x:this.tennis.x+60,
      y:this.tennis.y-10,
      text:"Tennis Court"
    });

    this.landmarks.push({
      x:this.parking.x+40,
      y:this.parking.y-10,
      text:"Parking"
    });

    this.landmarks.push({
      x:1200,
      y:1220,
      text:"Management"
    });
  }

  addBuilding(x,y,w,h,doorSide,type="building"){
    const b = {x,y,w,h,type};
    this.buildings.push(b);
    this.solids.push({x:x+6,y:y+6,w:w-12,h:h-12});

    let dx=x+w/2-18;
    let dy=y+h-18;

    if(doorSide==="north") dy=y-18;
    if(doorSide==="south") dy=y+h-6;
    if(doorSide==="east"){ dx=x+w-6; dy=y+h/2-18; }
    if(doorSide==="west"){ dx=x-18; dy=y+h/2-18; }

    this.doors.push({x:dx,y:dy,w:36,h:36,target:type});
  }

  hitsSolid(r){
    for(const s of this.solids){
      if(r.x<s.x+s.w && r.x+r.w>s.x && r.y<s.y+s.h && r.y+r.h>s.y)
        return true;
    }
    return false;
  }

  getSpawn(){ return this.spawns.actor; }

  nearestLandmark(px,py,d=70){
    let best=null,bd=d*d;
    for(const l of this.landmarks){
      const dx=l.x-px, dy=l.y-py;
      const dist=dx*dx+dy*dy;
      if(dist<bd){bd=dist;best=l;}
    }
    return best;
  }

  draw(ctx,cam){

    ctx.fillStyle="#6c8f4e";
    ctx.fillRect(0,0,cam.vw,cam.vh);

    ctx.save();
    ctx.translate(-cam.x,-cam.y);

    // roads
    ctx.fillStyle="#2c2c34";
    for(const r of this.roads)
      ctx.fillRect(r.x,r.y,r.w,r.h);

    // parking
    ctx.fillStyle="#303038";
    ctx.fillRect(this.parking.x,this.parking.y,this.parking.w,this.parking.h);

    // park
    ctx.fillStyle="#5f7f41";
    ctx.fillRect(this.park.x,this.park.y,this.park.w,this.park.h);

    // pool
    ctx.fillStyle="#1e6b70";
    ctx.fillRect(this.pool.x,this.pool.y,this.pool.w,this.pool.h);

    // tennis
    ctx.fillStyle="#3e6f66";
    ctx.fillRect(this.tennis.x,this.tennis.y,this.tennis.w,this.tennis.h);

    // buildings
    ctx.fillStyle="#c9c0ae";
    for(const b of this.buildings)
      ctx.fillRect(b.x,b.y,b.w,b.h);

    // labels
    ctx.fillStyle="rgba(0,0,0,.4)";
    ctx.font="12px sans-serif";
    for(const l of this.landmarks)
      ctx.fillText(l.text,l.x,l.y);

    ctx.restore();
  }

  drawAbove(){}
}
