"use strict";

(() => {
  const canvas = document.getElementById("mountain-game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const startButton = document.getElementById("game-start");
  const resetButton = document.getElementById("game-reset");
  const riceOutput = document.getElementById("rice-count");
  const messageOutput = document.getElementById("game-message");
  const togetherMeter = document.getElementById("together-meter");

  const GAME = { width: 960, height: 420, worldWidth: 1320, gravity: 0.72, speed: 4.5, jump: 13.4, maxGap: 175 };
  const keys = { left: false, right: false, jump: false };
  const platforms = [
    { x: 0, y: 352, w: 270, h: 68 }, { x: 315, y: 326, w: 210, h: 94 },
    { x: 575, y: 348, w: 235, h: 72 }, { x: 850, y: 310, w: 205, h: 110 },
    { x: 1095, y: 270, w: 225, h: 150 }
  ];
  const obstacles = [
    { x: 205, y: 316, w: 48, h: 36, type: "rock" },
    { x: 435, y: 292, w: 70, h: 34, type: "log" },
    { x: 755, y: 310, w: 44, h: 38, type: "rock" },
    { x: 995, y: 272, w: 48, h: 38, type: "rock" }
  ];
  const riceStart = [
    { x: 150, y: 285 }, { x: 360, y: 255 }, { x: 650, y: 280 }, { x: 900, y: 230 }, { x: 1160, y: 185 }
  ];

  let player;
  let mochi;
  let rice;
  let cameraX = 0;
  let playing = false;
  let won = false;
  let frame = 0;
  let mochiSpoke = false;
  let wasWaiting = false;
  let restStops;
  let lastTime = 0;

  function resetGame(autoStart = false) {
    player = { x: 60, y: 290, w: 48, h: 60, vx: 0, vy: 0, grounded: false, collected: 0, facing: 1 };
    mochi = { x: 10, y: 292, w: 54, h: 58, restTimer: 0, snackBoost: 0, sitting: false };
    rice = riceStart.map((item) => ({ ...item, found: false }));
    cameraX = 0;
    won = false;
    mochiSpoke = false;
    wasWaiting = false;
    restStops = new Set();
    playing = autoStart;
    keys.left = keys.right = keys.jump = false;
    riceOutput.textContent = "0";
    messageOutput.textContent = autoStart ? "ふたりで しゅっぱつ！" : "「はじめる」を押してね";
    togetherMeter.style.setProperty("--together", "100%");
    togetherMeter.classList.remove("is-far");
    togetherMeter.querySelector("b").textContent = "いっしょ";
    startButton.hidden = autoStart;
    draw();
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function terrainY(x) {
    const platform = platforms.find((item) => x >= item.x && x <= item.x + item.w);
    if (platform) return platform.y;
    const previous = [...platforms].reverse().find((item) => item.x + item.w < x);
    const next = platforms.find((item) => item.x > x);
    if (!previous) return platforms[0].y;
    if (!next) return platforms[platforms.length - 1].y;
    const start = previous.x + previous.w;
    const amount = Math.max(0, Math.min(1, (x - start) / (next.x - start)));
    return previous.y + (next.y - previous.y) * amount;
  }

  function updateMochi() {
    const gap = player.x - mochi.x;
    const restZone = mochi.x > 430 && mochi.x < 470 ? "first" : mochi.x > 835 && mochi.x < 875 ? "second" : null;
    if (restZone && !restStops.has(restZone)) {
      restStops.add(restZone);
      mochi.restTimer = 82;
      messageOutput.textContent = "もち「ちょっと やすむ…」";
    }
    if (mochi.restTimer > 0) {
      mochi.restTimer -= 1;
      mochi.sitting = true;
    } else {
      mochi.sitting = gap < 48 && Math.abs(player.vx) < .2;
      if (gap > 42) {
        const followSpeed = mochi.snackBoost > 0 ? 3.7 : 2.15;
        mochi.x += Math.min(followSpeed, gap - 42);
      } else if (gap < -8) {
        mochi.x -= Math.min(1.2, Math.abs(gap));
      }
    }
    if (mochi.snackBoost > 0) mochi.snackBoost -= 1;
    const targetY = terrainY(mochi.x + mochi.w / 2) - mochi.h;
    mochi.y += (targetY - mochi.y) * .28;

    const distance = Math.max(0, player.x - mochi.x);
    const together = Math.max(0, Math.min(1, 1 - distance / GAME.maxGap));
    togetherMeter.style.setProperty("--together", `${Math.round(together * 100)}%`);
    togetherMeter.classList.toggle("is-far", together < .28);
    togetherMeter.querySelector("b").textContent = together < .28 ? "まって！" : together < .58 ? "もう少し" : "いっしょ";
  }

  function update() {
    if (!playing || won) return;
    const gap = player.x - mochi.x;
    const waiting = keys.right && gap >= GAME.maxGap;
    player.vx = (keys.right && !waiting ? GAME.speed : 0) - (keys.left ? GAME.speed : 0);
    if (waiting && !wasWaiting) messageOutput.textContent = "ぷく「もちを まとう！」";
    wasWaiting = waiting;
    if (player.vx) player.facing = Math.sign(player.vx);
    if (keys.jump && player.grounded) {
      player.vy = -GAME.jump;
      player.grounded = false;
    }
    keys.jump = false;

    const previousX = player.x;
    player.x += player.vx;
    player.x = Math.max(0, Math.min(GAME.worldWidth - player.w, player.x));
    obstacles.forEach((obstacle) => {
      if (intersects(player, obstacle)) player.x = previousX;
    });

    const previousBottom = player.y + player.h;
    player.vy += GAME.gravity;
    player.y += player.vy;
    player.grounded = false;
    [...platforms, ...obstacles].forEach((surface) => {
      const currentBottom = player.y + player.h;
      if (player.vy >= 0 && previousBottom <= surface.y + 8 && currentBottom >= surface.y && player.x + player.w > surface.x + 5 && player.x < surface.x + surface.w - 5) {
        player.y = surface.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    });

    updateMochi();

    if (player.y > GAME.height + 80) {
      player.x = Math.max(20, player.x - 130);
      player.y = 220;
      player.vy = 0;
      messageOutput.textContent = "だいじょうぶ。もういちど！";
    }

    rice.forEach((item) => {
      if (!item.found && Math.hypot(player.x + 24 - item.x, player.y + 28 - item.y) < 42) {
        item.found = true;
        player.collected += 1;
        mochi.snackBoost = 95;
        riceOutput.textContent = String(player.collected);
        messageOutput.textContent = player.collected === 5 ? "おにぎり、ぜんぶ見つけた！" : "もちも げんきになった！";
      }
    });

    if (!mochiSpoke && mochi.x > 560 && mochi.x < 760) {
      mochiSpoke = true;
      messageOutput.textContent = "もち「ここ、いいかぜだね〜」";
    }

    if (player.x > 1210 && mochi.x <= 1160) {
      player.x = 1210;
      messageOutput.textContent = "ぷく「もち、こっちだよ！」";
    }
    if (player.x > 1205 && mochi.x > 1160) {
      won = true;
      playing = false;
      messageOutput.textContent = player.collected === 5 ? "ふたりで かんぺき！" : `ふたりで 山頂！ おにぎり ${player.collected}こ`;
      window.bookSound?.chirp();
    }
    if (player.grounded && Math.abs(player.vx) > 0 && frame % 16 === 0) window.bookSound?.step();
    cameraX += ((player.x - 230) - cameraX) * 0.08;
    cameraX = Math.max(0, Math.min(GAME.worldWidth - GAME.width, cameraX));
    frame += 1;
  }

  function roundRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawMountain(x, base, width, height, color, snow = false) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#1c285c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + width * .52, base - height);
    ctx.lineTo(x + width, base);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (snow) {
      ctx.fillStyle = "#fffdf3";
      ctx.beginPath();
      ctx.moveTo(x + width * .36, base - height * .7);
      ctx.lineTo(x + width * .52, base - height);
      ctx.lineTo(x + width * .7, base - height * .64);
      ctx.lineTo(x + width * .58, base - height * .69);
      ctx.lineTo(x + width * .5, base - height * .58);
      ctx.lineTo(x + width * .44, base - height * .69);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawPine(x, y, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = "#704523"; ctx.fillRect(-5, -24, 10, 34);
    ctx.fillStyle = "#0d6a52"; ctx.strokeStyle = "#1c285c"; ctx.lineWidth = 3;
    [[-28,-15,28,-15,0,-70],[-23,-35,23,-35,0,-86]].forEach((p) => { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[4],p[5]); ctx.lineTo(p[2],p[3]); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    ctx.restore();
  }

  function drawOnigiri(item) {
    if (item.found) return;
    const bob = Math.sin((frame + item.x) * .06) * 4;
    ctx.save(); ctx.translate(item.x, item.y + bob);
    ctx.fillStyle = "#fffdf3"; ctx.strokeStyle = "#1c285c"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0,-18); ctx.quadraticCurveTo(24,-10,25,17); ctx.quadraticCurveTo(0,25,-25,17); ctx.quadraticCurveTo(-24,-10,0,-18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#25314f"; ctx.fillRect(-10,5,20,17);
    ctx.restore();
  }

  function drawCreature(x, y, isMochi = false, facing = 1, jumping = false, sitting = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(facing, 1);
    if (jumping) ctx.rotate(-.08);
    if (sitting) ctx.transform(1, 0, 0, .9, 0, 8);
    ctx.strokeStyle = "#1c285c"; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.fillStyle = isMochi ? "#d9fff3" : "#c861e8";
    ctx.beginPath(); ctx.ellipse(0, 0, isMochi ? 30 : 25, isMochi ? 30 : 31, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fbf6ea"; ctx.beginPath(); ctx.ellipse(3, 3, 17, 18, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#1c285c"; ctx.beginPath(); ctx.arc(-7,-7,3.5,0,Math.PI*2); ctx.arc(9,-7,3.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2,0,5,4,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#e63f79"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(3,5,8,.1,Math.PI-.1); ctx.stroke();
    ctx.fillStyle = isMochi ? "#ff7839" : "#078da2"; roundRect(-31,-17,12,34,5); ctx.fill(); ctx.strokeStyle="#1c285c";ctx.stroke();
    ctx.fillStyle = "#402d66"; ctx.beginPath(); ctx.ellipse(-16,25,10,7,0,0,Math.PI*2); ctx.ellipse(16,25,10,7,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, GAME.width, GAME.height);
    const sky = ctx.createLinearGradient(0, 0, 0, 420);
    sky.addColorStop(0, "#31c7f4"); sky.addColorStop(1, "#d9fff0");
    ctx.fillStyle = sky; ctx.fillRect(0,0,GAME.width,GAME.height);
    ctx.fillStyle="#ffe05d";ctx.beginPath();ctx.arc(820,68,36,0,Math.PI*2);ctx.fill();
    drawMountain(-100 - cameraX*.08, 320, 450, 210, "#57adcb");
    drawMountain(250 - cameraX*.1, 320, 520, 255, "#4d8fcf", true);
    drawMountain(650 - cameraX*.08, 320, 480, 190, "#68bf79");
    for (let i=0;i<9;i++) drawPine(i*140 - (cameraX*.28 % 140), 335, .65 + (i%3)*.1);

    ctx.save(); ctx.translate(-cameraX, 0);
    platforms.forEach((p, index) => {
      ctx.fillStyle = index % 2 ? "#83cf48" : "#70c843"; ctx.strokeStyle="#1c285c";ctx.lineWidth=4;
      roundRect(p.x,p.y,p.w,p.h,18);ctx.fill();ctx.stroke();
      ctx.fillStyle="#f0bc70";ctx.fillRect(p.x+8,p.y+12,p.w-16,10);
    });
    obstacles.forEach((o) => {
      ctx.strokeStyle="#1c285c";ctx.lineWidth=4;
      if(o.type==="log"){ctx.fillStyle="#925a31";roundRect(o.x,o.y,o.w,o.h,13);ctx.fill();ctx.stroke();ctx.fillStyle="#c98444";ctx.beginPath();ctx.arc(o.x+10,o.y+o.h/2,10,0,Math.PI*2);ctx.fill();ctx.stroke();}
      else{ctx.fillStyle="#737aa4";ctx.beginPath();ctx.moveTo(o.x,o.y+o.h);ctx.quadraticCurveTo(o.x+5,o.y+3,o.x+o.w/2,o.y);ctx.quadraticCurveTo(o.x+o.w-4,o.y+5,o.x+o.w,o.y+o.h);ctx.closePath();ctx.fill();ctx.stroke();}
    });
    rice.forEach(drawOnigiri);
    if (mochi) drawCreature(mochi.x + mochi.w/2, mochi.y + mochi.h/2, true, 1, false, mochi.sitting);
    if (player) drawCreature(player.x + player.w/2, player.y + player.h/2, false, player.facing, !player.grounded);
    if (player && mochi && Math.abs(player.x - mochi.x) < 82) {
      ctx.fillStyle="#f44f9b";ctx.strokeStyle="#1c285c";ctx.lineWidth=2;ctx.font="900 22px sans-serif";
      ctx.fillText("♥",(player.x+mochi.x)/2+34,Math.min(player.y,mochi.y)-10);
    }
    ctx.fillStyle="#704523";ctx.strokeStyle="#1c285c";ctx.lineWidth=4;ctx.fillRect(1245,165,10,105);ctx.strokeRect(1245,165,10,105);
    ctx.fillStyle="#ff6b54";ctx.beginPath();ctx.moveTo(1255,172);ctx.lineTo(1310,190);ctx.lineTo(1255,215);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();

    if (won) {
      ctx.fillStyle="rgba(28,40,92,.62)";ctx.fillRect(0,0,GAME.width,GAME.height);
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 54px sans-serif";ctx.fillText("ふたりで てっぺん！",GAME.width/2,180);
      ctx.font="800 24px sans-serif";ctx.fillText(`おにぎり ${player.collected}こ 見つけたよ`,GAME.width/2,225);
    }
  }

  function loop(time) {
    if (time - lastTime > 14) { update(); draw(); lastTime = time; }
    window.requestAnimationFrame(loop);
  }

  function setKey(code, pressed) {
    if (["ArrowLeft","KeyA"].includes(code)) keys.left = pressed;
    if (["ArrowRight","KeyD"].includes(code)) keys.right = pressed;
    if (pressed && ["Space","ArrowUp","KeyW"].includes(code)) keys.jump = true;
  }
  window.addEventListener("keydown", (event) => {
    if (!playing) return;
    if (["ArrowLeft","ArrowRight","ArrowUp","Space","KeyA","KeyD","KeyW"].includes(event.code)) event.preventDefault();
    setKey(event.code, true);
  });
  window.addEventListener("keyup", (event) => setKey(event.code, false));

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const press = (event) => { event.preventDefault(); button.classList.add("is-pressed"); if (control === "jump") keys.jump = true; else keys[control] = true; };
    const release = (event) => { event.preventDefault(); button.classList.remove("is-pressed"); if (control !== "jump") keys[control] = false; };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
  startButton.addEventListener("click", () => { resetGame(true); canvas.focus(); });
  resetButton.addEventListener("click", () => { resetGame(true); canvas.focus(); });
  resetGame(false);
  window.requestAnimationFrame(loop);
})();
