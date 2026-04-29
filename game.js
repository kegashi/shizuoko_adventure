const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const distanceEl = document.querySelector("#distance");
const okoEl = document.querySelector("#rage");
const okoFillEl = document.querySelector("#okoFill");
const timeEl = document.querySelector("#time");
const messageEl = document.querySelector("#message");
const messageImageEl = document.querySelector("#messageImage");
const controlsGuideEl = document.querySelector(".controls-guide");
const startButton = document.querySelector("#startButton");

const W = 960;
const H = 540;
const WORLD_W = 31000;
const GRAVITY = 2100;
const MOVE_SPEED = 430;
const JUMP_POWER = 820;
const MAX_OKO = 100;
const START_OKO = 70;
const START_X = 86;
const STEP_PX = 82;

const assets = {
  idle: "shizuoko_images/gkok001_01.png",
  runA: "shizuoko_images/gkok008_01.png",
  runB: "shizuoko_images/gkok008_02.png",
  jump: "shizuoko_images/gkok010_01.png",
  attack: "shizuoko_images/gkok010_02.png",
  attackAir: "shizuoko_images/gkok009_01.png",
  win: "shizuoko_images/gkok012_04.png",
  down: "shizuoko_images/gkok003_01.png",
  anger: "shizuoko_images/gkok_ikari.png",
};

const images = {};
const keys = {
  jump: false,
  attack: false,
};

function updateViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
  document.documentElement.classList.toggle("is-touch", navigator.maxTouchPoints > 0);
}

updateViewportHeight();
window.addEventListener("resize", updateViewportHeight);
window.addEventListener("orientationchange", () => setTimeout(updateViewportHeight, 120));
window.visualViewport?.addEventListener("resize", updateViewportHeight);
window.visualViewport?.addEventListener("scroll", updateViewportHeight);

let state;
let lastT = 0;
let cameraX = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildLevel() {
  const platforms = [{ x: 0, y: 486, w: 2100, h: 74 }];
  const coins = [];
  const enemies = [];
  let x = 2040;
  let y = 440;

  for (let i = 0; i < 53; i += 1) {
    const gap = 120 + (i % 4) * 36;
    const width = 270 + (i % 5) * 42;
    y = clamp(y + [-56, 38, -22, 54, -40, 18][i % 6], 286, 474);
    x += gap;
    platforms.push({ x, y, w: width, h: i % 7 === 0 ? 42 : 34 });

    if (i % 3 === 0) {
      platforms.push({
        x: x + width * 0.35,
        y: clamp(y - 122, 190, 356),
        w: 180 + (i % 2) * 50,
        h: 28,
      });
    }

    if (i % 2 === 0) coins.push({ x: x + width * 0.42, y: y - 42, r: 16, got: false });
    if (i % 6 === 0) coins.push({ x: x + width * 0.5, y: clamp(y - 160, 150, 380), r: 16, got: false });

    if (i > 2 && i % 2 === 0) {
      const type = ["walker", "hopper", "runner", "floater", "charger"][i % 5];
      enemies.push({
        x: x + width * 0.55,
        y: y - 10,
        baseY: y - 10,
        min: x + 44,
        max: x + width - 44,
        speed: type === "runner" ? 132 + (i % 4) * 16 : 76 + (i % 6) * 13,
        dir: i % 4 === 0 ? -1 : 1,
        type,
        phase: i * 0.73,
        alive: true,
        hitFlash: 0,
      });
    }

    x += width;
  }

  platforms.push({ x: WORLD_W - 1600, y: 486, w: 1600, h: 74 });
  coins.push({ x: WORLD_W - 980, y: 444, r: 16, got: false });

  return { platforms, coins, enemies };
}

function resetGame() {
  const level = buildLevel();
  state = {
    mode: "play",
    elapsed: 0,
    score: 0,
    oko: START_OKO,
    maxX: START_X,
    player: {
      x: START_X,
      y: 220,
      w: 82,
      h: 98,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      invuln: 0,
      attackTimer: 0,
      attackCooldown: 0,
      attackCostPending: false,
      attackQueued: false,
    },
    platforms: level.platforms,
    coins: level.coins,
    enemies: level.enemies,
    goal: { x: WORLD_W - 310, y: 356, w: 190, h: 130 },
  };
  cameraX = 0;
  messageImageEl.classList.remove("is-visible");
  messageEl.classList.remove("is-visible");
  updateHud();
}

function loadImages() {
  return Promise.all(
    Object.entries(assets).map(
      ([key, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[key] = img;
            resolve();
          };
          img.onerror = resolve;
          img.src = src;
        }),
    ),
  );
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectHit(c, r) {
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - nx;
  const dy = c.y - ny;
  return dx * dx + dy * dy < c.r * c.r;
}

function spendOko(amount) {
  state.oko = clamp(state.oko - amount, 0, MAX_OKO);
  if (state.oko <= 0 && state.mode === "play") finishGame(false);
}

function gainOko(amount) {
  state.oko = clamp(state.oko + amount, 0, MAX_OKO);
}

function setMessage(title, text, button = "もう一度", imageKey = "", showControls = false) {
  messageEl.querySelector("h1").textContent = title;
  messageEl.querySelector("p").textContent = text;
  startButton.textContent = button;
  controlsGuideEl.hidden = !showControls;
  if (imageKey && assets[imageKey]) {
    messageImageEl.src = assets[imageKey];
    messageImageEl.classList.add("is-visible");
  } else {
    messageImageEl.classList.remove("is-visible");
  }
  messageEl.classList.add("is-visible");
}

function distanceMeters() {
  return Math.max(0, Math.floor((state.maxX - START_X) / STEP_PX));
}

function finishGame(won) {
  state.mode = won ? "win" : "lose";
  const strawberries = state.coins.filter((c) => c.got).length;
  const meters = distanceMeters();
  if (won) {
    setMessage("下校完了!", `いちご${strawberries}個 / 距離 ${meters}m / タイム ${state.elapsed.toFixed(1)} 秒`, "もう一度", "win");
  } else {
    setMessage("GAMEOVER", `GAMEOVER: オコがなくなった / 距離 ${meters}m`, "もう一度", "down");
  }
}

function jump() {
  const p = state.player;
  if (p.coyote > 0 || p.grounded) {
    p.vy = -JUMP_POWER;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
  }
}

function attack() {
  const p = state.player;
  if (p.attackCooldown > 0 || state.oko < 4) return;
  p.attackTimer = 0.24;
  p.attackCooldown = 0.36;
  p.attackCostPending = true;
  p.attackQueued = false;
}

function attackBox() {
  const p = state.player;
  const airborne = !p.grounded;
  const reach = 93;
  return {
    x: p.facing > 0 ? p.x + p.w - 8 : p.x - reach + 8,
    y: airborne ? p.y + 10 : p.y + 12,
    w: reach,
    h: airborne ? 128 : 74,
  };
}

function updateHud() {
  scoreEl.textContent = state.score;
  distanceEl.textContent = `${distanceMeters()}m`;
  okoEl.textContent = `${Math.round(state.oko)}%`;
  okoFillEl.style.width = `${state.oko}%`;
  timeEl.textContent = state.elapsed.toFixed(1);
}

function update(dt) {
  if (state.mode !== "play") return;
  state.elapsed += dt;
  spendOko(dt * 2);
  if (state.mode !== "play") {
    updateHud();
    return;
  }
  const p = state.player;

  p.vx = MOVE_SPEED;
  p.facing = 1;

  if (keys.attack) p.attackQueued = true;
  p.jumpBuffer -= dt;
  p.coyote -= dt;
  p.invuln -= dt;
  p.attackTimer -= dt;
  p.attackCooldown -= dt;

  if (p.attackQueued) attack();

  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;
  p.x = clamp(p.x, 12, WORLD_W - p.w - 12);
  state.maxX = Math.max(state.maxX, p.x);

  p.y += p.vy * dt;
  p.grounded = false;
  for (const plat of state.platforms) {
    if (plat.x > p.x + 120 || plat.x + plat.w < p.x - 80) continue;
    const wasAbove = p.y + p.h - p.vy * dt <= plat.y + 4;
    if (rectsOverlap(p, plat) && p.vy >= 0 && wasAbove) {
      p.y = plat.y - p.h;
      p.vy = 0;
      p.grounded = true;
      p.coyote = 0.08;
    }
  }
  if (p.jumpBuffer > 0) jump();

  if (p.y > H + 170) {
    p.x = Math.max(START_X, cameraX + 120);
    p.y = 180;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.1;
    spendOko(125);
    if (state.mode !== "play") {
      updateHud();
      return;
    }
  }

  for (const coin of state.coins) {
    if (!coin.got && Math.abs(coin.x - p.x) < 140 && circleRectHit(coin, p)) {
      coin.got = true;
      state.score += 1;
      gainOko(6);
    }
  }

  const activeAttack = p.attackTimer > 0 ? attackBox() : null;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    updateEnemy(enemy, dt, p);
    if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
    enemy.hitFlash -= dt;
    const enemyY = currentEnemyY(enemy);
    const hitbox = enemyHitbox(enemy, enemyY);

    if (activeAttack && rectsOverlap(activeAttack, hitbox)) {
      enemy.alive = false;
      p.attackCostPending = false;
      state.score += 2;
      gainOko(4);
      continue;
    }

    if (p.invuln <= 0 && rectsOverlap(p, hitbox)) {
      spendOko(40);
      p.vx = -p.facing * 250;
      p.vy = -520;
      p.invuln = 1;
      enemy.hitFlash = 0.25;
      if (state.mode !== "play") {
        updateHud();
        return;
      }
    }
  }

  if (p.attackCostPending && p.attackTimer <= 0) {
    spendOko(3);
    p.attackCostPending = false;
    if (state.mode !== "play") {
      updateHud();
      return;
    }
  }

  if (rectsOverlap(p, state.goal)) finishGame(true);
  cameraX = clamp(p.x - W * 0.38, 0, WORLD_W - W);
  updateHud();
}

function drawSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#79c9ec");
  grd.addColorStop(0.62, "#eef8e4");
  grd.addColorStop(1, "#80bf72");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-cameraX * 0.22, 0);
  for (let i = 0; i < 72; i += 1) {
    const x = 140 + i * 430;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.beginPath();
    ctx.ellipse(x, 88 + (i % 2) * 42, 62, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 46, 86 + (i % 2) * 42, 46, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 48, 92 + (i % 2) * 42, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-cameraX * 0.45, 0);
  ctx.fillStyle = "#63a369";
  for (let i = 0; i < 70; i += 1) {
    const x = -240 + i * 500;
    ctx.beginPath();
    ctx.moveTo(x, 488);
    ctx.lineTo(x + 250, 170 + (i % 3) * 42);
    ctx.lineTo(x + 520, 488);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPlatform(p) {
  const x = Math.round(p.x - cameraX);
  ctx.fillStyle = "#3e2b21";
  ctx.fillRect(x, p.y, p.w, p.h);
  ctx.fillStyle = "#5fb95e";
  ctx.fillRect(x, p.y, p.w, 13);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 8; i < p.w; i += 38) {
    ctx.fillRect(x + i, p.y + 3, 18, 4);
  }
}

function drawCoin(c, t) {
  if (c.got) return;
  const x = c.x - cameraX;
  const y = c.y + Math.sin(t * 6 + c.x) * 4;
  ctx.fillStyle = "#e9313f";
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.bezierCurveTo(x - 24, y + 4, x - 17, y - 18, x, y - 8);
  ctx.bezierCurveTo(x + 17, y - 18, x + 24, y + 4, x, y + 18);
  ctx.fill();
  ctx.fillStyle = "#ffdf8a";
  for (let i = 0; i < 7; i += 1) {
    const sx = x - 9 + (i % 3) * 9;
    const sy = y - 1 + Math.floor(i / 3) * 7;
    ctx.fillRect(sx, sy, 2, 3);
  }
  ctx.fillStyle = "#2d8f4f";
  ctx.beginPath();
  ctx.ellipse(x - 5, y - 12, 8, 4, -0.35, 0, Math.PI * 2);
  ctx.ellipse(x + 5, y - 12, 8, 4, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function currentEnemyY(e) {
  if (e.type === "hopper") return e.baseY - Math.abs(Math.sin(state.elapsed * 3.8 + e.phase)) * 62;
  if (e.type === "floater") return e.baseY - 78 + Math.sin(state.elapsed * 2.1 + e.phase) * 38;
  return e.baseY;
}

function enemyHitbox(e, y = currentEnemyY(e)) {
  if (e.type === "floater") return { x: e.x - 30, y: y - 34, w: 60, h: 40 };
  if (e.type === "runner") return { x: e.x - 30, y: y - 34, w: 60, h: 34 };
  if (e.type === "charger") return { x: e.x - 32, y: y - 40, w: 64, h: 42 };
  return { x: e.x - 24, y: y - 38, w: 48, h: 38 };
}

function updateEnemy(enemy, dt, player) {
  if (enemy.type === "charger") {
    const playerCenter = player.x + player.w / 2;
    const close = Math.abs(playerCenter - enemy.x) < 320 && Math.abs(player.y - enemy.baseY) < 150;
    if (close) enemy.dir = playerCenter > enemy.x ? 1 : -1;
    enemy.x += enemy.speed * (close ? 2.35 : 0.65) * enemy.dir * dt;
  } else {
    enemy.x += enemy.speed * enemy.dir * dt;
  }

  if (enemy.x < enemy.min) {
    enemy.x = enemy.min;
    enemy.dir = 1;
  }
  if (enemy.x > enemy.max) {
    enemy.x = enemy.max;
    enemy.dir = -1;
  }
}

function drawSpikes(x, y, width, count) {
  ctx.fillStyle = "#242020";
  const spacing = width / count;
  for (let i = 0; i < count; i += 1) {
    const sx = x - width / 2 + spacing * i + spacing / 2;
    ctx.beginPath();
    ctx.moveTo(sx - spacing * 0.38, y);
    ctx.lineTo(sx, y - 22);
    ctx.lineTo(sx + spacing * 0.38, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i += 1) {
    const sx = x - width / 2 + spacing * i + spacing / 2;
    ctx.beginPath();
    ctx.moveTo(sx, y - 17);
    ctx.lineTo(sx + spacing * 0.18, y - 3);
    ctx.stroke();
  }
}

function drawEnemy(e, t) {
  if (!e.alive) return;
  const x = e.x - cameraX;
  const y = currentEnemyY(e) + Math.sin(t * 4 + e.x) * 5;
  const color =
    e.hitFlash > 0
      ? "#f46f55"
      : {
          walker: "rgba(52,48,48,0.95)",
          hopper: "#594287",
          runner: "#2f596f",
          floater: "#6f6a34",
          charger: "#7a3030",
        }[e.type] || "rgba(52,48,48,0.95)";
  ctx.fillStyle = color;
  ctx.beginPath();
  if (e.type === "floater") {
    drawSpikes(x, y - 18, 74, 5);
    ctx.ellipse(x, y, 38, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 26, y + 2, 22, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26, y + 2, 22, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - 16, y - 18, 16, 0.2, 2.9);
    ctx.arc(x + 16, y - 18, 16, 0.2, 2.9);
    ctx.stroke();
  } else {
    const scaleX = e.type === "runner" ? 1.24 : e.type === "charger" ? 1.34 : 1;
    const scaleY = e.type === "hopper" ? 1.12 : 1;
    drawSpikes(x, y - 18 * scaleY, 62 * scaleX, e.type === "charger" ? 6 : 5);
    ctx.ellipse(x, y, 34 * scaleX, 22 * scaleY, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 24 * scaleX, y + 4, 24, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 24 * scaleX, y + 4, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f4473d";
  ctx.fillRect(x - 17, y - 6, 10, 5);
  ctx.fillRect(x + 8, y - 6, 10, 5);
  if (e.type === "charger") {
    ctx.fillStyle = "#ffd55b";
    ctx.beginPath();
    ctx.moveTo(x + e.dir * 42, y - 4);
    ctx.lineTo(x + e.dir * 62, y + 4);
    ctx.lineTo(x + e.dir * 42, y + 12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGoal(goal) {
  const x = goal.x - cameraX;
  const y = goal.y;
  ctx.fillStyle = "#8b4c31";
  ctx.fillRect(x + 24, y + 54, 142, 76);
  ctx.fillStyle = "#d9553f";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 58);
  ctx.lineTo(x + 95, y);
  ctx.lineTo(x + 182, y + 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f6e7c8";
  ctx.fillRect(x + 78, y + 78, 36, 52);
  ctx.fillStyle = "#3b2a22";
  ctx.fillRect(x + 104, y + 104, 5, 5);
  ctx.fillStyle = "#8fd5ee";
  ctx.fillRect(x + 42, y + 72, 28, 24);
  ctx.fillRect(x + 124, y + 72, 28, 24);
  ctx.strokeStyle = "#3b2a22";
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 24, y + 54, 142, 76);
  ctx.strokeRect(x + 78, y + 78, 36, 52);
}

function drawAttackArc() {
  const p = state.player;
  if (p.attackTimer <= 0) return;
  const box = attackBox();
  const x = box.x - cameraX + box.w / 2;
  const y = box.y + (p.grounded ? box.h / 2 : box.h * 0.42);
  ctx.save();
  ctx.globalAlpha = 0.76;
  ctx.strokeStyle = "#89e3ff";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(x, y, 52, p.facing > 0 ? -0.85 : 2.3, p.facing > 0 ? 0.85 : 3.95);
  ctx.stroke();
  if (!p.grounded) {
    ctx.beginPath();
    ctx.arc(x, y + 38, 44, p.facing > 0 ? 0.15 : 2.95, p.facing > 0 ? 1.55 : 4.35);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 68, p.facing > 0 ? -0.55 : 2.6, p.facing > 0 ? 0.62 : 3.7);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(t) {
  const p = state.player;
  const moving = Math.abs(p.vx) > 80;
  const attacking = p.attackTimer > 0;
  const key = attacking ? "attackAir" : !p.grounded ? "jump" : moving ? (Math.floor(t * 10) % 2 ? "runA" : "runB") : "idle";
  const img = images[key] || images.idle;
  const bob = p.grounded && moving && !attacking ? Math.sin(t * 18) * 3 : 0;
  const alpha = p.invuln > 0 && Math.floor(t * 18) % 2 === 0 ? 0.55 : 1;
  const drawW = attacking ? 150 : 120;
  const drawH = attacking ? 130 : 104;
  const x = p.x - cameraX + p.w / 2;
  const y = p.y + p.h - drawH + bob;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(attacking ? -p.facing : p.facing, 1);
  ctx.drawImage(img, -drawW / 2, 0, drawW, drawH);
  if (state.oko < 30 && images.anger) {
    ctx.drawImage(images.anger, -60, -34, 44, 66);
  }
  ctx.restore();
}

function draw() {
  const t = performance.now() / 1000;
  drawSky();
  ctx.save();
  state.platforms.filter((p) => p.x < cameraX + W + 80 && p.x + p.w > cameraX - 80).forEach(drawPlatform);
  state.coins.filter((c) => c.x > cameraX - 80 && c.x < cameraX + W + 80).forEach((c) => drawCoin(c, t));
  state.enemies.filter((e) => e.x > cameraX - 120 && e.x < cameraX + W + 120).forEach((e) => drawEnemy(e, t));
  drawGoal(state.goal);
  drawAttackArc();
  drawPlayer(t);
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000 || 0);
  lastT = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function setKey(name, value) {
  keys[name] = value;
}

function pressJump() {
  if (state.mode !== "play") return;
  keys.jump = true;
  state.player.jumpBuffer = 0.12;
}

function releaseJump() {
  keys.jump = false;
}

function isPortraitMobile() {
  return window.matchMedia("(max-width: 760px) and (orientation: portrait)").matches;
}

function tryStartGame() {
  if (isPortraitMobile()) return;
  document.documentElement.requestFullscreen?.().catch?.(() => {});
  document.documentElement.webkitRequestFullscreen?.();
  resetGame();
}

window.addEventListener("keydown", (event) => {
  if (messageEl.classList.contains("is-visible") && ["Enter", "Space"].includes(event.code)) {
    tryStartGame();
    event.preventDefault();
    return;
  }

  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
    if (!event.repeat) pressJump();
    event.preventDefault();
  }
  if (["KeyX", "KeyK", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    setKey("attack", true);
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) releaseJump();
  if (["KeyX", "KeyK", "ShiftLeft", "ShiftRight"].includes(event.code)) setKey("attack", false);
});

document.querySelectorAll("[data-hold]").forEach((button) => {
  const name = button.dataset.hold;
  const on = (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    if (name === "jump") pressJump();
    else setKey(name, true);
  };
  const off = (event) => {
    event.preventDefault();
    if (name === "jump") releaseJump();
    else setKey(name, false);
  };
  button.addEventListener("pointerdown", on);
  button.addEventListener("pointerup", off);
  button.addEventListener("pointercancel", off);
  button.addEventListener("pointerleave", off);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("selectstart", (event) => event.preventDefault());
});

document.querySelectorAll("[data-tap]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setKey(button.dataset.tap, true);
  });
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    setKey(button.dataset.tap, false);
  });
  button.addEventListener("pointercancel", () => setKey(button.dataset.tap, false));
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("selectstart", (event) => event.preventDefault());
});

startButton.addEventListener("click", tryStartGame);

loadImages().then(() => {
  resetGame();
  state.mode = "title";
  setMessage("スーパーしずオ", "オコを燃やして家まで下校しよう。いちごを食べるとオコが回復するぞ！", "スタート", "", true);
  requestAnimationFrame(frame);
});
