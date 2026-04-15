const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const gameStateEl = document.getElementById("gameState");
const startButton = document.getElementById("startButton");
const installHint = document.getElementById("installHint");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");

const supportPill = document.getElementById("supportPill");
const securityPill = document.getElementById("securityPill");
const platformPill = document.getElementById("platformPill");

const openInstallButton = document.getElementById("openInstallButton");
const openTrustButton = document.getElementById("openTrustButton");
const openSettingsButton = document.getElementById("openSettingsButton");

const modalRoot = document.getElementById("modalRoot");
const modalEyebrow = document.getElementById("modalEyebrow");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");
const modalActions = document.getElementById("modalActions");
const closeModalButton = document.getElementById("closeModalButton");

const bestScoreKey = "orbit-dash-best-score";
const displayModeStandalone = window.matchMedia("(display-mode: standalone)");
const userAgent = navigator.userAgent;

const platform = {
  isIOS:
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  isAndroid: /Android/i.test(userAgent),
  isTouch: window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0,
};

platform.isWindows = /Windows/i.test(userAgent);
platform.isMac = /Macintosh|Mac OS X/i.test(userAgent) && !platform.isIOS;
platform.isLinux = /Linux/i.test(userAgent) && !platform.isAndroid;
platform.isMobile = platform.isIOS || platform.isAndroid || window.innerWidth <= 820;
platform.isStandalone = displayModeStandalone.matches || window.navigator.standalone === true;
platform.browser = detectBrowser();

const state = {
  running: false,
  lastTime: 0,
  spawnTimer: 0,
  score: 0,
  bestScore: Number(localStorage.getItem(bestScoreKey) || 0),
  deferredPrompt: null,
  serviceWorkerState: "未检测",
  player: {
    x: canvas.width / 2,
    y: canvas.height - 66,
    radius: 18,
    speed: 280,
    vx: 0,
  },
  obstacles: [],
};

bestScoreEl.textContent = String(state.bestScore);

function detectBrowser() {
  if (/Edg/i.test(userAgent)) {
    return "Edge";
  }
  if (/OPR|Opera/i.test(userAgent)) {
    return "Opera";
  }
  if (/Firefox|FxiOS/i.test(userAgent)) {
    return "Firefox";
  }
  if (/Chrome|Chromium|CriOS/i.test(userAgent) && !/Edg|OPR/i.test(userAgent)) {
    return navigator.brave ? "Brave" : "Chrome";
  }
  if (/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/i.test(userAgent)) {
    return "Safari";
  }
  return "Other";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function describePlatform() {
  if (platform.isIOS) {
    return "iOS / iPadOS";
  }
  if (platform.isAndroid) {
    return "Android";
  }
  if (platform.isWindows) {
    return "Windows";
  }
  if (platform.isMac) {
    return "macOS";
  }
  if (platform.isLinux) {
    return "Linux";
  }
  return platform.isMobile ? "移动设备" : "桌面设备";
}

function getDisplayModeLabel() {
  if (platform.isStandalone) {
    return "standalone";
  }
  if (window.matchMedia("(display-mode: browser)").matches) {
    return "browser";
  }
  return "unknown";
}

function getSupportLevel() {
  if (platform.isIOS) {
    return "主屏幕路径";
  }
  if (platform.isAndroid) {
    if (window.isSecureContext && state.deferredPrompt) {
      return "安装支持强";
    }
    return window.isSecureContext ? "菜单安装" : "仅临时访问";
  }
  if (platform.browser === "Chrome" || platform.browser === "Edge") {
    return window.isSecureContext || location.hostname === "localhost" ? "安装支持强" : "仅临时访问";
  }
  if (platform.browser === "Brave" || platform.browser === "Opera") {
    return window.isSecureContext || location.hostname === "localhost" ? "安装支持中" : "仅临时访问";
  }
  if (platform.browser === "Safari") {
    return platform.isMac ? "部分支持" : "主屏幕路径";
  }
  if (platform.browser === "Firefox") {
    return "浏览优先";
  }
  return "视浏览器而定";
}

function getTone(level) {
  if (["安装支持强", "主屏幕路径", "HTTPS 已启用", "可信环境", "Windows", "macOS", "Linux", "iOS / iPadOS", "Android"].includes(level)) {
    return "tone-strong";
  }
  if (["安装支持中", "菜单安装", "部分支持", "需信任证书", "桌面设备", "移动设备"].includes(level)) {
    return "tone-medium";
  }
  if (["仅临时访问", "浏览优先", "HTTP 模式", "存在风险提示"].includes(level)) {
    return "tone-weak";
  }
  return "tone-neutral";
}

function setPill(element, text, tone) {
  element.textContent = text;
  element.className = `hero-pill ${tone}`;
}

function updateTopPills() {
  const support = getSupportLevel();
  const security = window.isSecureContext ? "可信环境" : (location.protocol === "https:" ? "需信任证书" : "HTTP 模式");
  setPill(platformPill, `${describePlatform()} · ${platform.browser}`, getTone(describePlatform()));
  setPill(supportPill, support, getTone(support));
  setPill(securityPill, security, getTone(security));
}

function createActionButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function openModal({ eyebrow, title, content, actions = [] }) {
  modalEyebrow.textContent = eyebrow;
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  modalActions.innerHTML = "";
  for (const action of actions) {
    modalActions.appendChild(action);
  }
  modalRoot.hidden = false;
}

function closeModal() {
  modalRoot.hidden = true;
}

function getDebugPayload() {
  return {
    platform: describePlatform(),
    browser: platform.browser,
    protocol: location.protocol,
    host: location.host,
    secureContext: window.isSecureContext,
    displayMode: getDisplayModeLabel(),
    standalone: platform.isStandalone,
    deferredPromptAvailable: Boolean(state.deferredPrompt),
    serviceWorker: state.serviceWorkerState,
    touch: platform.isTouch,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    installHint.textContent = successMessage;
  } catch {
    installHint.textContent = "复制失败，请手动复制。";
  }
}

async function clearLocalSiteData() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    localStorage.removeItem(bestScoreKey);
    sessionStorage.clear();
    installHint.textContent = "本地缓存已清理，正在刷新页面。";
    window.location.reload();
  } catch {
    installHint.textContent = "清理本地缓存失败，请改用浏览器开发者工具手动清理。";
  }
}

function getDesktopCommands() {
  if (platform.isWindows) {
    return [
      "powershell -ExecutionPolicy Bypass -File .\\scripts\\generate-cert.ps1 -ProjectRoot .\\examples\\orbit-dash-pwa",
      'node "examples/orbit-dash-pwa/server.js"',
    ].join("\n");
  }
  if (platform.isMac) {
    return [
      "powershell -ExecutionPolicy Bypass -File ./scripts/generate-cert.ps1 -ProjectRoot ./examples/orbit-dash-pwa",
      "./scripts/install-cert-macos.sh install --project-root ./examples/orbit-dash-pwa",
      'node "examples/orbit-dash-pwa/server.js"',
    ].join("\n");
  }
  if (platform.isLinux) {
    return [
      "powershell -ExecutionPolicy Bypass -File ./scripts/generate-cert.ps1 -ProjectRoot ./examples/orbit-dash-pwa",
      "./scripts/install-cert-linux.sh install --project-root ./examples/orbit-dash-pwa --with-nss",
      'node "examples/orbit-dash-pwa/server.js"',
    ].join("\n");
  }
  return "";
}

function showInstallModal() {
  const actions = [];
  let body = "";

  if (platform.isStandalone) {
    body = platform.isMobile
      ? `
        <h3>当前已安装</h3>
        <p>当前页面已经通过主屏幕入口打开。</p>
        <ol>
          <li>返回系统主屏幕。</li>
          <li>长按当前图标。</li>
          <li>选择删除 App 或移除图标。</li>
        </ol>
      `
      : `
        <h3>当前已安装</h3>
        <p>当前页面已经通过桌面或系统应用入口打开。</p>
        <ol>
          <li>在桌面、开始菜单、应用列表或浏览器站点应用列表中找到当前入口。</li>
          <li>按当前系统方式执行卸载或删除快捷方式。</li>
          <li>卸载后重新用浏览器访问时，会回到普通网页模式。</li>
        </ol>
      `;
    actions.push(createActionButton("关闭", "ghost-button", closeModal));
    openModal({
      eyebrow: "Installed",
      title: "卸载说明",
      content: body,
      actions,
    });
    return;
  }

  if (platform.isIOS) {
    body = `
      <h3>主路径</h3>
      <ol>
        <li>请使用 Safari 打开当前页面。</li>
        <li>点击底部“共享”。</li>
        <li>选择“添加到主屏幕”。</li>
        <li>确认名称后点击“添加”。</li>
      </ol>
      <p>iOS / iPadOS 一般不是通过桌面 Chromium 那种标准安装弹窗完成安装。</p>
    `;
  } else if (platform.isAndroid) {
    body = state.deferredPrompt && window.isSecureContext
      ? `
        <h3>主路径</h3>
        <p>当前浏览器支持原生安装。优先使用页面内安装按钮或浏览器原生入口。</p>
        <p>如果浏览器菜单也提供安装应用入口，优先使用原生入口。</p>
      `
      : `
        <h3>主路径</h3>
        <ol>
          <li>优先查找浏览器原生安装入口。</li>
          <li>如果没有，打开浏览器菜单。</li>
          <li>选择“添加到主屏幕”或“安装应用”。</li>
        </ol>
        <p>${window.isSecureContext ? "当前环境可继续用菜单安装。" : "当前环境更适合临时访问，若要稳定安装建议切到可信 HTTPS。"}</p>
      `;
  } else if (platform.browser === "Firefox") {
    body = `
      <h3>当前浏览器</h3>
      <p>Firefox 更适合作为浏览与调试浏览器，不建议作为桌面安装主路径。</p>
      <p>主路径建议切到 Chrome 或 Edge。</p>
    `;
  } else if (platform.browser === "Safari") {
    body = `
      <h3>当前浏览器</h3>
      <p>桌面 Safari 可验证普通访问与部分站点应用能力，但安装体验通常不如 Chromium 完整。</p>
      <p>若要验证更完整的桌面安装入口，建议改用 Chrome 或 Edge。</p>
    `;
  } else {
    body = state.deferredPrompt
      ? `
        <h3>主路径</h3>
        <p>当前浏览器已具备桌面安装条件，可直接生成桌面应用入口。</p>
        <ol>
          <li>点击下方“现在安装”。</li>
          <li>确认安装后，会创建桌面或系统应用入口。</li>
          <li>以后可直接从图标再次打开。</li>
        </ol>
      `
      : `
        <h3>当前状态</h3>
        <p>当前浏览器或地址条件还没有给出安装入口。</p>
        <ol>
          <li>优先使用 Chrome 或 Edge。</li>
          <li>优先使用默认 HTTPS 地址或 localhost。</li>
          <li>如果需要信任证书，请查看“信任证书”。</li>
        </ol>
      `;
  }

  if (state.deferredPrompt && !platform.isIOS) {
    actions.push(createActionButton(platform.isAndroid ? "现在安装到主屏幕" : "现在安装到桌面", "primary-button", async () => {
      await state.deferredPrompt.prompt();
      state.deferredPrompt = null;
      closeModal();
      updateShell();
    }));
  }

  actions.push(createActionButton("关闭", "ghost-button", closeModal));

  openModal({
    eyebrow: "Install",
    title: "安装到桌面 / 主屏幕",
    content: body,
    actions,
  });
}

function showTrustModal() {
  const commands = getDesktopCommands();
  const canDownloadIosProfile = platform.isIOS;
  let body = "";
  const actions = [];

  if (platform.isIOS) {
    body = `
      <h3>iOS / iPadOS 证书路径</h3>
      <ol>
        <li>下载 iOS 证书描述文件。</li>
        <li>前往“设置 -> 通用 -> VPN 与设备管理”完成安装。</li>
        <li>再到“设置 -> 通用 -> 关于本机 -> 证书信任设置”中开启完全信任。</li>
      </ol>
      <p>完成后刷新页面，不安全提示通常会减少，安装路径也会更稳定。</p>
    `;
    actions.push(createActionButton("下载 iOS 证书", "secondary-button", () => {
      window.location.href = "/ios-root-ca.mobileconfig";
    }));
  } else if (platform.isAndroid) {
    body = `
      <h3>Android 提示</h3>
      <p>Android 默认更适合走“可信 HTTPS + 浏览器原生安装”路径。</p>
      <p>如果你只是临时访问页面，可以先继续访问；如果你要稳定验证安装能力，建议先把当前地址切到可信 HTTPS。</p>
      <p>不建议把导入本地证书作为 Android 默认用户路径。</p>
    `;
  } else {
    body = `
      <h3>${escapeHtml(describePlatform())} 证书路径</h3>
      <p>当前桌面端建议先生成本地证书，再按当前系统导入信任根。</p>
      <ol>
        <li>先运行证书生成脚本。</li>
        <li>再按当前系统使用导入脚本或系统证书工具。</li>
        <li>导入后重开浏览器，再访问默认 HTTPS 地址。</li>
      </ol>
      ${commands ? `<pre class="command-block">${escapeHtml(commands)}</pre>` : ""}
    `;
    if (commands) {
      actions.push(createActionButton("复制桌面命令", "secondary-button", () => {
        copyText(commands, "桌面证书命令已复制。");
      }));
    }
  }

  if (!canDownloadIosProfile && !platform.isMobile) {
    actions.push(createActionButton("下载根证书", "ghost-button", () => {
      window.location.href = "/root-ca-cert.cer";
    }));
  }

  actions.push(createActionButton("关闭", "ghost-button", closeModal));

  openModal({
    eyebrow: "Trust",
    title: "信任证书",
    content: body,
    actions,
  });
}

function showSettingsModal() {
  const debugPayload = getDebugPayload();
  const body = `
    <div class="summary-list">
      <div class="summary-item"><span class="summary-key">平台</span><strong class="summary-value">${escapeHtml(debugPayload.platform)}</strong></div>
      <div class="summary-item"><span class="summary-key">浏览器</span><strong class="summary-value">${escapeHtml(debugPayload.browser)}</strong></div>
      <div class="summary-item"><span class="summary-key">协议</span><strong class="summary-value">${escapeHtml(debugPayload.protocol)}</strong></div>
      <div class="summary-item"><span class="summary-key">安全</span><strong class="summary-value">${debugPayload.secureContext ? "可信" : "待信任"}</strong></div>
      <div class="summary-item"><span class="summary-key">显示模式</span><strong class="summary-value">${escapeHtml(debugPayload.displayMode)}</strong></div>
      <div class="summary-item"><span class="summary-key">安装事件</span><strong class="summary-value">${debugPayload.deferredPromptAvailable ? "可用" : "不可用"}</strong></div>
    </div>
    <h3>当前说明</h3>
    <p>默认优先 HTTPS 访问。当前服务会在可行时自动使用或生成本地证书；如果浏览器仍提示不安全，请通过“信任证书”处理。</p>
    <p>如果页面样式或按钮看起来像旧版本，即使服务已停止仍可打开，通常是旧的 Service Worker 和 Cache Storage 还在生效。此时可直接使用下方“清理本地缓存并刷新”。</p>
    <details class="debug-details">
      <summary>查看完整诊断信息</summary>
      <pre class="command-block">${escapeHtml(JSON.stringify(debugPayload, null, 2))}</pre>
    </details>
  `;

  openModal({
    eyebrow: "Settings",
    title: "设置与诊断",
    content: body,
    actions: [
      createActionButton("清理本地缓存并刷新", "primary-button", clearLocalSiteData),
      createActionButton("复制诊断信息", "secondary-button", () => copyText(JSON.stringify(debugPayload, null, 2), "环境诊断信息已复制。")),
      createActionButton("关闭", "ghost-button", closeModal),
    ],
  });
}

function updateShell() {
  platform.isMobile = platform.isIOS || platform.isAndroid || window.innerWidth <= 820;
  platform.isStandalone = displayModeStandalone.matches || window.navigator.standalone === true;
  document.body.classList.toggle("is-mobile", platform.isMobile);
  document.body.classList.toggle("is-desktop", !platform.isMobile);
  document.body.classList.toggle("is-standalone", platform.isStandalone);
  updateTopPills();
  openInstallButton.textContent = platform.isStandalone ? "卸载说明" : "安装到桌面";
  installHint.textContent = platform.isStandalone
    ? "当前正在通过桌面或主屏幕入口打开。"
    : (window.isSecureContext ? "当前默认处于 HTTPS 或可信环境。" : "当前可访问，但若要稳定安装建议先确保 HTTPS 被信任。");
}

function resetGame() {
  state.running = true;
  state.lastTime = 0;
  state.spawnTimer = 0;
  state.score = 0;
  state.obstacles = [];
  state.player.x = canvas.width / 2;
  state.player.vx = 0;
  updateHud("游戏中");
}

function updateHud(statusText) {
  scoreEl.textContent = String(Math.floor(state.score));
  bestScoreEl.textContent = String(state.bestScore);
  gameStateEl.textContent = statusText;
}

function setMovement(direction, active) {
  const speed = state.player.speed;
  if (!active) {
    if ((direction === -1 && state.player.vx < 0) || (direction === 1 && state.player.vx > 0)) {
      state.player.vx = 0;
    }
    return;
  }
  state.player.vx = direction * speed;
}

function addObstacle() {
  const size = 18 + Math.random() * 34;
  const minSpeed = 165;
  const difficultyBoost = Math.min(state.score * 2.4, 210);
  state.obstacles.push({
    x: size / 2 + Math.random() * (canvas.width - size),
    y: -size,
    size,
    speed: minSpeed + difficultyBoost + Math.random() * 120,
  });
}

function update(deltaSeconds) {
  state.player.x += state.player.vx * deltaSeconds;
  state.player.x = Math.max(state.player.radius, Math.min(canvas.width - state.player.radius, state.player.x));

  state.spawnTimer += deltaSeconds;
  const spawnInterval = Math.max(0.28, 0.82 - state.score * 0.015);
  if (state.spawnTimer >= spawnInterval) {
    state.spawnTimer = 0;
    addObstacle();
  }

  for (const obstacle of state.obstacles) {
    obstacle.y += obstacle.speed * deltaSeconds;
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.y - obstacle.size < canvas.height + 20);
  state.score += deltaSeconds * 10;

  for (const obstacle of state.obstacles) {
    if (hitsPlayer(obstacle)) {
      endGame();
      break;
    }
  }

  updateHud(state.running ? "游戏中" : "已结束");
}

function hitsPlayer(obstacle) {
  const closestX = Math.max(obstacle.x - obstacle.size / 2, Math.min(state.player.x, obstacle.x + obstacle.size / 2));
  const closestY = Math.max(obstacle.y - obstacle.size / 2, Math.min(state.player.y, obstacle.y + obstacle.size / 2));
  const dx = state.player.x - closestX;
  const dy = state.player.y - closestY;
  return dx * dx + dy * dy < state.player.radius * state.player.radius;
}

function endGame() {
  state.running = false;
  state.player.vx = 0;
  const finalScore = Math.floor(state.score);
  if (finalScore > state.bestScore) {
    state.bestScore = finalScore;
    localStorage.setItem(bestScoreKey, String(finalScore));
  }
  updateHud(`已结束 (${finalScore})`);
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(124, 155, 255, 0.10)";
  ctx.lineWidth = 1;
  for (let y = 40; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  const glow = ctx.createRadialGradient(state.player.x, state.player.y, 6, state.player.x, state.player.y, 28);
  glow.addColorStop(0, "rgba(157, 255, 218, 1)");
  glow.addColorStop(1, "rgba(157, 255, 218, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9dffda";
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.rotate(obstacle.y / 160);
    ctx.fillStyle = "#ff6688";
    ctx.fillRect(-obstacle.size / 2, -obstacle.size / 2, obstacle.size, obstacle.size);
    ctx.restore();
  }
}

function drawStatusText() {
  if (state.running) {
    return;
  }
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(232, 237, 255, 0.9)";
  ctx.font = "600 26px Inter, Segoe UI, sans-serif";
  ctx.fillText("点击开始游戏", canvas.width / 2, 100);
  ctx.font = "400 16px Inter, Segoe UI, sans-serif";
  ctx.fillStyle = "rgba(159, 176, 223, 0.95)";
  ctx.fillText("右上角可查看安装、证书与设置", canvas.width / 2, 132);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawObstacles();
  drawPlayer();
  drawStatusText();
}

function loop(timestamp) {
  if (state.running) {
    const deltaSeconds = state.lastTime ? (timestamp - state.lastTime) / 1000 : 0;
    state.lastTime = timestamp;
    update(Math.min(deltaSeconds, 0.032));
  }
  render();
  requestAnimationFrame(loop);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    state.serviceWorkerState = "不支持";
    updateShell();
    return;
  }
  navigator.serviceWorker.register("/sw.js")
    .then((registration) => {
      state.serviceWorkerState = registration.active ? "已激活" : "已注册";
      updateShell();
    })
    .catch(() => {
      state.serviceWorkerState = "注册失败";
      updateShell();
    });
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    updateShell();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    updateShell();
  });
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      setMovement(-1, true);
    }
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      setMovement(1, true);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      setMovement(-1, false);
    }
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      setMovement(1, false);
    }
  });
}

function bindTouch(button, direction) {
  const press = () => setMovement(direction, true);
  const release = () => setMovement(direction, false);
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
}

startButton.addEventListener("click", resetGame);
openInstallButton.addEventListener("click", showInstallModal);
openTrustButton.addEventListener("click", showTrustModal);
openSettingsButton.addEventListener("click", showSettingsModal);
closeModalButton.addEventListener("click", closeModal);
modalRoot.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    closeModal();
  }
});

bindKeyboard();
bindTouch(leftButton, -1);
bindTouch(rightButton, 1);
setupInstallPrompt();
registerServiceWorker();
updateShell();
window.addEventListener("resize", updateShell);
render();
requestAnimationFrame(loop);
