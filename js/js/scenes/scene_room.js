const SceneRoom = {
  eng:null,
  map:null,
  player:null,
  keysObj:null,
  interactCooldown:0,

  init(eng){
    this.eng = eng;
    this.map = MAPS.room1;

    // player + outfit
    const outf = eng.state.outfit || {
      hair:{color:"#f5d26b"}, dress:{color:"#ff9bd3"}, shoes:{color:"#2a2a2a"}, accessory:{id:"none",color:null},
      eyes:"#4aa3ff", skin:"#ffe0c4"
    };

    this.player = {
      x: 10, y: 12, // tile coords
      px: 10*eng.tileSize, py: 12*eng.tileSize,
      speed: 140, // pixels/sec
      facing:{x:0,y:1},
      outfit: outf
    };

    this.keysObj = null;
    this.eng.state.hasKeys = false;
    this.eng.state.timerSec = 0;
    this.eng.state.alarmed = false;

    UI.toast("Sophia is writing. Check the clock. 🕒", 1800);
  },

  update(dt, input){
    this.interactCooldown = Math.max(0, this.interactCooldown - dt);
    this.eng.state.timerSec += dt;

    // movement
    const vx = input.x, vy = input.y;
    if(vx!==0 || vy!==0) this.player.facing = {x:vx, y:vy};

    const nx = this.player.px + vx * this.player.speed * dt;
    const ny = this.player.py + vy * this.player.speed * dt;

    // collision by tiles
    const canMove = (px,py)=>{
      const tx = Math.floor(px / this.eng.tileSize);
      const ty = Math.floor(py / this.eng.tileSize);
      const tile = this.map.tiles[ty]?.[tx];
      if(tile == null) return false;
      return !this.map.solid.has(tile);
    };

    // basic (not perfect) collision: test center
    if(canMove(nx, this.player.py)) this.player.px = nx;
    if(canMove(this.player.px, ny)) this.player.py = ny;

    this.player.x = Math.floor(this.player.px / this.eng.tileSize);
    this.player.y = Math.floor(this.player.py / this.eng.tileSize);

    // trigger alarm by clock sight (walk near it)
    if(!this.eng.state.alarmed){
      const dx = this.player.x - this.map.clockPos.x;
      const dy = this.player.y - this.map.clockPos.y;
      if(Math.abs(dx)+Math.abs(dy) <= 2){
        this.eng.state.alarmed = true;
        UI.toast("CLOCK: YOU’RE LATE. Where are your keys?!", 2200);

        // spawn keys now
        this.keysObj = { x:this.map.keySpawn.x, y:this.map.keySpawn.y };
      }
    }

    // Interact
    if(input.interact && this.interactCooldown===0){
      this.interactCooldown = 0.2;
      this._tryInteract();
    }
  },

  _tryInteract(){
    const fx = this.player.x + this.player.facing.x;
    const fy = this.player.y + this.player.facing.y;

    // keys
    if(this.keysObj && fx===this.keysObj.x && fy===this.keysObj.y){
      this.eng.state.hasKeys = true;
      this.keysObj = null;
      UI.toast("Keys found! Now RUN to the door! 🗝️", 1700);
      return;
    }

    // door
    if(fx===this.map.doorPos.x && fy===this.map.doorPos.y){
      if(!this.eng.state.alarmed){
        UI.toast("Sophia: I should check the clock first…", 1400);
      } else if(!this.eng.state.hasKeys){
        UI.toast("Sophia: I can’t leave without my keys!", 1400);
      } else {
        UI.toast("Sophia bolts out the door... next level: BUS STOP 🚏", 2200);
        // next level later
      }
      return;
    }

    // clock interact
    if(fx===this.map.clockPos.x && fy===this.map.clockPos.y){
      UI.toast("The clock feels loud. The audition feels closer.", 1700);
      return;
    }

    UI.toast("Nothing to interact with.", 900);
  },

  draw(ctx){
    ctx.clearRect(0,0,960,540);

    this._drawMap(ctx);
    this._drawObjects(ctx);
    this._drawPlayer(ctx);
    this._drawOverlay(ctx);
  },

  _drawMap(ctx){
    const ts = this.eng.tileSize;

    for(let y=0;y<this.map.h;y++){
      for(let x=0;x<this.map.w;x++){
        const t = this.map.tiles[y][x];
        // palette like your screenshot: warm wood, dark walls, furniture
        if(t===1){ ctx.fillStyle="#2a2d33"; }          // wall
        else if(t===0){ ctx.fillStyle="#7a4d2a"; }     // wood floor
        else if(t===2){ ctx.fillStyle="#3c2a35"; }     // rug
        else if(t===3){ ctx.fillStyle="#4a2b16"; }     // bookshelf block
        else if(t===4){ ctx.fillStyle="#5a371d"; }     // desk block
        else if(t===5){ ctx.fillStyle="#1e1b18"; }     // door tile
        else if(t===6){ ctx.fillStyle="#cfcfcf"; }     // clock tile
        else { ctx.fillStyle="#7a4d2a"; }

        ctx.fillRect(x*ts, y*ts, ts, ts);

        // subtle tile lines for RPG feel
        ctx.strokeStyle="rgba(0,0,0,.18)";
        ctx.strokeRect(x*ts, y*ts, ts, ts);
      }
    }
  },

  _drawObjects(ctx){
    const ts = this.eng.tileSize;

    // clock icon
    ctx.fillStyle="#ffffff";
    ctx.beginPath();
    ctx.arc((this.map.clockPos.x+0.5)*ts, (this.map.clockPos.y+0.5)*ts, 10, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle="#000";
    ctx.beginPath();
    ctx.moveTo((this.map.clockPos.x+0.5)*ts, (this.map.clockPos.y+0.5)*ts);
    ctx.lineTo((this.map.clockPos.x+0.5)*ts, (this.map.clockPos.y+0.25)*ts);
    ctx.stroke();

    // keys if spawned
    if(this.keysObj){
      const kx = (this.keysObj.x+0.2)*ts;
      const ky = (this.keysObj.y+0.35)*ts;
      ctx.fillStyle="#f1c84b";
      ctx.fillRect(kx, ky, 16, 10);
      ctx.fillStyle="#d2a12b";
      ctx.fillRect(kx+12, ky+8, 10, 6);
    }

    // door glow if keys found
    if(this.eng.state.hasKeys){
      const dx = (this.map.doorPos.x+0.5)*ts;
      const dy = (this.map.doorPos.y+0.5)*ts;
      ctx.fillStyle="rgba(138,46,255,.18)";
      ctx.beginPath();
      ctx.arc(dx, dy, 18, 0, Math.PI*2);
      ctx.fill();
    }
  },

  _drawPlayer(ctx){
    const ts = this.eng.tileSize;
    const px = this.player.px + ts/2;
    const py = this.player.py + ts/2;
    const bob = Math.sin(Date.now()/140)*1.2;

    const o = this.player.outfit;

    // shadow
    ctx.fillStyle="rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(px, py+12, 12, 6, 0, 0, Math.PI*2);
    ctx.fill();

    // dress
    ctx.fillStyle = o.dress.color;
    ctx.beginPath();
    ctx.ellipse(px, py+4+bob, 12, 14, 0, 0, Math.PI*2);
    ctx.fill();

    // head
    ctx.fillStyle = o.skin;
    ctx.beginPath();
    ctx.arc(px, py-12+bob, 9, 0, Math.PI*2);
    ctx.fill();

    // hair
    ctx.fillStyle = o.hair.color;
    ctx.beginPath();
    ctx.arc(px, py-14+bob, 10, Math.PI, 0);
    ctx.fill();

    // eyes
    ctx.fillStyle = o.eyes;
    ctx.beginPath();
    ctx.arc(px-3, py-12+bob, 1.5, 0, Math.PI*2);
    ctx.arc(px+3, py-12+bob, 1.5, 0, Math.PI*2);
    ctx.fill();

    // accessory
    if(o.accessory && o.accessory.id!=="none"){
      ctx.fillStyle = o.accessory.color;
      ctx.fillRect(px-6, py-2+bob, 12, 2);
    }

    // shoes
    ctx.fillStyle = o.shoes.color;
    ctx.fillRect(px-7, py+18+bob, 5, 3);
    ctx.fillRect(px+2, py+18+bob, 5, 3);

    // facing indicator (tiny violet spark)
    ctx.fillStyle="rgba(138,46,255,.8)";
    ctx.fillRect(px + this.player.facing.x*10, py + this.player.facing.y*10, 2, 2);
  },

  _drawOverlay(ctx){
    // top UI text like an RPG status bar
    ctx.fillStyle="rgba(0,0,0,.45)";
    ctx.fillRect(0,0,960,44);

    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.font="700 14px system-ui";
    ctx.fillText("THE ADVENTURES OF SOPHIA — LEVEL 1: THE ROOM", 14, 28);

    let status = "Write poem → check clock";
    if(this.eng.state.alarmed && !this.eng.state.hasKeys) status = "Find your keys!";
    if(this.eng.state.hasKeys) status = "Go to the door!";
    ctx.font="600 14px system-ui";
    ctx.fillStyle="rgba(255,255,255,.8)";
    ctx.fillText(status, 620, 28);
  }
};

