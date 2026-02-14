const UI = {
  toastEl: null,
  toastTimer: 0,

  init(){
    this.toastEl = document.getElementById("toast");
  },

  toast(msg, ms=1400){
    if(!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(()=>{ this.toastEl.style.opacity=0; }, ms);
  }
};

