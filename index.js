// ======== Config ========
const CONFIG = {
  SHIP: {
    RADIUS: 12,
    ACCEL: 280,           // px/s^2
    TURN: 3.4,            // rad/s
    FRICTION: 0.985,
    MAX_SPEED: 420,       // px/s
    INVULN_MS: 2000
  },
  BULLET: {
    SPEED: 720,           // px/s
    RADIUS: 2.5,
    TTL_MS: 900,
    COOLDOWN_MS: 140
  },
  ASTEROID: {
    BASE_SPEED: 60,
    VARIANCE: 1.8,
    RADIUS: { L: 48, M: 30, S: 18 },
    SCORE:   { L: 20, M: 50, S: 100 },
    SPAWN_EVERY_MS: 1200,
    JAGGEDNESS: 0.4,      // irregular polygon factor
    VERTS: 10
  },
  PARTICLE: {
    COUNT_EXPLOSION: [20, 36],
    COUNT_THRUST: 6,
    TTL_MS: [250, 650]
  },
  WORLD: {
    MARGIN_SPAWN: 64      // spawn off-screen margin
  },
  GAME: {
    START_LIVES: 3
  }
};

// ======== Canvas + DPR ========
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const HUD = document.getElementById('hud');
const CENTER = document.getElementById('center');

// ======== Utilities ========
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function wrap(v, max) {
  if (v < -CONFIG.WORLD.MARGIN_SPAWN) return max + CONFIG.WORLD.MARGIN_SPAWN;
  if (v > max + CONFIG.WORLD.MARGIN_SPAWN) return -CONFIG.WORLD.MARGIN_SPAWN;
  return v;
}

function len(x, y) { return Math.hypot(x, y); }

function rotatePoint(px, py, cx, cy, angle) {
  const s = Math.sin(angle), c = Math.cos(angle);
  const dx = px - cx, dy = py - cy;
  return { x: dx * c - dy * s + cx, y: dx * s + dy * c + cy };
}

// Line segment distance (for circle-poly collision)
function distPointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx*abx + aby*aby || 1;
  const t = clamp((apx*abx + apy*aby) / ab2, 0, 1);
  const cx = ax + abx*t, cy = ay + aby*t;
  return Math.hypot(px - cx, py - cy);
}

function pointInTriangle(p, a, b, c) {
  // barycentric
  const v0 = {x: c.x - a.x, y: c.y - a.y};
  const v1 = {x: b.x - a.x, y: b.y - a.y};
  const v2 = {x: p.x - a.x, y: p.y - a.y};
  const dot00 = v0.x*v0.x + v0.y*v0.y;
  const dot01 = v0.x*v1.x + v0.y*v1.y;
  const dot02 = v0.x*v2.x + v0.y*v2.y;
  const dot11 = v1.x*v1.x + v1.y*v1.y;
  const dot12 = v1.x*v2.x + v1.y*v2.y;
  const invDen = 1 / (dot00*dot11 - dot01*dot01);
  const u = (dot11*dot02 - dot01*dot12) * invDen;
  const v = (dot00*dot12 - dot01*dot02) * invDen;
  return (u >= 0) && (v >= 0) && (u + v < 1);
}

// ======== Input ========
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (state === 'MENU' && e.code === 'Enter') startGame();
  else if (state === 'GAMEOVER' && e.code === 'Enter') startGame();
  else if (state === 'PLAYING' && e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ======== Spatial Hash (performance) ========
class SpatialHash {
  constructor(cell = 96) { this.cell = cell; this.map = new Map(); }
  key(x, y) { return `${Math.floor(x/this.cell)},${Math.floor(y/this.cell)}`; }
  insert(item, x, y, r) {
    const minX = Math.floor((x - r)/this.cell);
    const maxX = Math.floor((x + r)/this.cell);
    const minY = Math.floor((y - r)/this.cell);
    const maxY = Math.floor((y + r)/this.cell);
    for (let gx=minX; gx<=maxX; gx++) for (let gy=minY; gy<=maxY; gy++) {
      const k = `${gx},${gy}`;
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(item);
    }
  }
  query(x, y, r) {
    const out = [];
    const minX = Math.floor((x - r)/this.cell);
    const maxX = Math.floor((x + r)/this.cell);
    const minY = Math.floor((y - r)/this.cell);
    const maxY = Math.floor((y + r)/this.cell);
    for (let gx=minX; gx<=maxX; gx++) for (let gy=minY; gy<=maxY; gy++) {
      const k = `${gx},${gy}`;
      const cell = this.map.get(k);
      if (cell) out.push(...cell);
    }
    return out;
  }
  clear() { this.map.clear(); }
}

// ======== Base Entity ========
class Entity {
  constructor() { this.dead = false; }
  update(dt) {}
  draw(ctx) {}
}

// ======== Player ========
class Player extends Entity {
  constructor(x, y) {
    super();
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.rot = -Math.PI / 2;
    this.cooldown = 0;
    this.invulnUntil = 0;
    this.blink = false;
  }
  get verts() {
    const r = CONFIG.SHIP.RADIUS;
    const tip = { x: this.pos.x + Math.cos(this.rot)*r*1.9, y: this.pos.y + Math.sin(this.rot)*r*1.9 };
    const left = rotatePoint(this.pos.x - r*0.9, this.pos.y - r*0.7, this.pos.x, this.pos.y, this.rot);
    const right = rotatePoint(this.pos.x - r*0.9, this.pos.y + r*0.7, this.pos.x, this.pos.y, this.rot);
    return [tip, left, right];
  }
  shoot() {
    if (this.cooldown > 0) return null;
    this.cooldown = CONFIG.BULLET.COOLDOWN_MS;
    const tip = this.verts[0];
    const speed = CONFIG.BULLET.SPEED;
    const vx = Math.cos(this.rot) * speed + this.vel.x * 0.15;
    const vy = Math.sin(this.rot) * speed + this.vel.y * 0.15;
    return new Bullet(tip.x, tip.y, vx, vy);
  }
  hyperspace() {
    // teleport to a random safe-ish spot
    this.pos.x = rand(CONFIG.WORLD.MARGIN_SPAWN, canvas.width/ (window.devicePixelRatio||1) - CONFIG.WORLD.MARGIN_SPAWN);
    this.pos.y = rand(CONFIG.WORLD.MARGIN_SPAWN, canvas.height/ (window.devicePixelRatio||1) - CONFIG.WORLD.MARGIN_SPAWN);
    this.vel.x = this.vel.y = 0;
    this.invulnUntil = performance.now() + CONFIG.SHIP.INVULN_MS;
  }
  update(dt) {
    const now = performance.now();
    // Rotation
    if (keys.has('ArrowLeft') || keys.has('KeyA')) this.rot -= CONFIG.SHIP.TURN * dt;
    if (keys.has('ArrowRight') || keys.has('KeyD')) this.rot += CONFIG.SHIP.TURN * dt;

    // Thrust
    if (keys.has('ArrowUp') || keys.has('KeyW')) {
      this.vel.x += Math.cos(this.rot) * CONFIG.SHIP.ACCEL * dt;
      this.vel.y += Math.sin(this.rot) * CONFIG.SHIP.ACCEL * dt;
      // thrust particles
      for (let i=0;i<CONFIG.PARTICLE.COUNT_THRUST;i++) {
        const a = this.rot + Math.PI + rand(-0.6,0.6);
        const s = rand(60, 160);
        particles.push(new Particle(
          this.pos.x - Math.cos(this.rot) * CONFIG.SHIP.RADIUS*0.9,
          this.pos.y - Math.sin(this.rot) * CONFIG.SHIP.RADIUS*0.9,
          Math.cos(a) * s, Math.sin(a) * s, randInt(...CONFIG.PARTICLE.TTL_MS), 'thrust'
        ));
      }
    }

    // Friction & max speed
    this.vel.x *= CONFIG.SHIP.FRICTION;
    this.vel.y *= CONFIG.SHIP.FRICTION;
    const speed = len(this.vel.x, this.vel.y);
    if (speed > CONFIG.SHIP.MAX_SPEED) {
      const k = CONFIG.SHIP.MAX_SPEED / speed;
      this.vel.x *= k; this.vel.y *= k;
    }

    // Move + wrap
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.x = wrap(this.pos.x, canvas.clientWidth);
    this.pos.y = wrap(this.pos.y, canvas.clientHeight);

    // Shooting
    if (keys.has('Space')) {
      const b = this.shoot();
      if (b) bullets.push(b);
    }

    // Hyperspace
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
      // use once per press
      if (!this._hsPressed) { this.hyperspace(); this._hsPressed = true; }
    } else this._hsPressed = false;

    // cooldown
    this.cooldown = Math.max(0, this.cooldown - dt*1000);

    // blink state if invulnerable
    this.blink = now < this.invulnUntil && Math.floor(now/100) % 2 === 0;
  }
  draw(ctx) {
    if (this.blink) return;
    const [tip, left, right] = this.verts;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // nose dot
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 2.4, 0, Math.PI*2);
    ctx.fillStyle = '#ff5252';
    ctx.fill();
    ctx.restore();
  }
}

// ======== Bullet ========
class Bullet extends Entity {
  constructor(x, y, vx, vy) {
    super();
    this.pos = { x, y };
    this.vel = { x: vx, y: vy };
    this.radius = CONFIG.BULLET.RADIUS;
    this.ttl = CONFIG.BULLET.TTL_MS;
  }
  update(dt) {
    this.ttl -= dt*1000;
    if (this.ttl <= 0) { this.dead = true; return; }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    // no wrap; bullets vanish offscreen
    if (
      this.pos.x < -50 || this.pos.x > canvas.clientWidth + 50 ||
      this.pos.y < -50 || this.pos.y > canvas.clientHeight + 50
    ) this.dead = true;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

// ======== Asteroid ========
class Asteroid extends Entity {
  // size: 'L' | 'M' | 'S'
  constructor(x, y, size='L', vx=null, vy=null) {
    super();
    this.size = size;
    const R = CONFIG.ASTEROID.RADIUS[size];
    this.radius = rand(R*0.85, R*1.15);
    this.pos = { x, y };
    if (vx === null || vy === null) {
      const a = rand(0, Math.PI*2);
      const s = CONFIG.ASTEROID.BASE_SPEED * rand(1, CONFIG.ASTEROID.VARIANCE);
      this.vel = { x: Math.cos(a)*s, y: Math.sin(a)*s };
    } else {
      this.vel = { x: vx, y: vy };
    }
    // creating jagged polygon
    const n = CONFIG.ASTEROID.VERTS;
    this.verts = [];
    for (let i=0;i<n;i++) {
      const angle = (i/n) * Math.PI*2;
      const mag = this.radius * (1 - CONFIG.ASTEROID.JAGGEDNESS + Math.random()*CONFIG.ASTEROID.JAGGEDNESS);
      this.verts.push({ angle, mag });
    }
    this.rot = rand(-0.6, 0.6);
    this.theta = rand(0, Math.PI*2);
  }
  polygon() {
    // world-space points from polar verts
    const pts = [];
    for (const v of this.verts) {
      const a = v.angle + this.theta;
      pts.push({ x: this.pos.x + Math.cos(a)*v.mag, y: this.pos.y + Math.sin(a)*v.mag });
    }
    return pts;
  }
  split() {
    if (this.size === 'L') return ['M','M'];
    if (this.size === 'M') return ['S','S'];
    return [];
  }
  update(dt) {
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.x = wrap(this.pos.x, canvas.clientWidth);
    this.pos.y = wrap(this.pos.y, canvas.clientHeight);
    this.theta += this.rot * dt;
  }
  draw(ctx) {
    const pts = this.polygon();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ======== Particles ========
class Particle extends Entity {
  constructor(x, y, vx, vy, ttlMs, kind='explosion') {
    super();
    this.pos = { x, y };
    this.vel = { x: vx, y: vy };
    this.ttl = ttlMs;
    this.kind = kind;
  }
  update(dt) {
    this.ttl -= dt*1000;
    if (this.ttl <= 0) { this.dead = true; return; }
    // slight drag
    this.vel.x *= 0.985;
    this.vel.y *= 0.985;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
  draw(ctx) {
    const t = clamp(this.ttl / 650, 0, 1);
    ctx.globalAlpha = t;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.kind === 'thrust' ? 1.6 : 2.6, 0, Math.PI*2);
    ctx.fillStyle = this.kind === 'thrust' ? '#ffad66' : '#ffe0a3';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ======== Game State ========
let state = 'MENU'; // MENU | PLAYING | PAUSED | GAMEOVER
let player, bullets, asteroids, particles, score, lives, level, highScore, lastSpawnAt;
let hash = new SpatialHash();

function resetWorld() {
  player = new Player(canvas.clientWidth/2, canvas.clientHeight/2);
  bullets = [];
  asteroids = [];
  particles = [];
  score = 0;
  lives = CONFIG.GAME.START_LIVES;
  level = 1;
  lastSpawnAt = 0;
  highScore = Number(localStorage.getItem('asteroids_highscore') || 0);
  CENTER.style.display = 'grid';
  // pre-seed a wave
  for (let i=0;i<4;i++) spawnAsteroidEdge('L');
}

function startGame() {
  resetWorld();
  state = 'PLAYING';
  player.invulnUntil = performance.now() + CONFIG.SHIP.INVULN_MS;
  CENTER.style.display = 'none';
}

function togglePause() {
  if (state === 'PLAYING') { state = 'PAUSED'; CENTER.style.display = 'grid'; CENTER.querySelector('.title').textContent = 'PAUSED'; CENTER.querySelector('.sub').textContent = 'Press P to resume'; }
  else if (state === 'PAUSED') { state = 'PLAYING'; CENTER.style.display = 'none'; }
}

function gameOver() {
  state = 'GAMEOVER';
  CENTER.style.display = 'grid';
  CENTER.querySelector('.title').textContent = 'GAME OVER';
  CENTER.querySelector('.sub').innerHTML = `Score: <b>${score}</b> — High score: <b>${Math.max(score, highScore)}</b><br/>Press <b>Enter</b> to play again`;
  localStorage.setItem('asteroids_highscore', String(Math.max(score, highScore)));
}

// Spawn asteroid from the edges with margin
function spawnAsteroidEdge(size='L') {
  const side = randInt(0,4);
  const m = CONFIG.WORLD.MARGIN_SPAWN;
  let x, y;
  if (side === 0) { x = -m; y = rand(0, canvas.clientHeight); }
  else if (side === 1) { x = canvas.clientWidth + m; y = rand(0, canvas.clientHeight); }
  else if (side === 2) { x = rand(0, canvas.clientWidth); y = -m; }
  else { x = rand(0, canvas.clientWidth); y = canvas.clientHeight + m; }
  asteroids.push(new Asteroid(x, y, size));
}

// ======== Collision Helpers ========
function circleCircle(a, b) {
  const dx = a.pos.x - b.pos.x;
  const dy = a.pos.y - b.pos.y;
  const r = (a.radius || 0) + (b.radius || 0);
  return dx*dx + dy*dy <= r*r;
}

function circlePolygon(circle, polyPoints) {
  // if any edge closer than radius -> hit
  for (let i=0;i<polyPoints.length;i++) {
    const a = polyPoints[i];
    const b = polyPoints[(i+1)%polyPoints.length];
    const d = distPointToSegment(circle.pos.x, circle.pos.y, a.x, a.y, b.x, b.y);
    if (d <= circle.radius) return true;
  }
  // if polygon contains circle center (approx via triangles fan to origin)
  // Use triangle test around first vertex
  for (let i=1;i<polyPoints.length-1;i++) {
    if (pointInTriangle(circle.pos, polyPoints[0], polyPoints[i], polyPoints[i+1])) return true;
  }
  return false;
}

// ======== Main Loop ========
let prev = performance.now();
function loop(now = performance.now()) {
  const dt = Math.min((now - prev) / 1000, 1/30); // clamp big jumps
  prev = now;

  // clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  if (state === 'PLAYING') {
    // spawn pacing
    if (now - lastSpawnAt > CONFIG.ASTEROID.SPAWN_EVERY_MS) {
      // scale difficulty with level
      const toSpawn = 1 + Math.floor(level/2);
      for (let i=0;i<toSpawn;i++) spawnAsteroidEdge('L');
      lastSpawnAt = now;
    }

    // update world
    player.update(dt);
    for (const b of bullets) b.update(dt);
    for (const a of asteroids) a.update(dt);
    for (const p of particles) p.update(dt);

    // spatial hash
    hash.clear();
    for (const a of asteroids) hash.insert(a, a.pos.x, a.pos.y, a.radius);
    for (const b of bullets) hash.insert(b, b.pos.x, b.pos.y, b.radius);

    // bullet <> asteroid
    for (const b of bullets) {
      if (b.dead) continue;
      const near = hash.query(b.pos.x, b.pos.y, 64);
      for (const obj of near) {
        if (!(obj instanceof Asteroid)) continue;
        if (circleCircle(b, obj)) {
          b.dead = true;
          obj.dead = true;

          // score + particles
          score += CONFIG.ASTEROID.SCORE[obj.size];
          spawnExplosion(obj.pos.x, obj.pos.y, obj.radius);

          // split
          const next = obj.split();
          for (const s of next) {
            // new velocities roughly away from hit
            const ang = rand(0, Math.PI*2);
            const sp = CONFIG.ASTEROID.BASE_SPEED * rand(1.2, 2.0);
            asteroids.push(new Asteroid(obj.pos.x, obj.pos.y, s, Math.cos(ang)*sp, Math.sin(ang)*sp));
          }
        }
      }
    }

    // player <> asteroid (respect invulnerability)
    const invuln = performance.now() < player.invulnUntil;
    if (!invuln) {
      const near = hash.query(player.pos.x, player.pos.y, 96);
      for (const obj of near) {
        if (!(obj instanceof Asteroid)) continue;
        const hit = circlePolygon({ pos: player.pos, radius: CONFIG.SHIP.RADIUS*0.95 }, obj.polygon());
        if (hit) {
          lives -= 1;
          spawnExplosion(player.pos.x, player.pos.y, CONFIG.SHIP.RADIUS*3);
          if (lives <= 0) { gameOver(); break; }
          // respawn
          player.pos.x = canvas.clientWidth/2;
          player.pos.y = canvas.clientHeight/2;
          player.vel.x = player.vel.y = 0;
          player.invulnUntil = performance.now() + CONFIG.SHIP.INVULN_MS;
        }
      }
    }

    // cull dead
    bullets = bullets.filter(b => !b.dead);
    asteroids = asteroids.filter(a => !a.dead);
    particles = particles.filter(p => !p.dead);

    // level up every N points or when field is clear
    if (asteroids.length === 0) {
      level += 1;
      for (let i=0;i<level+3;i++) spawnAsteroidEdge('L');
    }
  }

  // draw
  for (const a of asteroids) a.draw(ctx);
  for (const b of bullets) b.draw(ctx);
  player?.draw(ctx);
  for (const p of particles) p.draw(ctx);

  // HUD
  HUD.innerHTML = `
    Score: <b>${score}</b><br/>
    Lives: <b>${lives}</b> &nbsp; Level: <b>${level}</b><br/>
    High: <b>${Math.max(score, highScore||0)}</b>
  `;

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ======== Effects ========
function spawnExplosion(x, y, radius) {
  const [minC, maxC] = CONFIG.PARTICLE.COUNT_EXPLOSION;
  const count = randInt(minC, maxC);
  for (let i=0; i<count; i++) {
    const ang = rand(0, Math.PI*2);
    const sp = rand(40, 240) * (radius/CONFIG.ASTEROID.RADIUS.L);
    particles.push(new Particle(x, y, Math.cos(ang)*sp, Math.sin(ang)*sp, randInt(...CONFIG.PARTICLE.TTL_MS), 'explosion'));
  }
}

// ======== Boot ========
resetWorld();
