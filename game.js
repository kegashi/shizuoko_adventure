const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const distanceEl = document.querySelector("#distance");
const okoEl = document.querySelector("#rage");
const okoFillEl = document.querySelector("#okoFill");
const okoPanelEl = document.querySelector(".oko-panel");
const timeEl = document.querySelector("#time");
const messageEl = document.querySelector("#message");
const messageImageEl = document.querySelector("#messageImage");
const messageTextEl = messageEl.querySelector("p");
const controlsGuideEl = document.querySelector(".controls-guide");
const stageSelectEl = document.querySelector("#stageSelect");
const recordPanelEl = document.querySelector("#recordPanel");
const startButton = document.querySelector("#startButton");

const W = 960;
const H = 540;
const GRAVITY = 2100;
const MOVE_SPEED = 430;
const JUMP_POWER = 820;
const MAX_OKO = 100;
const START_OKO = 70;
const START_X = 86;
const STEP_PX = 82;
const RECORD_KEY = "superShizuoRecords";

const STAGES = [
  {
    id: 1,
    name: "ステージ1",
    worldW: 22000,
    loops: 36,
    gapBase: 98,
    gapStep: 24,
    widthBase: 330,
    widthStep: 36,
    enemyModulo: 3,
    enemyStart: 5,
    enemySpeed: 0.78,
    enemyTypes: ["walker", "hopper", "runner"],
    highCoinModulo: 7,
  },
  {
    id: 2,
    name: "ステージ2",
    worldW: 31000,
    loops: 53,
    gapBase: 120,
    gapStep: 36,
    widthBase: 270,
    widthStep: 42,
    enemyModulo: 2,
    enemyStart: 3,
    enemySpeed: 1,
    enemyTypes: ["walker", "hopper", "runner", "floater", "charger"],
    highCoinModulo: 6,
  },
  {
    id: 3,
    name: "ステージ3",
    worldW: 40000,
    loops: 68,
    gapBase: 144,
    gapStep: 42,
    widthBase: 250,
    widthStep: 36,
    enemyModulo: 2,
    enemyStart: 2,
    enemySpeed: 1.22,
    enemyTypes: ["walker", "hopper", "runner", "floater", "charger", "squad", "armored"],
    highCoinModulo: 8,
  },
];

let currentStageId = 2;

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

function getStage(stageId = currentStageId) {
  return STAGES.find((stage) => stage.id === stageId) || STAGES[1];
}

function finalPlatformWidth(stage) {
  return stage.id === 3 ? 1750 : 1600;
}

function goalXForStage(stage) {
  if (stage.id !== 3) return stage.worldW - 310;
  return stage.worldW - finalPlatformWidth(stage) + STEP_PX * 5;
}

function createEnemy(type, x, y, width, i, stage, offset = 0, variant = 0) {
  return {
    x: x + width * 0.55 + offset,
    y: y - 10,
    baseY: y - 10,
    min: x + 44,
    max: x + width - 44,
    speed: (type === "runner" ? 132 + (i % 4) * 16 : 76 + (i % 6) * 13) * stage.enemySpeed,
    dir: i % 4 === 0 ? -1 : 1,
    type,
    phase: i * 0.73 + offset * 0.01,
    variant,
    vy: 0,
    falling: false,
    armorHits: 0,
    armorStun: 0,
    armorContactGrace: 0,
    alive: true,
    hitFlash: 0,
  };
}

function buildLevel(stage) {
  const platforms = [{ x: 0, y: 486, w: 2100, h: 74 }];
  const coins = [];
  const enemies = [];
  let x = 2040;
  let y = 440;

  for (let i = 0; i < stage.loops; i += 1) {
    const gap = stage.gapBase + (i % 4) * stage.gapStep;
    const width = stage.widthBase + (i % 5) * stage.widthStep;
    y = clamp(y + [-56, 38, -22, 54, -40, 18][i % 6], 286, 474);
    x += gap;
    const lowerPlatformWidth = stage.id === 3 && i === 9 ? width * 0.58 : width;
    platforms.push({ x, y, w: lowerPlatformWidth, h: i % 7 === 0 ? 42 : 34 });

    if (i % 3 === 0) {
      platforms.push({
        x: x + width * 0.35,
        y: clamp(y - 122, 190, 356),
        w: 180 + (i % 2) * 50,
        h: 28,
      });
    }

    if (i % 2 === 0) coins.push({ x: x + width * 0.42, y: y - 42, r: 16, got: false });
    if (i % stage.highCoinModulo === 0) {
      const hasUpperPlatform = i % 3 === 0;
      const needsHighCoinAssist = stage.id === 3 && !hasUpperPlatform;
      const highCoinY = needsHighCoinAssist ? y - 120 : y - 160;
      const highCoinX = needsHighCoinAssist ? x + width * 0.9 : x + width * 0.5;

      coins.push({ x: highCoinX, y: clamp(highCoinY, 150, 380), r: 16, got: false });
    }

    if (i > stage.enemyStart && i % stage.enemyModulo === 0) {
      const type = stage.enemyTypes[i % stage.enemyTypes.length];
      if (type === "squad") {
        const count = 2;
        for (let n = 0; n < count; n += 1) {
          enemies.push(createEnemy("squad", x, y, width, i, stage, (n - (count - 1) / 2) * 86, n));
        }
      } else {
        enemies.push(createEnemy(type, x, y, width, i, stage));
      }
    }

    x += width;
  }

  const finishWidth = finalPlatformWidth(stage);
  const goalX = goalXForStage(stage);
  platforms.push({ x: stage.worldW - finishWidth, y: 486, w: finishWidth, h: 74 });
  coins.push({ x: stage.id === 3 ? goalX - 180 : stage.worldW - 980, y: 444, r: 16, got: false });

  return { platforms, coins, enemies };
}

function debugStartMeters() {
  const meters = Number(new URLSearchParams(window.location.search).get("m"));
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return meters;
}

function groundYAt(x) {
  const nearby = state.platforms
    .filter((platform) => x + state.player.w > platform.x && x < platform.x + platform.w)
    .sort((a, b) => a.y - b.y);
  return nearby[0]?.y ?? 486;
}

function applyDebugStart() {
  const meters = debugStartMeters();
  if (!meters) return;
  const p = state.player;
  const safeMaxX = state.goal.x - p.w - 160;
  p.x = clamp(START_X + meters * STEP_PX, START_X, safeMaxX);
  p.y = groundYAt(p.x) - p.h;
  p.vx = 0;
  p.vy = 0;
  p.grounded = true;
  state.maxX = p.x;
  cameraX = clamp(p.x - W * 0.38, 0, state.worldW - W);
}

function resetGame() {
  const stage = getStage();
  const level = buildLevel(stage);
  state = {
    mode: "play",
    stageId: stage.id,
    stageName: stage.name,
    worldW: stage.worldW,
    elapsed: 0,
    strawberries: 0,
    damageHits: 0,
    attackWhiffs: 0,
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
      attackHitThisSwing: false,
      damageFlash: 0,
    },
    platforms: level.platforms,
    coins: level.coins,
    totalStrawberries: level.coins.length,
    enemies: level.enemies,
    goal: { x: goalXForStage(stage), y: 356, w: 190, h: 130 },
  };
  cameraX = 0;
  applyDebugStart();
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

function setMessage(title, text, button = "もう一度", imageKey = "", showControls = false, showStageMenu = false) {
  messageEl.querySelector("h1").textContent = title;
  messageTextEl.classList.toggle("result-lines", Array.isArray(text));
  if (Array.isArray(text)) {
    messageTextEl.replaceChildren(...text.map((line) => Object.assign(document.createElement("span"), { textContent: line })));
  } else {
    messageTextEl.textContent = text;
  }
  startButton.textContent = button;
  controlsGuideEl.hidden = !showControls;
  stageSelectEl.hidden = !showStageMenu;
  recordPanelEl.hidden = !showStageMenu;
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

function totalDistanceMeters() {
  return Math.max(1, Math.floor((state.goal.x - START_X) / STEP_PX));
}

function calculateScore() {
  return (
    distanceMeters() * 100 +
    state.strawberries * 500 -
    state.damageHits * 5000 -
    state.attackWhiffs * 500
  );
}

function readRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORD_KEY)) || {};
  } catch {
    return {};
  }
}

function writeRecords(records) {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(records));
  } catch {
    // 記録保存に失敗してもゲーム本体は続行する。
  }
}

function saveRecord(won) {
  const records = readRecords();
  const key = String(state.stageId);
  const current = records[key] || {};
  const meters = distanceMeters();
  const next = {
    completed: Boolean(current.completed || won),
    bestDistance: Math.max(current.bestDistance || 0, meters),
    bestScore: current.bestScore ?? null,
  };
  if (won) next.bestScore = Math.max(current.bestScore ?? -Infinity, calculateScore());
  records[key] = next;
  writeRecords(records);
}

function perfectMark(perfect) {
  return perfect ? " ★" : "";
}

function renderStageSelect() {
  stageSelectEl.replaceChildren(
    ...STAGES.map((stage) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.stageId = String(stage.id);
      button.classList.toggle("is-selected", stage.id === currentStageId);
      button.textContent = `${stage.name}${stage.id === 1 ? " かんたん" : stage.id === 3 ? " むずかしい" : " ふつう"}`;
      return button;
    }),
  );
}

function renderRecordPanel() {
  const records = readRecords();
  recordPanelEl.replaceChildren(
    ...STAGES.map((stage) => {
      const row = document.createElement("div");
      const label = document.createElement("strong");
      const value = document.createElement("span");
      const record = records[String(stage.id)];
      label.textContent = stage.name;
      if (!record) value.textContent = "未挑戦";
      else if (record.completed) value.textContent = `最高スコア ${record.bestScore}`;
      else value.textContent = `最高距離 ${record.bestDistance || 0}m`;
      row.append(label, value);
      return row;
    }),
  );
}

function renderTitle() {
  renderStageSelect();
  renderRecordPanel();
  setMessage(
    "スーパーしずオコ",
    "オコを燃やして下校しよう。いちごを食べるとオコが回復するヨン！",
    "スタート",
    "",
    true,
    true,
  );
}

function finishGame(won) {
  state.mode = won ? "win" : "lose";
  saveRecord(won);
  const strawberries = state.strawberries;
  const meters = distanceMeters();
  if (won) {
    setMessage(
      "無事帰宅!",
      [
        `スコア ${calculateScore()}`,
        `いちご ${strawberries}/${state.totalStrawberries}${perfectMark(strawberries === state.totalStrawberries)}`,
        `敵からダメージ ${state.damageHits}回${perfectMark(state.damageHits === 0)}`,
        `アタック空振り ${state.attackWhiffs}回${perfectMark(state.attackWhiffs === 0)}`,
      ],
      "もう一度",
      "win",
    );
  } else {
    setMessage("GAMEOVER", ["GAMEOVER:", `オコがなくなった / 距離 ${meters}/${totalDistanceMeters()}m`], "もう一度", "down");
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
  p.attackHitThisSwing = false;
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
  scoreEl.textContent = state.strawberries;
  distanceEl.textContent = `${distanceMeters()}/${totalDistanceMeters()}m`;
  okoEl.textContent = `${Math.round(state.oko)}%`;
  okoFillEl.style.width = `${state.oko}%`;
  okoPanelEl.classList.toggle("is-damage", state.player.damageFlash > 0);
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

  p.jumpBuffer -= dt;
  p.coyote -= dt;
  p.invuln -= dt;
  p.damageFlash -= dt;
  p.attackTimer -= dt;
  p.attackCooldown -= dt;

  if (p.attackQueued) attack();

  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;
  p.x = clamp(p.x, 12, state.worldW - p.w - 12);
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
      state.strawberries += 1;
      gainOko(6);
    }
  }

  const activeAttack = p.attackTimer > 0 && !p.attackHitThisSwing ? attackBox() : null;
  let attackTarget = null;
  let attackTargetDistance = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    updateEnemy(enemy, dt, p);
    if (!enemy.alive) continue;
    if (enemy.falling) continue;
    if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
    enemy.hitFlash -= dt;
    const enemyY = currentEnemyY(enemy);
    const hitbox = enemyHitbox(enemy, enemyY);

    if (activeAttack && rectsOverlap(activeAttack, hitbox)) {
      const distance = Math.abs(enemy.x - (p.x + p.w / 2));
      if (distance < attackTargetDistance) {
        attackTarget = enemy;
        attackTargetDistance = distance;
      }
    }

    if (p.invuln <= 0 && rectsOverlap(p, hitbox)) {
      if (enemy.type === "armored" && enemy.armorContactGrace > 0) continue;
      state.damageHits += 1;
      spendOko(50);
      p.vx = -p.facing * 250;
      p.vy = -400;
      p.invuln = 1;
      p.damageFlash = 1;
      enemy.hitFlash = 0.25;
      if (state.mode !== "play") {
        updateHud();
        return;
      }
    }
  }

  if (attackTarget) {
    p.attackHitThisSwing = true;
    p.attackCostPending = false;
    p.attackCooldown = Math.min(p.attackCooldown, 0.18);
    if (attackTarget.type === "armored") {
      const nextArmorHits = attackTarget.armorHits + 1;
      const knockback = nextArmorHits % 3 === 0 ? 195 : 65;
      attackTarget.x += p.facing * knockback;
      attackTarget.dir = p.facing;
      attackTarget.hitFlash = 0.22;
      attackTarget.armorHits = nextArmorHits;
      attackTarget.armorStun = 0.62;
      attackTarget.armorContactGrace = 0.16;
      if (attackTarget.x < attackTarget.min || attackTarget.x > attackTarget.max) {
        if (attackTarget.armorHits >= 2) {
          attackTarget.falling = true;
          attackTarget.y = currentEnemyY(attackTarget);
          attackTarget.vy = -110;
        } else {
          attackTarget.x = clamp(attackTarget.x, attackTarget.min + 8, attackTarget.max - 8);
        }
      }
    } else {
      attackTarget.alive = false;
      gainOko(4);
    }
  }

  if (p.attackCostPending && p.attackTimer <= 0) {
    state.attackWhiffs += 1;
    spendOko(3);
    p.attackCostPending = false;
    if (state.mode !== "play") {
      updateHud();
      return;
    }
  }

  if (rectsOverlap(p, state.goal)) finishGame(true);
  cameraX = clamp(p.x - W * 0.38, 0, state.worldW - W);
  updateHud();
}

function drawStageOneSky() {
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

function drawJungleSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#5ab7c5");
  grd.addColorStop(0.48, "#b9e6b4");
  grd.addColorStop(1, "#3c7d45");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-cameraX * 0.18, 0);
  for (let i = 0; i < 58; i += 1) {
    const x = -120 + i * 260;
    const h = 210 + (i % 4) * 42;
    ctx.fillStyle = i % 2 ? "#2f7c4c" : "#25643f";
    ctx.fillRect(x + 22, H - h, 34, h);
    ctx.beginPath();
    ctx.ellipse(x + 38, H - h + 20, 98, 54, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 12, H - h + 74, 72, 46, -0.25, 0, Math.PI * 2);
    ctx.ellipse(x + 82, H - h + 78, 78, 48, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-cameraX * 0.42, 0);
  ctx.strokeStyle = "rgba(45,82,39,0.68)";
  ctx.lineWidth = 12;
  for (let i = 0; i < 44; i += 1) {
    const x = -180 + i * 360;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 90, 120, x - 80, 230, x + 70, 390);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVolcanoSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#3b2630");
  grd.addColorStop(0.52, "#a54d35");
  grd.addColorStop(1, "#2f2521");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-cameraX * 0.22, 0);
  for (let i = 0; i < 50; i += 1) {
    const x = -260 + i * 560;
    ctx.fillStyle = i % 2 ? "#4a3532" : "#372927";
    ctx.beginPath();
    ctx.moveTo(x, 488);
    ctx.lineTo(x + 250, 180 + (i % 3) * 34);
    ctx.lineTo(x + 510, 488);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff6b2f";
    ctx.beginPath();
    ctx.moveTo(x + 220, 216 + (i % 3) * 34);
    ctx.lineTo(x + 250, 180 + (i % 3) * 34);
    ctx.lineTo(x + 286, 216 + (i % 3) * 34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-cameraX * 0.5, 0);
  ctx.fillStyle = "rgba(255,92,36,0.42)";
  for (let i = 0; i < 60; i += 1) {
    const x = -100 + i * 320;
    ctx.fillRect(x, 498 + (i % 2) * 12, 220, 10);
  }
  ctx.restore();
}

function drawSky() {
  if (state.stageId === 2) drawJungleSky();
  else if (state.stageId === 3) drawVolcanoSky();
  else drawStageOneSky();
}

function drawPlatform(p) {
  const x = Math.round(p.x - cameraX);
  const dirtColor = state.stageId === 2 ? "#2f3320" : state.stageId === 3 ? "#2f2521" : "#3e2b21";
  const topColor = state.stageId === 2 ? "#3f9b46" : state.stageId === 3 ? "#7c3b2f" : "#5fb95e";
  ctx.fillStyle = dirtColor;
  ctx.fillRect(x, p.y, p.w, p.h);
  ctx.fillStyle = topColor;
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
  if (e.falling) return e.y;
  if (e.type === "hopper") return e.baseY - Math.abs(Math.sin(state.elapsed * 3.8 + e.phase)) * 62;
  if (e.type === "floater") return e.baseY - 78 + Math.sin(state.elapsed * 2.1 + e.phase) * 38;
  return e.baseY;
}

function enemyHitbox(e, y = currentEnemyY(e)) {
  if (e.type === "floater") return { x: e.x - 30, y: y - 34, w: 60, h: 40 };
  if (e.type === "runner") return { x: e.x - 30, y: y - 34, w: 60, h: 34 };
  if (e.type === "charger") return { x: e.x - 32, y: y - 40, w: 64, h: 42 };
  if (e.type === "armored") return { x: e.x - 34, y: y - 42, w: 68, h: 44 };
  if (e.type === "squad") return { x: e.x - 22, y: y - 34, w: 44, h: 34 };
  return { x: e.x - 24, y: y - 38, w: 48, h: 38 };
}

function updateEnemy(enemy, dt, player) {
  if (enemy.falling) {
    enemy.vy += GRAVITY * dt;
    enemy.y += enemy.vy * dt;
    enemy.x += enemy.dir * 90 * dt;
    if (enemy.y > H + 120) enemy.alive = false;
    return;
  }

  enemy.armorStun -= dt;
  enemy.armorContactGrace -= dt;
  if (enemy.armorStun > 0) return;

  if (enemy.type === "armored") {
    enemy.x += enemy.speed * 0.48 * enemy.dir * dt;
  } else if (enemy.type === "charger") {
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
          squad: ["#554039", "#6b4b2d", "#3f5f55"][e.variant % 3],
          armored: "#465064",
        }[e.type] || "rgba(52,48,48,0.95)";
  ctx.fillStyle = color;
  ctx.beginPath();
  if (e.type === "armored") {
    drawSpikes(x, y - 23, 72, 6);
    ctx.ellipse(x, y, 42, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ba5ad";
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 32, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#56606d";
    ctx.fillRect(x - 34, y - 8, 68, 15);
    ctx.fillStyle = "#f0d15a";
    ctx.fillRect(x - 5, y - 25, 10, 12);
  } else if (e.type === "floater") {
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
    const scaleY = e.type === "hopper" ? 1.12 : e.type === "squad" ? 0.88 : 1;
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
  const running = key === "runA" || key === "runB";
  const bob = p.grounded && moving && !attacking ? Math.sin(t * 18) * 3 : 0;
  const alpha = p.invuln > 0 && Math.floor(t * 18) % 2 === 0 ? 0.55 : 1;
  const drawW = attacking ? 150 : 120;
  const drawH = attacking ? 130 : 104;
  const x = p.x - cameraX + p.w / 2;
  const y = p.y + p.h - drawH + bob;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(attacking || running ? -p.facing : p.facing, 1);
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

function pressAttack() {
  if (state.mode !== "play") return;
  state.player.attackQueued = true;
}

function shouldIgnoreScreenAction(event) {
  return Boolean(event.target.closest("button, a, input, textarea, select, .touch-controls, .message"));
}

function isTouchScreenInput(event) {
  return event.pointerType === "touch" || navigator.maxTouchPoints > 0;
}

function preventTouchBrowserGesture(event) {
  if (navigator.maxTouchPoints > 0) event.preventDefault();
}

function tryStartGame() {
  if (navigator.maxTouchPoints > 0) {
    document.documentElement.requestFullscreen?.().catch?.(() => {});
    document.documentElement.webkitRequestFullscreen?.();
  }
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
    if (!event.repeat) pressAttack();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) releaseJump();
});

["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
  document.addEventListener(type, preventTouchBrowserGesture, { passive: false });
});

document.addEventListener("dblclick", preventTouchBrowserGesture, { passive: false });
document.addEventListener("contextmenu", preventTouchBrowserGesture);
document.addEventListener("selectstart", preventTouchBrowserGesture);

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
    if (button.dataset.tap === "attack") pressAttack();
    else setKey(button.dataset.tap, true);
  });
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("selectstart", (event) => event.preventDefault());
});

window.addEventListener(
  "pointerdown",
  (event) => {
    if (state.mode !== "play" || !isTouchScreenInput(event) || shouldIgnoreScreenAction(event)) return;
    event.preventDefault();
    if (event.clientX < window.innerWidth / 2) pressJump();
    else pressAttack();
  },
  { passive: false },
);

startButton.addEventListener("click", tryStartGame);

stageSelectEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-stage-id]");
  if (!button) return;
  currentStageId = Number(button.dataset.stageId);
  renderTitle();
});

loadImages().then(() => {
  resetGame();
  state.mode = "title";
  renderTitle();
  requestAnimationFrame(frame);
});
