(() => {
  "use strict";

  // =========================
  // Canvas / Context
  // =========================
  /** @type {HTMLCanvasElement} */
  const canv = document.getElementById("gameCanvas");
  /** @type {CanvasRenderingContext2D} */
  const ctx = canv.getContext("2d");

  // =========================
  // UI Elements
  // =========================
  const overlay = document.getElementById("overlay");
  const panelMenu = document.getElementById("panelMenu");
  const panelPause = document.getElementById("panelPause");
  const panelGameOver = document.getElementById("panelGameOver");
  const panelSettings = document.getElementById("panelSettings");

  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnSettings = document.getElementById("btnSettings");

  const selMode = document.getElementById("selMode");
  const selDiff = document.getElementById("selDiff");
  const btnPlay = document.getElementById("btnPlay");
  const btnShowLeaderboard = document.getElementById("btnShowLeaderboard");
  const leaderboard = document.getElementById("leaderboard");
  const leaderboardList = document.getElementById("leaderboardList");
  const leaderboardList2 = document.getElementById("leaderboardList2");

  const btnResume = document.getElementById("btnResume");
  const btnRestart = document.getElementById("btnRestart");
  const btnQuit = document.getElementById("btnQuit");

  const btnAgain = document.getElementById("btnAgain");
  const btnBackMenu = document.getElementById("btnBackMenu");
  const gameOverTitle = document.getElementById("gameOverTitle");
  const gameOverStats = document.getElementById("gameOverStats");

  const chkMusic = document.getElementById("chkMusic");
  const chkSfx = document.getElementById("chkSfx");
  const rngMusic = document.getElementById("rngMusic");
  const rngSfx = document.getElementById("rngSfx");
  const chkReduceFlashes = document.getElementById("chkReduceFlashes");
  const chkTouch = document.getElementById("chkTouch");
  const btnCloseSettings = document.getElementById("btnCloseSettings");

  const hudMode = document.getElementById("hudMode");
  const hudDiff = document.getElementById("hudDiff");
  const powerbar = document.getElementById("powerbar");

  const touch = document.getElementById("touch");
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const btnThrust = document.getElementById("btnThrust");
  const btnFire = document.getElementById("btnFire");

  // =========================
  // Core timing
  // =========================
  const FPS = 30;
  const DT = 1 / FPS;

  // =========================
  // Gameplay base constants (ajustáveis)
  // =========================
  const BASE = {
    SHIP_SIZE: 30,
    ROID_SIZE: 100,
    ROIDS_JAG: 0.4,
    ROIDS_VERT: 10,
    LASER_SPD: 540,
    LASER_DIST: 0.62,
    LASER_MAX: 12,
    TURN_SPEED_DEG: 360,
    SHIP_BLINK_DUR: 0.11,
    SHIP_INV_DUR: 2.6,
    SHIP_EXPLODE_DUR: 0.35,
    LASER_EXPLODE_DUR: 0.12,
  };

  const MODES = {
    classic: { label: "CLASSIC", timeLimit: null },
    time_attack: { label: "TIME", timeLimit: 120 },
    one_life: { label: "1LIFE", timeLimit: null },
    endless: { label: "ENDLESS", timeLimit: null },
  };

  const DIFFS = {
    easy: {
      label: "EASY",
      lives: 4,
      roidSpeed: 42,
      thrust: 4.6,
      friction: 0.86,
      maxSpeed: 6.4,
      ufoRate: 0.75,
    },
    normal: {
      label: "NORMAL",
      lives: 3,
      roidSpeed: 52,
      thrust: 5.0,
      friction: 0.82,
      maxSpeed: 7.2,
      ufoRate: 1.0,
    },
    hard: {
      label: "HARD",
      lives: 2,
      roidSpeed: 64,
      thrust: 5.3,
      friction: 0.78,
      maxSpeed: 8.1,
      ufoRate: 1.25,
    },
  };

  // =========================
  // Settings (mutáveis)
  // =========================
  const settings = {
    mode: "classic",
    difficulty: "normal",
    musicOn: true,
    sfxOn: true,
    musicVolume: 0.55,
    sfxVolume: 0.75,
    reduceFlashes: false,
    forceTouch: false,
    showFPS: false,
  };

  // =========================
  // Game State
  // =========================
  const STATE = {
    MENU: "menu",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    PAUSED: "paused",
    WAVE_CLEAR: "wave_clear",
    GAMEOVER: "gameover",
  };

  const game = {
    state: STATE.MENU,
    wave: 0,
    lives: 3,
    score: 0,
    best: 0,
    timeLeft: null, // para time attack
    roids: [],
    particles: [],
    floaters: [],
    powerDrops: [],
    ufo: null,
    ufoBullets: [],
    comboStreak: 0,
    comboMult: 1,
    comboTime: 0,
    shotsFired: 0,
    shotsHit: 0,
    hitStreak: 0,
    text: "",
    textAlpha: 0,
    countdown: 0,
    flashAlpha: 0,
    shakeTime: 0,
    shakeMag: 0,
    musicReady: false,
    ufoSpawnT: 0,
    fpsAcc: 0,
    fpsFrames: 0,
    fpsValue: 0,
  };

  // =========================
  // Audio helpers
  // =========================
  function safePlay(audio) {
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }

  function Sound(src, maxStreams = 1, baseVol = 1.0) {
    this.streamNum = 0;
    this.baseVol = baseVol;
    this.streams = [];
    for (let i = 0; i < maxStreams; i++) {
      const a = new Audio(src);
      a.volume = clamp(baseVol * settings.sfxVolume, 0, 1);
      this.streams.push(a);
    }

    this.play = () => {
      if (!settings.sfxOn) return;
      this.streamNum = (this.streamNum + 1) % maxStreams;
      const a = this.streams[this.streamNum];
      a.volume = clamp(this.baseVol * settings.sfxVolume, 0, 1);
      safePlay(a);
    };

    this.stop = () => {
      const a = this.streams[this.streamNum];
      a.pause();
      a.currentTime = 0;
    };
  }

  function Music(srcLow, srcHigh) {
    this.soundLow = new Audio(srcLow);
    this.soundHigh = new Audio(srcHigh);
    this.low = true;
    this.tempo = 1.0;
    this.beatTime = 0;

    this.syncVol = () => {
      const v = clamp(settings.musicVolume, 0, 1);
      this.soundLow.volume = settings.musicOn ? v : 0;
      this.soundHigh.volume = settings.musicOn ? v : 0;
    };

    this.play = () => {
      if (!settings.musicOn) return;
      this.syncVol();
      const a = this.low ? this.soundLow : this.soundHigh;
      safePlay(a);
      this.low = !this.low;
    };

    this.tick = () => {
      if (!game.musicReady) return;
      if (this.beatTime === 0) {
        this.play();
        this.beatTime = Math.ceil(this.tempo * FPS);
      } else {
        this.beatTime--;
      }
    };

    this.setAsteroidRatio = (ratio) => {
      this.tempo = 1.0 - 0.75 * (1.0 - ratio);
    };
  }

  // SFX
  const fxExplode = new Sound("sounds/explode.m4a", 2, 0.9);
  const fxHit = new Sound("sounds/hit.m4a", 6, 0.75);
  const fxLaser = new Sound("sounds/laser.m4a", 6, 0.55);
  const fxThrust = new Sound("sounds/thrust.m4a", 1, 0.35);
  const fxPower = new Sound("sounds/power.m4a", 2, 0.7); // opcional (se não existir, não quebra)
  const fxUfoHit = new Sound("sounds/ufo_hit.m4a", 2, 0.8); // opcional

  const music = new Music("sounds/music-low.m4a", "sounds/music-high.m4a");

  // UFO siren (opcional)
  const ufoSiren = new Audio("sounds/siren.m4a");
  ufoSiren.loop = true;

  function syncAllVolumes() {
    music.syncVol();
    ufoSiren.volume = settings.sfxOn
      ? clamp(0.28 * settings.sfxVolume, 0, 1)
      : 0;
  }

  // =========================
  // Entities
  // =========================
  function newShip() {
    return {
      x: canv.width / 2,
      y: canv.height / 2,
      r: BASE.SHIP_SIZE / 2,
      a: (90 / 180) * Math.PI,
      rot: 0,
      rotTarget: 0,
      thrusting: false,
      shooting: false,
      thrust: { x: 0, y: 0 },
      canShoot: true,
      shootCd: 0,
      lasers: [],
      dead: false,
      explodeTime: 0,
      blinkNum: Math.ceil(BASE.SHIP_INV_DUR / BASE.SHIP_BLINK_DUR),
      blinkTime: Math.ceil(BASE.SHIP_BLINK_DUR * FPS),
      shield: 0, // 0/1
      tookHitGrace: 0, // pequeno “coyote time” pós-hit
    };
  }

  let ship = newShip();

  function newAsteroid(x, y, r, speedMult = 1) {
    const diff = DIFFS[settings.difficulty];
    const baseSpd = diff.roidSpeed;
    const lvlMult = 1 + 0.085 * game.wave;

    const roid = {
      x,
      y,
      r,
      a: Math.random() * Math.PI * 2,
      vert: Math.floor(
        Math.random() * (BASE.ROIDS_VERT + 1) + BASE.ROIDS_VERT / 2
      ),
      offs: [],
      xv:
        ((Math.random() * baseSpd * lvlMult * speedMult) / FPS) *
        (Math.random() < 0.5 ? 1 : -1),
      yv:
        ((Math.random() * baseSpd * lvlMult * speedMult) / FPS) *
        (Math.random() < 0.5 ? 1 : -1),
    };

    for (let i = 0; i < roid.vert; i++) {
      roid.offs.push(Math.random() * BASE.ROIDS_JAG * 2 + 1 - BASE.ROIDS_JAG);
    }
    return roid;
  }

  // =========================
  // Utility
  // =========================
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function wrap(obj) {
    if (obj.x < 0 - obj.r) obj.x = canv.width + obj.r;
    else if (obj.x > canv.width + obj.r) obj.x = 0 - obj.r;

    if (obj.y < 0 - obj.r) obj.y = canv.height + obj.r;
    else if (obj.y > canv.height + obj.r) obj.y = 0 - obj.r;
  }

  function setOverlay(panel) {
    overlay.classList.remove("hidden");
    panelMenu.classList.add("hidden");
    panelPause.classList.add("hidden");
    panelGameOver.classList.add("hidden");
    panelSettings.classList.add("hidden");

    if (panel) panel.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    panelMenu.classList.add("hidden");
    panelPause.classList.add("hidden");
    panelGameOver.classList.add("hidden");
    panelSettings.classList.add("hidden");
  }

  function modeKey() {
    return `asteroids_lb_${settings.mode}_${settings.difficulty}`;
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(modeKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLeaderboard(score) {
    const now = new Date();
    const entry = { score, date: now.toISOString().slice(0, 10) };
    const lb = loadLeaderboard();
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const top10 = lb.slice(0, 10);
    localStorage.setItem(modeKey(), JSON.stringify(top10));
  }

  function renderLeaderboard(listEl) {
    const lb = loadLeaderboard();
    listEl.innerHTML = "";
    if (lb.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Sem registros ainda.";
      listEl.appendChild(li);
      return;
    }
    for (const e of lb) {
      const li = document.createElement("li");
      li.textContent = `${e.score} pts — ${e.date}`;
      listEl.appendChild(li);
    }
  }

  function updateBest() {
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem("highscore", String(game.best));
    }
  }

  // =========================
  // Visual FX (particles / shake / flash / floaters)
  // =========================
  function spawnParticles(
    x,
    y,
    count,
    color,
    baseSpeed,
    lifeMin,
    lifeMax,
    sizeMin,
    sizeMax
  ) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = baseSpeed * (0.35 + Math.random() * 0.9);
      game.particles.push({
        x,
        y,
        xv: (Math.cos(ang) * spd) / FPS,
        yv: (Math.sin(ang) * spd) / FPS,
        life: lifeMin + Math.random() * (lifeMax - lifeMin),
        maxLife: 0,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color,
      });
      game.particles[game.particles.length - 1].maxLife =
        game.particles[game.particles.length - 1].life;
    }
  }

  function addFloater(x, y, text, color = "white", life = 0.9) {
    game.floaters.push({
      x,
      y,
      text,
      color,
      life,
      maxLife: life,
      vy: -22 / FPS,
    });
  }

  function doShake(mag, t) {
    if (settings.reduceFlashes) return;
    game.shakeMag = Math.max(game.shakeMag, mag);
    game.shakeTime = Math.max(game.shakeTime, t);
  }

  function doFlash(alpha) {
    if (settings.reduceFlashes) return;
    game.flashAlpha = Math.max(game.flashAlpha, alpha);
  }

  // =========================
  // Powerups
  // =========================
  const POWER = {
    triple: { label: "TRIPLE", dur: 8, color: "#27f3ff" },
    shield: { label: "SHIELD", dur: 0, color: "#43ff7a" }, // 1 hit
    slow: { label: "SLOW", dur: 4, color: "#ff2bd6" },
    rapid: { label: "RAPID", dur: 8, color: "#ffd166" },
    score2x: { label: "SCORE x2", dur: 10, color: "#a8ff3e" },
  };

  const activePower = {
    triple: 0,
    slow: 0,
    rapid: 0,
    score2x: 0,
  };

  function powerScoreMult() {
    return activePower.score2x > 0 ? 2 : 1;
  }

  function timeScale() {
    return activePower.slow > 0 ? 0.55 : 1.0;
  }

  function rapidFireCd() {
    return activePower.rapid > 0 ? 0.1 : 0.22; // segundos
  }

  function dropPowerup(x, y) {
    // chance base + um pouco por wave
    const chance = 0.14 + Math.min(0.06, game.wave * 0.004);
    if (Math.random() > chance) return;

    const roll = Math.random();
    let type = "triple";
    if (roll < 0.2) type = "shield";
    else if (roll < 0.45) type = "triple";
    else if (roll < 0.62) type = "rapid";
    else if (roll < 0.8) type = "score2x";
    else type = "slow";

    game.powerDrops.push({
      type,
      x,
      y,
      r: 10,
      xv: ((Math.random() * 20) / FPS) * (Math.random() < 0.5 ? 1 : -1),
      yv: ((Math.random() * 24) / FPS) * (Math.random() < 0.5 ? 1 : -1),
      life: 9,
    });

    addFloater(x, y, POWER[type].label, POWER[type].color, 0.8);
  }

  function applyPowerup(type) {
    fxPower.play();

    if (type === "shield") {
      ship.shield = 1;
      addFloater(ship.x, ship.y, "SHIELD!", "#43ff7a", 0.9);
      return;
    }

    activePower[type] = Math.max(activePower[type], POWER[type].dur);
    addFloater(ship.x, ship.y, POWER[type].label + "!", POWER[type].color, 0.9);
  }

  function renderPowerbar() {
    const items = [];
    for (const [k, t] of Object.entries(activePower)) {
      if (t > 0)
        items.push({
          key: k,
          time: t,
          max: POWER[k].dur,
          label: POWER[k].label,
        });
    }
    powerbar.innerHTML = "";
    if (items.length === 0) return;

    for (const it of items) {
      const el = document.createElement("div");
      el.className = "pu";
      el.innerHTML = `
        <div class="pu__name">${it.label}</div>
        <div class="pu__bar"><div class="pu__fill" style="width:${Math.round(
          (it.time / it.max) * 100
        )}%"></div></div>
      `;
      powerbar.appendChild(el);
    }
  }

  // =========================
  // UFO
  // =========================
  function spawnUfo() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const small = Math.random() < 0.55;

    const y = clamp(
      60 + Math.random() * (canv.height - 120),
      60,
      canv.height - 60
    );
    const x = dir === 1 ? -40 : canv.width + 40;

    const baseV = small ? 110 : 80;
    const v = (baseV * DIFFS[settings.difficulty].ufoRate) / FPS;

    game.ufo = {
      small,
      x,
      y,
      r: small ? 14 : 20,
      dir,
      xv: v * dir,
      shootT: 0.9 + Math.random() * 0.8,
      life: 12,
    };

    // sirene
    ufoSiren.currentTime = 0;
    ufoSiren.volume = settings.sfxOn
      ? clamp(0.28 * settings.sfxVolume, 0, 1)
      : 0;
    safePlay(ufoSiren);

    addFloater(canv.width / 2, 90, "UFO!", "#ff2bd6", 0.9);
  }

  function despawnUfo() {
    game.ufo = null;
    game.ufoBullets.length = 0;
    ufoSiren.pause();
    ufoSiren.currentTime = 0;
  }

  function ufoScore() {
    return game.ufo?.small ? 250 : 150;
  }

  function ufoShoot() {
    if (!game.ufo) return;
    const u = game.ufo;

    const ang = Math.atan2(ship.y - u.y, ship.x - u.x);
    const spd = 260 / FPS;
    game.ufoBullets.push({
      x: u.x,
      y: u.y,
      r: 3.5,
      xv: Math.cos(ang) * spd,
      yv: Math.sin(ang) * spd,
      life: 2.8,
    });
  }

  // =========================
  // Waves / Patterns / Scoring / Combo
  // =========================
  let roidsTotal = 0;
  let roidsLeft = 0;

  function wavePattern(w) {
    // padrões alternando: muitos pequenos / poucos grandes / mix
    const m = w % 4;
    if (m === 0) return { large: 1, med: 3, small: 6 };
    if (m === 1) return { large: 3, med: 0, small: 2 };
    if (m === 2) return { large: 0, med: 6, small: 0 };
    return { large: 2, med: 2, small: 4 };
  }

  function createWave() {
    game.roids = [];
    const pat = wavePattern(game.wave);
    const L = Math.ceil(BASE.ROID_SIZE / 2);
    const M = Math.ceil(BASE.ROID_SIZE / 4);
    const S = Math.ceil(BASE.ROID_SIZE / 8);

    const total = pat.large + pat.med + pat.small;
    roidsTotal = total;
    roidsLeft = total;

    function spawnCount(n, r, spdMult = 1) {
      for (let i = 0; i < n; i++) {
        let x, y;
        do {
          x = Math.floor(Math.random() * canv.width);
          y = Math.floor(Math.random() * canv.height);
        } while (dist(ship.x, ship.y, x, y) < BASE.ROID_SIZE * 1.7 + ship.r);

        game.roids.push(newAsteroid(x, y, r, spdMult));
      }
    }

    // “muitos pequenos” ficam mais vivos
    spawnCount(pat.large, L, 1.0);
    spawnCount(pat.med, M, 1.05);
    spawnCount(pat.small, S, 1.12);

    music.setAsteroidRatio(1);
  }

  function addScore(base, x = canv.width / 2, y = canv.height / 2) {
    const scoreMult = powerScoreMult() * game.comboMult;
    const add = Math.floor(base * scoreMult);
    game.score += add;
    updateBest();
    addFloater(x, y, `+${add}`, "white", 0.8);
  }

  function bumpCombo() {
    game.comboStreak++;
    game.comboTime = 3.0; // segundos
    game.comboMult = clamp(1 + Math.floor(game.comboStreak / 3), 1, 5);

    if (game.comboStreak > 0 && game.comboStreak % 6 === 0) {
      addFloater(
        canv.width / 2,
        canv.height * 0.35,
        `COMBO x${game.comboMult}!`,
        "#27f3ff",
        1.1
      );
    }
  }

  function resetCombo() {
    game.comboStreak = 0;
    game.comboMult = 1;
    game.comboTime = 0;
    game.hitStreak = 0;
  }

  function precisionHit() {
    game.shotsHit++;
    game.hitStreak++;

    if (game.hitStreak >= 5) {
      game.hitStreak = 0;
      addFloater(
        canv.width / 2,
        canv.height * 0.33,
        "PRECISION +150",
        "#43ff7a",
        1.0
      );
      addScore(150, ship.x, ship.y);
    }
  }

  // =========================
  // Destroy asteroid (splits + juice)
  // =========================
  function destroyAsteroid(index, hitX, hitY) {
    const roid = game.roids[index];
    const x = roid.x;
    const y = roid.y;
    const r = roid.r;

    // juice
    doShake(6, 0.18);
    doFlash(0.28);

    // partículas
    const sizeFactor = r / (BASE.ROID_SIZE / 2);
    spawnParticles(
      x,
      y,
      Math.floor(18 + 22 * sizeFactor),
      "#cfd8dc",
      220,
      0.25,
      0.7,
      1.2,
      2.6
    );

    // power drop
    dropPowerup(x, y);

    // pontuação e combo
    if (r === Math.ceil(BASE.ROID_SIZE / 2)) addScore(20, hitX ?? x, hitY ?? y);
    else if (r === Math.ceil(BASE.ROID_SIZE / 4))
      addScore(50, hitX ?? x, hitY ?? y);
    else addScore(100, hitX ?? x, hitY ?? y);

    bumpCombo();
    precisionHit();

    // split
    if (r === Math.ceil(BASE.ROID_SIZE / 2)) {
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 4), 1.05));
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 4), 1.05));
    } else if (r === Math.ceil(BASE.ROID_SIZE / 4)) {
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 8), 1.12));
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 8), 1.12));
    }

    // remove
    game.roids.splice(index, 1);
    fxHit.play();

    // music tempo ratio
    roidsLeft--;
    music.setAsteroidRatio(roidsLeft === 0 ? 1 : roidsLeft / roidsTotal);

    if (game.roids.length === 0) {
      // wave clear
      game.state = STATE.WAVE_CLEAR;
      game.text = "WAVE CLEARED";
      game.textAlpha = 1.0;
      game.countdown = 3.0;

      // confete de estrelas
      spawnParticles(
        canv.width / 2,
        canv.height / 2,
        90,
        "#27f3ff",
        320,
        0.25,
        1.2,
        1.2,
        2.8
      );
      spawnParticles(
        canv.width / 2,
        canv.height / 2,
        70,
        "#ff2bd6",
        300,
        0.25,
        1.0,
        1.2,
        2.6
      );

      doShake(8, 0.25);
      doFlash(0.35);
    }
  }

  // =========================
  // Shooting (rapid/triple/trail/glow)
  // =========================
  function shootLaser() {
    if (ship.dead) return;
    if (ship.shootCd > 0) return;
    if (ship.lasers.length >= BASE.LASER_MAX) return;

    const baseCd = rapidFireCd();
    ship.shootCd = baseCd;

    const spread = activePower.triple > 0 ? [-0.14, 0, 0.14] : [0];
    for (const s of spread) {
      if (ship.lasers.length >= BASE.LASER_MAX) break;

      const ang = ship.a + s;
      const lx = ship.x + (4 / 3) * ship.r * Math.cos(ang);
      const ly = ship.y - (4 / 3) * ship.r * Math.sin(ang);

      ship.lasers.push({
        x: lx,
        y: ly,
        xv: (BASE.LASER_SPD * Math.cos(ang)) / FPS,
        yv: (-BASE.LASER_SPD * Math.sin(ang)) / FPS,
        dist: 0,
        explodeTime: 0,
        trail: [{ x: lx, y: ly }],
        hit: false,
      });
      game.shotsFired++;
    }

    fxLaser.play();
  }

  // =========================
  // Ship explode (juice pesado)
  // =========================
  function explodeShip() {
    ship.explodeTime = Math.ceil(BASE.SHIP_EXPLODE_DUR * FPS);
    fxExplode.play();

    doShake(14, 0.34);
    doFlash(0.65);

    spawnParticles(ship.x, ship.y, 120, "#ffb703", 420, 0.25, 1.3, 1.4, 3.5);
    spawnParticles(ship.x, ship.y, 80, "#ff2bd6", 360, 0.25, 1.1, 1.1, 3.0);
    spawnParticles(ship.x, ship.y, 60, "#ffffff", 300, 0.2, 0.9, 1.0, 2.2);
  }

  // =========================
  // Start / Reset / End
  // =========================
  function loadBest() {
    const s = localStorage.getItem("highscore");
    game.best = s == null ? 0 : parseInt(s, 10);
  }

  function resetRun() {
    const diff = DIFFS[settings.difficulty];

    game.wave = 0;
    game.score = 0;
    game.lives = settings.mode === "one_life" ? 1 : diff.lives;

    game.timeLeft = MODES[settings.mode].timeLimit;
    game.roids = [];
    game.particles = [];
    game.floaters = [];
    game.powerDrops = [];
    game.ufo = null;
    game.ufoBullets = [];
    despawnUfo();

    game.comboStreak = 0;
    game.comboMult = 1;
    game.comboTime = 0;
    game.shotsFired = 0;
    game.shotsHit = 0;
    game.hitStreak = 0;

    game.text = "";
    game.textAlpha = 0;
    game.flashAlpha = 0;
    game.shakeTime = 0;
    game.shakeMag = 0;

    activePower.triple = 0;
    activePower.slow = 0;
    activePower.rapid = 0;
    activePower.score2x = 0;

    ship = newShip();

    game.ufoSpawnT = 6.5; // delay inicial
    createWave();
  }

  function startGameFromMenu() {
    // trava música até primeiro start (política de autoplay)
    game.musicReady = true;

    resetRun();
    game.state = STATE.COUNTDOWN;
    game.countdown = 3.0;
    hideOverlay();

    hudMode.textContent = MODES[settings.mode].label;
    hudDiff.textContent = DIFFS[settings.difficulty].label;

    // foco do teclado
    canv.focus();

    renderPowerbar();
  }

  function endGame(reason) {
    game.state = STATE.GAMEOVER;
    ship.dead = true;

    // salva ranking
    saveLeaderboard(game.score);

    // overlay
    setOverlay(panelGameOver);
    renderLeaderboard(leaderboardList2);

    const acc =
      game.shotsFired > 0
        ? Math.round((game.shotsHit / game.shotsFired) * 100)
        : 0;
    const modeLabel = MODES[settings.mode].label;
    const diffLabel = DIFFS[settings.difficulty].label;

    gameOverTitle.textContent = reason === "time" ? "TIME UP!" : "GAME OVER";
    gameOverStats.textContent = `Score ${game.score} | BEST ${game.best} | Acc ${acc}% | ${modeLabel}/${diffLabel}`;
  }

  // =========================
  // Drawing helpers
  // =========================
  function drawShip(x, y, a, colour = "white") {
    ctx.strokeStyle = colour;
    ctx.lineWidth = BASE.SHIP_SIZE / 20;
    ctx.beginPath();
    ctx.moveTo(
      x + (4 / 3) * ship.r * Math.cos(a),
      y - (4 / 3) * ship.r * Math.sin(a)
    );
    ctx.lineTo(
      x - ship.r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
      y + ship.r * ((2 / 3) * Math.sin(a) - Math.cos(a))
    );
    ctx.lineTo(
      x - ship.r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
      y + ship.r * ((2 / 3) * Math.sin(a) + Math.cos(a))
    );
    ctx.closePath();
    ctx.stroke();
  }

  function drawHUD() {
    // score right
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = "24px dejavu sans mono";
    ctx.fillText(
      String(game.score),
      canv.width - BASE.SHIP_SIZE / 2,
      BASE.SHIP_SIZE
    );

    // best center
    ctx.textAlign = "center";
    ctx.font = "18px dejavu sans mono";
    ctx.fillText("BEST " + game.best, canv.width / 2, BASE.SHIP_SIZE);

    // lives left
    for (let i = 0; i < game.lives; i++) {
      const lifeColour =
        ship.explodeTime > 0 && i === game.lives - 1 ? "red" : "white";
      drawShip(
        BASE.SHIP_SIZE + i * BASE.SHIP_SIZE * 1.2,
        BASE.SHIP_SIZE,
        0.5 * Math.PI,
        lifeColour
      );
    }

    // wave + combo
    ctx.textAlign = "left";
    ctx.font = "16px dejavu sans mono";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`WAVE ${game.wave + 1}`, 10, canv.height - 16);

    ctx.textAlign = "right";
    ctx.fillText(`x${game.comboMult}`, canv.width - 10, canv.height - 16);

    // time attack timer
    if (game.timeLeft != null) {
      ctx.textAlign = "left";
      const t = Math.max(0, game.timeLeft);
      const mm = String(Math.floor(t / 60)).padStart(1, "0");
      const ss = String(Math.floor(t % 60)).padStart(2, "0");
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.fillText(`${mm}:${ss}`, 10, 18);
    }

    // fps dev
    if (settings.showFPS) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "12px dejavu sans mono";
      ctx.fillText(`FPS ${game.fpsValue}`, 10, canv.height - 34);
    }

    // shield indicator
    if (ship.shield > 0 && !ship.dead) {
      ctx.save();
      ctx.strokeStyle = "rgba(67,255,122,0.85)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(67,255,122,0.45)";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCenterText(msg, alpha, y) {
    if (!msg || alpha <= 0) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = "small-caps 40px dejavu sans mono";
    ctx.fillText(msg, canv.width / 2, y);
  }

  // =========================
  // Input
  // =========================
  function preventScrollKeys(ev) {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      " ",
      "Spacebar",
      "Escape",
    ];
    if (keys.includes(ev.key) || ev.keyCode === 32) ev.preventDefault();
  }

  document.addEventListener("keydown", (ev) => {
    preventScrollKeys(ev);

    // menu start
    if (game.state === STATE.MENU) {
      if (ev.code === "Space" || ev.key === "Enter") startGameFromMenu();
      if (ev.key.toLowerCase() === "f") settings.showFPS = !settings.showFPS;
      return;
    }

    // pause toggle
    if (ev.key === "Escape" || ev.key.toLowerCase() === "p") {
      togglePause();
      return;
    }

    if (ev.key.toLowerCase() === "f") {
      settings.showFPS = !settings.showFPS;
      return;
    }

    if (
      game.state !== STATE.PLAYING &&
      game.state !== STATE.COUNTDOWN &&
      game.state !== STATE.WAVE_CLEAR
    )
      return;
    if (ship.dead) return;

    switch (ev.keyCode) {
      case 37:
        ship.rotTarget = ((BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS;
        break;
      case 39:
        ship.rotTarget = ((-BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS;
        break;
      case 38:
        ship.thrusting = true;
        break;
      case 32:
        ship.shooting = true;
        break;
    }
  });

  document.addEventListener("keyup", (ev) => {
    preventScrollKeys(ev);

    if (ship.dead) return;

    switch (ev.keyCode) {
      case 37:
      case 39:
        ship.rotTarget = 0;
        break;
      case 38:
        ship.thrusting = false;
        break;
      case 32:
        ship.shooting = false;
        break;
    }
  });

  function bindHold(btn, onDown, onUp) {
    const down = (e) => {
      e.preventDefault();
      onDown();
    };
    const up = (e) => {
      e.preventDefault();
      onUp();
    };
    btn.addEventListener("pointerdown", down, { passive: false });
    btn.addEventListener("pointerup", up, { passive: false });
    btn.addEventListener("pointercancel", up, { passive: false });
    btn.addEventListener("pointerleave", up, { passive: false });
  }

  bindHold(
    btnLeft,
    () => (ship.rotTarget = ((BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS),
    () => (ship.rotTarget = 0)
  );
  bindHold(
    btnRight,
    () => (ship.rotTarget = ((-BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS),
    () => (ship.rotTarget = 0)
  );
  bindHold(
    btnThrust,
    () => (ship.thrusting = true),
    () => (ship.thrusting = false)
  );
  bindHold(
    btnFire,
    () => (ship.shooting = true),
    () => (ship.shooting = false)
  );

  // focus on click
  canv.addEventListener("pointerdown", () => canv.focus(), { passive: true });

  // =========================
  // Pause / UI actions
  // =========================
  function togglePause() {
    if (game.state === STATE.PLAYING) {
      game.state = STATE.PAUSED;
      setOverlay(panelPause);
    } else if (game.state === STATE.PAUSED) {
      game.state = STATE.PLAYING;
      hideOverlay();
      canv.focus();
    }
  }

  btnResume.addEventListener("click", () => {
    if (game.state === STATE.PAUSED) togglePause();
  });

  btnRestart.addEventListener("click", () => {
    resetRun();
    game.state = STATE.COUNTDOWN;
    game.countdown = 3.0;
    hideOverlay();
    canv.focus();
  });

  btnQuit.addEventListener("click", () => {
    game.state = STATE.MENU;
    showMenu();
  });

  btnPlay.addEventListener("click", startGameFromMenu);
  btnAgain.addEventListener("click", () => {
    hideOverlay();
    startGameFromMenu();
  });

  btnBackMenu.addEventListener("click", () => {
    game.state = STATE.MENU;
    showMenu();
  });

  btnShowLeaderboard.addEventListener("click", () => {
    leaderboard.classList.toggle("hidden");
    renderLeaderboard(leaderboardList);
  });

  function showMenu() {
    setOverlay(panelMenu);
    leaderboard.classList.add("hidden");
    renderLeaderboard(leaderboardList);

    hudMode.textContent = MODES[settings.mode].label;
    hudDiff.textContent = DIFFS[settings.difficulty].label;

    // para garantir sirene desligada
    despawnUfo();
  }

  // settings panel
  btnSettings.addEventListener("click", () => openSettings());
  btnCloseSettings.addEventListener("click", () => closeSettings());

  function openSettings() {
    setOverlay(panelSettings);
    // refletir estado atual
    chkMusic.checked = settings.musicOn;
    chkSfx.checked = settings.sfxOn;
    rngMusic.value = String(settings.musicVolume);
    rngSfx.value = String(settings.sfxVolume);
    chkReduceFlashes.checked = settings.reduceFlashes;
    chkTouch.checked = settings.forceTouch;
    syncAllVolumes();
  }

  function closeSettings() {
    // volta pro menu se estava menu, senão só fecha overlay se jogando/pausado
    if (game.state === STATE.MENU) {
      setOverlay(panelMenu);
    } else if (game.state === STATE.PAUSED) {
      setOverlay(panelPause);
    } else {
      hideOverlay();
      canv.focus();
    }
  }

  chkMusic.addEventListener("change", () => {
    settings.musicOn = chkMusic.checked;
    syncAllVolumes();
  });

  chkSfx.addEventListener("change", () => {
    settings.sfxOn = chkSfx.checked;
    syncAllVolumes();
  });

  rngMusic.addEventListener("input", () => {
    settings.musicVolume = parseFloat(rngMusic.value);
    syncAllVolumes();
  });

  rngSfx.addEventListener("input", () => {
    settings.sfxVolume = parseFloat(rngSfx.value);
    syncAllVolumes();
  });

  chkReduceFlashes.addEventListener("change", () => {
    settings.reduceFlashes = chkReduceFlashes.checked;
  });

  chkTouch.addEventListener("change", () => {
    settings.forceTouch = chkTouch.checked;
    refreshTouchVisibility();
  });

  // mode/diff selects
  selMode.addEventListener("change", () => {
    settings.mode = selMode.value;
    hudMode.textContent = MODES[settings.mode].label;
    renderLeaderboard(leaderboardList);
  });

  selDiff.addEventListener("change", () => {
    settings.difficulty = selDiff.value;
    hudDiff.textContent = DIFFS[settings.difficulty].label;
    renderLeaderboard(leaderboardList);
  });

  function refreshTouchVisibility() {
    const isCoarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const show = settings.forceTouch || isCoarse;
    touch.classList.toggle("hidden", !show);
  }

  // fullscreen
  (function () {
    if (!btnFullscreen || !document.documentElement.requestFullscreen) {
      if (btnFullscreen) btnFullscreen.style.display = "none";
      return;
    }

    function syncLabel() {
      btnFullscreen.textContent = document.fullscreenElement
        ? "SAIR"
        : "FULLSCREEN";
    }

    btnFullscreen.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement)
          await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (_) {}
      syncLabel();
    });

    document.addEventListener("fullscreenchange", syncLabel);
    syncLabel();
  })();

  // =========================
  // Init
  // =========================
  function init() {
    loadBest();
    syncAllVolumes();
    refreshTouchVisibility();

    settings.mode = selMode.value;
    settings.difficulty = selDiff.value;

    hudMode.textContent = MODES[settings.mode].label;
    hudDiff.textContent = DIFFS[settings.difficulty].label;

    game.state = STATE.MENU;
    showMenu();

    setInterval(update, 1000 / FPS);
  }

  // =========================
  // Update loop
  // =========================
  function update() {
    // FPS meter
    game.fpsAcc += DT;
    game.fpsFrames++;
    if (game.fpsAcc >= 1) {
      game.fpsValue = game.fpsFrames;
      game.fpsFrames = 0;
      game.fpsAcc = 0;
    }

    // always draw
    draw();

    // do not advance if paused/menu/gameover
    if (
      game.state === STATE.PAUSED ||
      game.state === STATE.MENU ||
      game.state === STATE.GAMEOVER
    )
      return;

    // music tick (somente após start)
    music.tick();

    // countdown & wave clear states
    if (game.state === STATE.COUNTDOWN) {
      game.countdown -= DT;
      if (game.countdown <= 0) {
        game.state = STATE.PLAYING;
        game.text = "";
        game.textAlpha = 0;
      }
      return;
    }

    if (game.state === STATE.WAVE_CLEAR) {
      game.countdown -= DT;
      if (game.countdown <= 0) {
        game.wave++;
        createWave();
        game.state = STATE.COUNTDOWN;
        game.countdown = 3.0;
        addFloater(
          canv.width / 2,
          canv.height * 0.42,
          `WAVE ${game.wave + 1}`,
          "#27f3ff",
          1.2
        );
      }
      return;
    }

    // =====================
    // PLAYING updates
    // =====================
    const ts = timeScale();

    // time attack timer (real time)
    if (game.timeLeft != null) {
      game.timeLeft -= DT;
      if (game.timeLeft <= 0) {
        endGame("time");
        return;
      }
    }

    // combo timer
    if (game.comboTime > 0) {
      game.comboTime -= DT;
      if (game.comboTime <= 0) resetCombo();
    }

    // powerups time (real time)
    for (const k of Object.keys(activePower)) {
      if (activePower[k] > 0) activePower[k] = Math.max(0, activePower[k] - DT);
    }
    renderPowerbar();

    // ship rotation smoothing
    ship.rot += (ship.rotTarget - ship.rot) * 0.35;

    // ship shoot cooldown
    ship.shootCd = Math.max(0, ship.shootCd - DT);

    // ship grace after hit
    ship.tookHitGrace = Math.max(0, ship.tookHitGrace - DT);

    // thrust
    const diff = DIFFS[settings.difficulty];
    if (ship.thrusting && !ship.dead) {
      ship.thrust.x += (diff.thrust * Math.cos(ship.a)) / FPS;
      ship.thrust.y -= (diff.thrust * Math.sin(ship.a)) / FPS;
      fxThrust.play();
    } else {
      // “menos escorregadio”
      ship.thrust.x -= (diff.friction * ship.thrust.x) / FPS;
      ship.thrust.y -= (diff.friction * ship.thrust.y) / FPS;
      fxThrust.stop();
    }

    // limit max speed
    const spd = Math.hypot(ship.thrust.x, ship.thrust.y);
    const max = diff.maxSpeed;
    if (spd > max) {
      ship.thrust.x = (ship.thrust.x / spd) * max;
      ship.thrust.y = (ship.thrust.y / spd) * max;
    }

    // shoot
    if (ship.shooting && !ship.dead) shootLaser();

    // move ship (if not exploding)
    const exploding = ship.explodeTime > 0;
    if (!exploding && !ship.dead) {
      ship.a += ship.rot * ts;
      ship.x += ship.thrust.x * ts;
      ship.y += ship.thrust.y * ts;
      wrap(ship);
    } else if (exploding) {
      ship.explodeTime--;
      if (ship.explodeTime === 0) {
        game.lives--;
        if (game.lives <= 0) {
          endGame("dead");
          return;
        }
        ship = newShip();
        // preserva shield? não (reinicia)
        resetCombo();
      }
    }

    // blinking
    if (ship.blinkNum > 0 && !ship.dead) {
      ship.blinkTime--;
      if (ship.blinkTime === 0) {
        ship.blinkTime = Math.ceil(BASE.SHIP_BLINK_DUR * FPS);
        ship.blinkNum--;
      }
    }

    // lasers update
    for (let i = ship.lasers.length - 1; i >= 0; i--) {
      const l = ship.lasers[i];

      // remove if too far
      if (l.dist > BASE.LASER_DIST * canv.width) {
        // miss => reseta streak
        if (!l.hit) game.hitStreak = 0;
        ship.lasers.splice(i, 1);
        continue;
      }

      if (l.explodeTime > 0) {
        l.explodeTime--;
        if (l.explodeTime === 0) {
          ship.lasers.splice(i, 1);
          continue;
        }
      } else {
        l.x += l.xv * ts;
        l.y += l.yv * ts;

        l.dist += Math.hypot(l.xv, l.yv) * ts;

        // trail
        l.trail.push({ x: l.x, y: l.y });
        if (l.trail.length > 7) l.trail.shift();
      }

      if (l.x < 0) l.x = canv.width;
      else if (l.x > canv.width) l.x = 0;

      if (l.y < 0) l.y = canv.height;
      else if (l.y > canv.height) l.y = 0;
    }

    // asteroids move
    for (const r of game.roids) {
      r.x += r.xv * ts;
      r.y += r.yv * ts;
      wrap(r);
    }

    // particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.life -= DT;
      if (p.life <= 0) {
        game.particles.splice(i, 1);
        continue;
      }
      p.x += p.xv * ts;
      p.y += p.yv * ts;
    }

    // floaters
    for (let i = game.floaters.length - 1; i >= 0; i--) {
      const f = game.floaters[i];
      f.life -= DT;
      if (f.life <= 0) {
        game.floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy * ts;
    }

    // power drops
    for (let i = game.powerDrops.length - 1; i >= 0; i--) {
      const p = game.powerDrops[i];
      p.life -= DT;
      if (p.life <= 0) {
        game.powerDrops.splice(i, 1);
        continue;
      }
      p.x += p.xv * ts;
      p.y += p.yv * ts;

      // wrap
      if (p.x < 0) p.x = canv.width;
      else if (p.x > canv.width) p.x = 0;
      if (p.y < 0) p.y = canv.height;
      else if (p.y > canv.height) p.y = 0;

      // pickup
      if (!ship.dead && dist(ship.x, ship.y, p.x, p.y) < ship.r + p.r + 4) {
        applyPowerup(p.type);
        game.powerDrops.splice(i, 1);
      }
    }

    // UFO spawn logic (por tempo e score)
    game.ufoSpawnT -= DT;
    if (!game.ufo && game.ufoSpawnT <= 0) {
      // em waves mais altas, aparece mais
      const next = 10 - Math.min(6, game.wave * 0.5);
      game.ufoSpawnT = clamp(
        next / DIFFS[settings.difficulty].ufoRate,
        3.5,
        12
      );
      // chance depende do score e wave
      const chance =
        0.25 +
        Math.min(0.35, game.wave * 0.03) +
        Math.min(0.2, game.score / 1200);
      if (Math.random() < chance) spawnUfo();
    }

    // UFO update
    if (game.ufo) {
      const u = game.ufo;
      u.life -= DT;
      u.x += u.xv * ts;

      u.shootT -= DT;
      if (u.shootT <= 0) {
        u.shootT = 0.9 + Math.random() * (u.small ? 0.8 : 1.1);
        ufoShoot();
      }

      // despawn conditions
      if (
        u.life <= 0 ||
        (u.dir === 1 && u.x > canv.width + 60) ||
        (u.dir === -1 && u.x < -60)
      ) {
        despawnUfo();
      }
    }

    // UFO bullets
    for (let i = game.ufoBullets.length - 1; i >= 0; i--) {
      const b = game.ufoBullets[i];
      b.life -= DT;
      if (b.life <= 0) {
        game.ufoBullets.splice(i, 1);
        continue;
      }
      b.x += b.xv * ts;
      b.y += b.yv * ts;

      if (b.x < 0) b.x = canv.width;
      else if (b.x > canv.width) b.x = 0;
      if (b.y < 0) b.y = canv.height;
      else if (b.y > canv.height) b.y = 0;

      // hit ship
      if (
        !ship.dead &&
        ship.explodeTime === 0 &&
        ship.blinkNum === 0 &&
        ship.tookHitGrace <= 0
      ) {
        if (dist(ship.x, ship.y, b.x, b.y) < ship.r + b.r) {
          game.ufoBullets.splice(i, 1);
          if (ship.shield > 0) {
            ship.shield = 0;
            ship.tookHitGrace = 0.35;
            doShake(6, 0.16);
            addFloater(ship.x, ship.y, "SHIELD BROKE", "#43ff7a", 0.9);
            resetCombo();
          } else {
            resetCombo();
            explodeShip();
          }
        }
      }
    }

    // collisions lasers vs asteroids
    for (let i = game.roids.length - 1; i >= 0; i--) {
      const a = game.roids[i];
      for (let j = ship.lasers.length - 1; j >= 0; j--) {
        const l = ship.lasers[j];
        if (l.explodeTime !== 0) continue;
        if (dist(a.x, a.y, l.x, l.y) < a.r) {
          l.hit = true;
          destroyAsteroid(i, l.x, l.y);
          l.explodeTime = Math.ceil(BASE.LASER_EXPLODE_DUR * FPS);
          break;
        }
      }
    }

    // lasers vs UFO
    if (game.ufo) {
      for (let j = ship.lasers.length - 1; j >= 0; j--) {
        const l = ship.lasers[j];
        if (l.explodeTime !== 0) continue;
        if (dist(game.ufo.x, game.ufo.y, l.x, l.y) < game.ufo.r + 2) {
          l.hit = true;
          fxUfoHit.play();
          doShake(9, 0.22);
          doFlash(0.35);

          spawnParticles(
            game.ufo.x,
            game.ufo.y,
            70,
            "#ff2bd6",
            360,
            0.25,
            1.1,
            1.1,
            2.8
          );
          addScore(ufoScore(), game.ufo.x, game.ufo.y);
          bumpCombo();
          precisionHit();

          l.explodeTime = Math.ceil(BASE.LASER_EXPLODE_DUR * FPS);
          despawnUfo();
          break;
        }
      }
    }

    // ship collisions vs asteroids
    if (
      !exploding &&
      !ship.dead &&
      ship.blinkNum === 0 &&
      ship.tookHitGrace <= 0
    ) {
      for (let i = 0; i < game.roids.length; i++) {
        const a = game.roids[i];
        if (dist(ship.x, ship.y, a.x, a.y) < ship.r + a.r) {
          // shield
          if (ship.shield > 0) {
            ship.shield = 0;
            ship.tookHitGrace = 0.35;
            doShake(7, 0.18);
            doFlash(0.22);
            addFloater(ship.x, ship.y, "SHIELD BROKE", "#43ff7a", 0.9);
            resetCombo();
            // “empurra” nave um pouco
            ship.thrust.x *= -0.4;
            ship.thrust.y *= -0.4;
            break;
          }

          resetCombo();
          explodeShip();
          // pequeno split do asteroide atingido (clássico)
          destroyAsteroid(i, ship.x, ship.y);
          break;
        }
      }
    }
  }

  // =========================
  // Render
  // =========================
  function draw() {
    // clear
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canv.width, canv.height);

    // screen shake translate
    ctx.save();
    if (game.shakeTime > 0) {
      game.shakeTime = Math.max(0, game.shakeTime - DT);
      const k = game.shakeTime / 0.4;
      const mag = game.shakeMag * (0.35 + k);
      const dx = (Math.random() * 2 - 1) * mag;
      const dy = (Math.random() * 2 - 1) * mag;
      ctx.translate(dx, dy);
      if (game.shakeTime === 0) game.shakeMag = 0;
    }

    // particles
    for (const p of game.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = withAlpha(p.color, 0.85 * a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // asteroids (com leve glow por tamanho)
    for (const r of game.roids) {
      const isL = r.r >= Math.ceil(BASE.ROID_SIZE / 2);
      const isM =
        r.r >= Math.ceil(BASE.ROID_SIZE / 4) &&
        r.r < Math.ceil(BASE.ROID_SIZE / 2);

      const stroke = isL
        ? "rgba(200,210,215,0.85)"
        : isM
        ? "rgba(190,200,210,0.85)"
        : "rgba(160,190,220,0.92)";
      const glow = isL
        ? "rgba(39,243,255,0.18)"
        : isM
        ? "rgba(255,43,214,0.14)"
        : "rgba(67,255,122,0.14)";

      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = BASE.SHIP_SIZE / 20;
      ctx.shadowBlur = 10;
      ctx.shadowColor = glow;

      ctx.beginPath();
      ctx.moveTo(r.x + r.r * Math.cos(r.a), r.y + r.r * Math.sin(r.a));
      for (let j = 1; j < r.vert; j++) {
        ctx.lineTo(
          r.x + r.r * r.offs[j] * Math.cos(r.a + (j * Math.PI * 2) / r.vert),
          r.y + r.r * r.offs[j] * Math.sin(r.a + (j * Math.PI * 2) / r.vert)
        );
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // UFO
    if (game.ufo) {
      const u = game.ufo;
      ctx.save();
      ctx.strokeStyle = u.small
        ? "rgba(255,43,214,0.9)"
        : "rgba(39,243,255,0.9)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = u.small
        ? "rgba(255,43,214,0.35)"
        : "rgba(39,243,255,0.30)";

      ctx.beginPath();
      ctx.ellipse(u.x, u.y, u.r + 8, u.r, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(u.x - (u.r + 10), u.y);
      ctx.lineTo(u.x + (u.r + 10), u.y);
      ctx.stroke();

      ctx.restore();
    }

    // UFO bullets
    for (const b of game.ufoBullets) {
      ctx.save();
      ctx.fillStyle = "rgba(255,43,214,0.9)";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(255,43,214,0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // power drops
    for (const p of game.powerDrops) {
      ctx.save();
      ctx.strokeStyle = withAlpha(POWER[p.type].color, 0.9);
      ctx.shadowBlur = 14;
      ctx.shadowColor = withAlpha(POWER[p.type].color, 0.35);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = withAlpha(POWER[p.type].color, 0.18);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // lasers (trail + glow)
    for (const l of ship.lasers) {
      if (l.trail && l.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 180, 200, 0.35)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255, 120, 170, 0.25)";
        ctx.beginPath();
        for (let i = 0; i < l.trail.length; i++) {
          const t = l.trail[i];
          if (i === 0) ctx.moveTo(t.x, t.y);
          else ctx.lineTo(t.x, t.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (l.explodeTime === 0) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 170, 190, 0.95)";
        ctx.shadowBlur = 16;
        ctx.shadowColor = "rgba(255, 120, 170, 0.35)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, BASE.SHIP_SIZE / 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = "rgba(255, 69, 0, 0.9)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, ship.r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 160, 180, 0.9)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, ship.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ship
    const blinkOn = ship.blinkNum % 2 === 0;
    const exploding = ship.explodeTime > 0;

    if (!exploding) {
      if (blinkOn && !ship.dead && game.state !== STATE.MENU) {
        drawShip(ship.x, ship.y, ship.a);
      }
      // thruster flame
      if (ship.thrusting && blinkOn && !ship.dead) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
        ctx.strokeStyle = "rgba(255, 240, 120, 0.9)";
        ctx.lineWidth = BASE.SHIP_SIZE / 10;
        ctx.shadowBlur = 16;
        ctx.shadowColor = "rgba(255, 180, 120, 0.25)";

        ctx.beginPath();
        ctx.moveTo(
          ship.x -
            ship.r * ((2 / 3) * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
          ship.y +
            ship.r * ((2 / 3) * Math.sin(ship.a) - 0.5 * Math.cos(ship.a))
        );
        ctx.lineTo(
          ship.x - ((ship.r * 6) / 3) * Math.cos(ship.a),
          ship.y + ((ship.r * 6) / 3) * Math.sin(ship.a)
        );
        ctx.lineTo(
          ship.x -
            ship.r * ((2 / 3) * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
          ship.y +
            ship.r * ((2 / 3) * Math.sin(ship.a) + 0.5 * Math.cos(ship.a))
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // explosion circles (mantém clássico) + já temos partículas
      ctx.save();
      ctx.fillStyle = "darkred";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "yellow";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // floaters
    for (const f of game.floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = withAlpha(f.color, 0.9 * a);
      ctx.font = "16px dejavu sans mono";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // center messages
    if (game.state === STATE.COUNTDOWN) {
      const n = Math.ceil(game.countdown);
      drawCenterText(n > 0 ? String(n) : "GO!", 1.0, canv.height * 0.45);
    }
    if (game.state === STATE.WAVE_CLEAR) {
      drawCenterText("WAVE CLEARED", 0.9, canv.height * 0.45);
      const n = Math.ceil(game.countdown);
      drawCenterText(n > 0 ? String(n) : "GO!", 0.85, canv.height * 0.58);
    }

    drawHUD();

    // flash overlay
    if (game.flashAlpha > 0) {
      game.flashAlpha = Math.max(0, game.flashAlpha - 0.04);
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${game.flashAlpha})`;
      ctx.fillRect(0, 0, canv.width, canv.height);
      ctx.restore();
    }

    ctx.restore(); // end shake transform
  }

  function withAlpha(color, a) {
    // aceita hex simples
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      const r = parseInt(
        hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2),
        16
      );
      const g = parseInt(
        hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4),
        16
      );
      const b = parseInt(
        hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6),
        16
      );
      return `rgba(${r},${g},${b},${a})`;
    }
    // rgba já vem pronto
    return color;
  }

  // =========================
  // Boot
  // =========================
  init();

  // garante touch toggle em resize
  window.addEventListener("resize", refreshTouchVisibility);

  // garante menu se perder foco
  window.addEventListener("blur", () => {
    if (game.state === STATE.PLAYING) {
      game.state = STATE.PAUSED;
      setOverlay(panelPause);
    }
  });

  // inicia menu state
  function showMenu() {
    game.state = STATE.MENU;
    setOverlay(panelMenu);
    renderLeaderboard(leaderboardList);
    renderPowerbar();
  }
})();
