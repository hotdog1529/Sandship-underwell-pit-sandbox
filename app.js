// app.js
// Underwell Pit — touch-friendly sandbox with monsters and tools
// Pointer-based input (works on touch & mouse).

const canvas = document.getElementById('pitCanvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');
const activeToolLabel = document.getElementById('activeTool');
const yearSpan = document.getElementById('year');
const timeSpan = document.getElementById('time');
const everHpSpan = document.getElementById('everHp');
const highSpan = document.getElementById('high');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('btnClear');

yearSpan.textContent = new Date().getFullYear();

// canvas sizing
function fit() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  draw();
}
window.addEventListener('resize', fit);
fit();

// world state
const world = {
  blocks: [],      // {x,y,w,h,health}
  turrets: [],     // {x,y,rate,cool}
  traps: [],       // shock traps {x,y,radius,active}
  bombs: [],       // {x,y,armedTimer}
  conveyors: [],   // {x,y,w,h,dir}
  entities: [],    // monsters {x,y,vx,vy,hp,state,progress}
  everstone: null,
  running: false,
  time: 0,
  high: parseFloat(localStorage.getItem('underwell_high')||'0')
};

highSpan.textContent = world.high.toFixed(1);

// initialize pit layout (super-accurate-ish: central chamber + tunnels)
function initLevel() {
  world.blocks = [];
  world.turrets = [];
  world.traps = [];
  world.bombs = [];
  world.conveyors = [];
  world.entities = [];
  world.time = 0;
  world.running = false;

  // create pit walls & platform around central everstone
  const W = canvas.width, H = canvas.height;
  // outer ring
  world.blocks.push({x:0,y:H-120,w:W,h:120,health:999}); // ground
  // left tunnel
  world.blocks.push({x:0,y:0,w:60,h:H-180,health:999});
  // right tunnel
  world.blocks.push({x:W-60,y:0,w:60,h:H-180,health:999});
  // back wall
  world.blocks.push({x:0,y:0,w:W,h:40,health:999});
  // central platform
  const cx = W/2, cy = H/2 + 30;
  world.blocks.push({x:cx-160,y:cy-60,w:320,h:120,health:200});
  // small supports
  world.blocks.push({x:cx-220,y:cy+40,w:60,h:40,health:100});
  world.blocks.push({x:cx+160,y:cy+40,w:60,h:40,health:100});
  // everstone machine
  world.everstone = {x:cx, y:cy-10, r:34, hp:100, max:100};

  draw();
}
initLevel();

// tools
let activeTool = 'select';
activeToolLabel.textContent = 'Select';

// toolbar clicks (pointer friendly)
toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tool');
  if (!btn) return;
  const tool = btn.dataset.tool;
  document.querySelectorAll('.tool').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  if (tool) activeTool = tool;
  activeToolLabel.textContent = capitalize(activeTool);
});

// clear
clearBtn.addEventListener('click', () => {
  world.blocks = world.blocks.filter(b => b.health===999); // keep walls
  world.turrets = []; world.traps=[]; world.bombs=[]; world.conveyors=[]; world.entities=[];
  draw();
});

// start/pause/reset
startBtn.addEventListener('click', () => {
  world.running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resetBtn.disabled = false;
});
pauseBtn.addEventListener('click', () => {
  world.running = !world.running;
  pauseBtn.textContent = world.running ? 'Pause' : 'Resume';
  if (!world.running) startBtn.disabled = false;
  else startBtn.disabled = true;
});
resetBtn.addEventListener('click', () => {
  initLevel();
  world.time = 0;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = true;
  everHpSpan.textContent = world.everstone.hp;
  timeSpan.textContent = (0).toFixed(1);
});

// pointer interaction for placing & selecting
let pointer = {down:false,x:0,y:0,grab:null};

canvas.addEventListener('pointerdown', (ev) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ev.clientX - rect.left;
  pointer.y = ev.clientY - rect.top;
  pointer.down = true;

  if (activeTool === 'builder') {
    placeBlock(pointer.x - 30, pointer.y - 18, 60, 36, 120);
  } else if (activeTool === 'barrier') {
    placeBlock(pointer.x - 40, pointer.y - 10, 80, 20, 180);
  } else if (activeTool === 'conveyor') {
    placeConveyor(pointer.x - 60, pointer.y - 12, 120, 24, 1);
  } else if (activeTool === 'laser') {
    placeTurret(pointer.x, pointer.y);
  } else if (activeTool === 'shock') {
    placeTrap(pointer.x, pointer.y);
  } else if (activeTool === 'bomb') {
    placeBomb(pointer.x, pointer.y);
  } else if (activeTool === 'welder') {
    // weld: repair nearest block or the everstone
    const b = findNearestBlock(pointer.x, pointer.y, 80);
    if (b) { b.health = Math.min((b.health||100)+30, 200); }
    const e = world.everstone;
    if (dist(pointer.x,pointer.y,e.x,e.y) < e.r + 40) { e.hp = Math.min(e.hp+15, e.max); }
  } else if (activeTool === 'select') {
    // try to pick up blocks or entities for dragging
    const b = findBlockAt(pointer.x, pointer.y);
    if (b) pointer.grab = {type:'block', ref:b, ox:pointer.x - b.x, oy:pointer.y - b.y};
  }

  draw();
});

canvas.addEventListener('pointermove', (ev) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ev.clientX - rect.left;
  pointer.y = ev.clientY - rect.top;
  if (pointer.down && pointer.grab && pointer.grab.type==='block') {
    pointer.grab.ref.x = pointer.x - pointer.grab.ox;
    pointer.grab.ref.y = pointer.y - pointer.grab.oy;
    draw();
  }
});
window.addEventListener('pointerup', ()=>{ pointer.down=false; pointer.grab=null; });

// helpers: place entities & objects
function placeBlock(x,y,w,h,health=100){
  world.blocks.push({x,y,w,h,health});
  draw();
}
function placeTurret(x,y){
  world.turrets.push({x,y,rate:0.25,cool:0});
}
function placeTrap(x,y){
  world.traps.push({x,y,r:28,active:true,cd:0});
}
function placeBomb(x,y){
  world.bombs.push({x,y,armed:60}); // ticks until explosion
}
function placeConveyor(x,y,w,h,dir=1){
  world.conveyors.push({x,y,w,h,dir});
}

// find block at point
function findBlockAt(x,y){
  for (let i=world.blocks.length-1;i>=0;i--){
    const b=world.blocks[i];
    if (x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h) return b;
  }
  return null;
}
function findNearestBlock(x,y,r){
  let best=null,bd=1e9;
  for (const b of world.blocks){
    const cx = b.x + b.w/2, cy = b.y + b.h/2;
    const d = dist(x,y,cx,cy);
    if (d<r && d<bd){ bd=d; best=b; }
  }
  return best;
}
function dist(a,b,c,d){ return Math.hypot(a-c,b-d); }
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

// monsters spawning
let spawnTimer = 0;
function spawnMonster() {
  const W = canvas.width, H = canvas.height;
  // spawn from top tunnels (left or right)
  const edge = Math.random()<0.5 ? 'left' : 'right';
  const x = edge==='left' ? 80 : W-80;
  const y = 60 + Math.random()*(H/3);
  const m = {x,y,vx:0,vy:0,hp:20,state:'walk',target:null,progress:0,stunned:0};
  world.entities.push(m);
}

// basic AI: move to everstone, dig blocks when blocked
function updateAI(m){
  // if stunned
  if (m.stunned>0){ m.stunned--; m.vx=0; m.vy=0; return; }

  const ex = world.everstone.x, ey = world.everstone.y;
  const dx = ex - m.x, dy = ey - m.y;
  const d = Math.hypot(dx,dy);
  // wander occasionally
  if (Math.random()<0.01) { m.vx += (Math.random()-0.5)*0.6; m.vx = clamp(m.vx, -1.8, 1.8); }
  // direct movement
  const speed = 0.6 + Math.min(1.2, (20 - m.hp)/20);
  m.vx += (dx/d)*0.05 * speed;
  m.vx = clamp(m.vx, -2.0, 2.0);
  m.vy = clamp(dy/d*0.02, -1.2, 1.2);

  // collision with blocks: if blocked, damage block
  const aheadX = m.x + Math.sign(m.vx)*8;
  const headY = m.y;
  const b = findBlockAt(aheadX, headY);
  if (b && b.health !== 999) {
    // dig progress
    m.progress = (m.progress || 0) + 1;
    if (m.progress > 45) { b.health -= 8; m.progress = 0; if (b.health <= 0) {
      // remove block
      const idx = world.blocks.indexOf(b); if (idx>=0) world.blocks.splice(idx,1);
    }}
    m.vx = 0;
  }
}

// turret shooting
function turretLogic(t){
  t.cool -= 1/60;
  if (t.cool <= 0){
    // find nearest monster
    let best=null,bd=1e9;
    for (const m of world.entities){
      const d = dist(t.x,t.y,m.x,m.y);
      if (d<300 && d<bd){bd=d;best=m;}
    }
    if (best){ // shoot - create bullet as instant damage along line
      best.hp -= 8;
      t.cool = 1/t.rate;
    }
  }
}

// conveyors: apply horizontal force
function onConveyor(m){
  for (const c of world.conveyors){
    if (m.x > c.x && m.x < c.x+c.w && m.y > c.y && m.y < c.y + c.h){
      m.vx += c.dir*0.8;
    }
  }
}

// traps
function trapLogic(){
  for (const tr of world.traps){
    if (tr.cd>0) tr.cd--;
    for (const m of world.entities){
      if (dist(tr.x,tr.y,m.x,m.y) < tr.r + 8 && tr.cd===0){
        m.stunned = 90; // stunned ticks
        tr.cd = 240; // cooldown
      }
    }
  }
}

// bombs tick
function bombLogic(){
  for (let i=world.bombs.length-1;i>=0;i--){
    const b = world.bombs[i];
    b.armed--;
    if (b.armed<=0){
      // explode: damage nearby monsters & blocks & everstone
      for (const m of world.entities){ if (dist(b.x,b.y,m.x,m.y) < 90) m.hp -= 30; }
      for (let j=world.blocks.length-1;j>=0;j--){ if (dist(b.x,b.y, world.blocks[j].x+world.blocks[j].w/2, world.blocks[j].y+world.blocks[j].h/2) < 120){
        world.blocks[j].health -= 80;
        if (world.blocks[j].health <= 0) world.blocks.splice(j,1);
      }}
      // reduce everstone if hit
      if (dist(b.x,b.y, world.everstone.x, world.everstone.y) < 120) world.everstone.hp -= 25;
      world.bombs.splice(i,1);
    }
  }
}

// physics & collision & cleanup
function physicsStep() {
  // spawn logic when running
  if (world.running){
    spawnTimer -= 1/60;
    if (spawnTimer <= 0){
      spawnTimer = Math.max(30 - Math.floor(world.time/20), 10) * (Math.random()*0.6+0.7); // rampup spawn
      spawnMonster();
    }
    world.time += 1/60;
    timeSpan.textContent = world.time.toFixed(1);
    // highscore check update later at end
  }
  // update turrets
  for (const t of world.turrets) turretLogic(t);
  // traps
  trapLogic();
  // bombs
  bombLogic();

  // entities movement
  for (let i=world.entities.length-1;i>=0;i--){
    const m = world.entities[i];
    if (m.hp<=0){ world.entities.splice(i,1); continue; }
    updateAI(m);
    onConveyor(m);
    m.x += m.vx;
    m.y += m.vy;
    // clamp to world bounds
    m.x = clamp(m.x, 10, canvas.width-10);
    m.y = clamp(m.y, 40, canvas.height-10);

    // if close to everstone, damage it over time
    if (dist(m.x,m.y,world.everstone.x,world.everstone.y) < world.everstone.r + 10){
      world.everstone.hp -= 0.08; // continuous damage
    }

    // traps already set stun

  }

  // turrets & bullets already applied damage
  // remove dead monsters
  for (let i=world.entities.length-1;i>=0;i--) if (world.entities[i].hp<=0) world.entities.splice(i,1);

  // bombs & block decay happen in their logic

  // clamp everstone HP and check game over
  if (world.everstone.hp <= 0){
    world.everstone.hp = 0;
    world.running = false;
    gameOver();
  }

  // update everstone display
  everHpSpan.textContent = Math.round(world.everstone.hp);
}

// clamp helper
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// game over and high score management
function gameOver(){
  // compute survival time
  const t = world.time;
  if (t > world.high){ world.high = t; localStorage.setItem('underwell_high', t.toFixed(1)); highSpan.textContent = world.high.toFixed(1); }
  // show overlay (simple alert for now)
  setTimeout(()=>{ alert('Everstone destroyed! You survived ' + t.toFixed(1) + 's. Best: ' + world.high.toFixed(1) + 's'); }, 50);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = false;
}

// main render
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background gradient & subtle texture
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#061318'); g.addColorStop(1,'#021016');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw conveyors (striped)
  for (const c of world.conveyors){
    ctx.fillStyle = 'rgba(160,160,160,0.06)'; ctx.fillRect(c.x, c.y, c.w, c.h);
    // arrows
    ctx.save();
    ctx.translate(c.x + 10, c.y + c.h/2);
    ctx.fillStyle = 'rgba(245,192,107,0.9)';
    for (let i=0;i<c.w/20;i++){
      ctx.beginPath(); ctx.moveTo(i*20, -6); ctx.lineTo(i*20+8,0); ctx.lineTo(i*20,6); ctx.fill();
    }
    ctx.restore();
  }

  // blocks
  for (const b of world.blocks){
    // color by health
    const ratio = clamp(b.health/200, 0, 1);
    const color = lerpColor('#6fbdd6','#e07b4a', 1 - ratio);
    ctx.fillStyle = color;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fill();
    // health bar
    if (b.health !== 999){
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(b.x, b.y-6, b.w, 4);
      ctx.fillStyle = 'rgba(80,200,120,0.9)'; ctx.fillRect(b.x, b.y-6, b.w * clamp(b.health/180,0,1), 4);
    }
  }

  // turrets
  for (const t of world.turrets){
    ctx.fillStyle = '#cfe3ff';
    ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(t.x-2, t.y-14, 4, 10);
  }

  // traps
  for (const tr of world.traps){
    ctx.beginPath(); ctx.fillStyle = tr.cd>0 ? 'rgba(255,90,90,0.14)' : 'rgba(245,192,107,0.12)';
    ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(tr.x-10, tr.y-4, 20, 8);
  }

  // bombs
  for (const b of world.bombs){
    ctx.beginPath(); ctx.fillStyle = 'rgba(240,100,100,0.95)'; ctx.arc(b.x, b.y, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='white'; ctx.fillText(Math.ceil(b.armed/60), b.x-4, b.y+24);
  }

  // everstone
  const e = world.everstone;
  // glow
  ctx.beginPath();
  ctx.fillStyle = `rgba(245,192,107,${0.08 + (1 - e.hp/e.max)*0.4})`;
  ctx.arc(e.x, e.y, e.r+18, 0, Math.PI*2); ctx.fill();
  // body
  ctx.beginPath(); ctx.fillStyle = '#ffd77a'; ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#3b2b14'; ctx.fillRect(e.x-8, e.y-6, 16, 12);

  // entities (monsters)
  for (const m of world.entities){
    ctx.beginPath(); ctx.fillStyle = '#f3d84b'; ctx.arc(m.x, m.y, 10, 0, Math.PI*2); ctx.fill();
    if (m.stunned>0){
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(m.x-8, m.y-20, 16, 4);
      ctx.fillStyle='white'; ctx.fillText('Z', m.x-3, m.y-14);
    }
  }

  // hud overlay minimal
  // drawn elsewhere by DOM

}

// helpers for drawing
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function lerpColor(a,b,t){
  // simple hex lerp a->b
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r)*t);
  const g = Math.round(pa.g + (pb.g - pa.g)*t);
  const bl = Math.round(pa.b + (pb.b - pa.b)*t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex){
  hex = hex.replace('#','');
  const bigint = parseInt(hex,16);
  if (hex.length===6) return {r:(bigint>>16)&255,g:(bigint>>8)&255,b:bigint&255};
  return {r:0,g:0,b:0};
}

// main loop
let last = performance.now();
function loop(now){
  const dt = (now - last)/1000; last = now;
  // physics step at 60Hz approx
  if (world.running) {
    for (let i=0;i<Math.max(1, Math.round(dt*60)); i++){
      physicsStep();
    }
  }
  draw();
  // cleanup dead monsters already in physicsStep
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// utilities & small helpers
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

// auto spawn for debug when not running? no — only when running

// mouse/touch pointer cursor can show tool previews
canvas.addEventListener('pointerenter', ()=> canvas.style.cursor = 'crosshair');
canvas.addEventListener('pointerleave', ()=> canvas.style.cursor = 'default');

// keyboard shortcuts (optional)
window.addEventListener('keydown', (e)=>{
  if (e.key===' '){ // toggle start/pause
    if (!world.running){ startBtn.click(); } else { pauseBtn.click(); }
  }
});

// small utility: periodically remove degenerate blocks
setInterval(()=>{ world.blocks = world.blocks.filter(b => b.w>4 && b.h>4); }, 3000);

// end of app.js
