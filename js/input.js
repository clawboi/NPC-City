const Input = {
  keys: {},
  dir: {x:0,y:0},
  interact: false,

  init(){
    window.addEventListener("keydown",(e)=>{
      this.keys[e.key.toLowerCase()] = true;
      if(e.key === " " || e.key.toLowerCase()==="e") this.interact = true;
    });
    window.addEventListener("keyup",(e)=>{
      this.keys[e.key.toLowerCase()] = false;
      if(e.key === " " || e.key.toLowerCase()==="e") this.interact = false;
    });

    // Mobile D-pad
    document.querySelectorAll("#dpad button").forEach(btn=>{
      const dir = btn.getAttribute("data-dir");
      btn.addEventListener("touchstart",(e)=>{ e.preventDefault(); this._setDir(dir,true); },{passive:false});
      btn.addEventListener("touchend",(e)=>{ e.preventDefault(); this._setDir(dir,false); },{passive:false});
    });

    const interactBtn = document.getElementById("btnInteract");
    interactBtn.addEventListener("touchstart",(e)=>{ e.preventDefault(); this.interact = true; },{passive:false});
    interactBtn.addEventListener("touchend",(e)=>{ e.preventDefault(); this.interact = false; },{passive:false});
  },

  _setDir(dir,on){
    const v = on ? 1 : 0;
    if(dir==="up") this.dir.y = on ? -1 : (this.dir.y===-1 ? 0 : this.dir.y);
    if(dir==="down") this.dir.y = on ?  1 : (this.dir.y=== 1 ? 0 : this.dir.y);
    if(dir==="left") this.dir.x = on ? -1 : (this.dir.x===-1 ? 0 : this.dir.x);
    if(dir==="right") this.dir.x = on ?  1 : (this.dir.x=== 1 ? 0 : this.dir.x);
  },

  read(){
    let x=0,y=0;
    if(this.keys["arrowleft"]||this.keys["a"]) x=-1;
    if(this.keys["arrowright"]||this.keys["d"]) x=1;
    if(this.keys["arrowup"]||this.keys["w"]) y=-1;
    if(this.keys["arrowdown"]||this.keys["s"]) y=1;

    // Mobile overrides if held
    if(this.dir.x!==0) x=this.dir.x;
    if(this.dir.y!==0) y=this.dir.y;

    return {x,y, interact:this.interact};
  }
};

