// src/core/inventory.js
// NPC City Inventory (3 quick slots) — keys 1/2/3 switch.
// This module ONLY manages held weapon/tool state.
// Your player renderer (player.js) will draw p.held when it's set.

export class Inventory {
  constructor(){
    this.slots = [
      null, // slot 1
      null, // slot 2
      null  // slot 3
    ];
    this.active = 0; // 0..2
    this._bound = false;
  }

  // Optional: starter loadout
  setDefaultLoadout(){
    this.slots[0] = { type:"knife", twoHanded:false };
    this.slots[1] = { type:"bat",   twoHanded:true  };
    this.slots[2] = { type:"flashlight", twoHanded:false };
  }

  bindHotkeys(){
    if (this._bound) return;
    this._bound = true;

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;

      // Ignore typing in inputs/textareas
      const t = e.target && e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA") return;

      if (e.key === "1") this.active = 0;
      else if (e.key === "2") this.active = 1;
      else if (e.key === "3") this.active = 2;

      // Optional: Q cycles
      else if (e.key.toLowerCase() === "q"){
        this.active = (this.active + 1) % 3;
      }
    });
  }

  // Call every frame (or on input changes).
  // This writes into your player state so the renderer works automatically.
  applyToPlayer(playerState){
    playerState.held = this.getHeld();
  }

  getHeld(){
    return this.slots[this.active] ?? null;
  }

  setSlot(i, item){
    if (i < 0 || i > 2) return;
    this.slots[i] = item ?? null;
  }
}
