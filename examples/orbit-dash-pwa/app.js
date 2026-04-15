const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const gameStateEl = document.getElementById("gameState");
const startButton = document.getElementById("startButton");
const installButton = document.getElementById("installButton");
const installHint = document.getElementById("installHint");
const installGuide = document.getElementById("installGuide");
const installSteps = document.getElementById("installSteps");
const platformBadge = document.getElementById("platformBadge");
const runtimePlatformEl = document.getElementById("runtimePlatform");
const runtimeBrowserEl = document.getElementById("runtimeBrowser");
const runtimeSupportEl = document.getElementById("runtimeSupport");
const runtimeProtocolEl = document.getElementById("runtimeProtocol");
const runtimeSecureContextEl = document.getElementById("runtimeSecureContext");
const runtimeDisplayModeEl = document.getElementById("runtimeDisplayMode");
const runtimeInstallPromptEl = document.getElementById("runtimeInstallPrompt");
const runtimeServiceWorkerEl = document.getElementById("runtimeServiceWorker");
const runtimeTouchEl = document.getElementById("runtimeTouch");
const debugDetailsEl = document.getElementById("debugDetails");
const copyDebugButton = document.getElementById("copyDebugButton");
const mainPathTitleEl = document.getElementById("mainPathTitle");
const mainPathTextEl = document.getElementById("mainPathText");
const fallbackPathTitleEl = document.getElementById("fallbackPathTitle");
const fallbackPathTextEl = document.getElementById("fallbackPathText");
const avoidPathTitleEl = document.getElementById("avoidPathTitle");
const avoidPathTextEl = document.getElementById("avoidPathText");
const nextActionLeadEl = document.getElementById("nextActionLead");
const primaryActionButton = document.getElementById("primaryActionButton");
const secondaryActionButton = document.getElementById("secondaryActionButton");
const certificateGuide = document.getElementById("certificateGuide");
const certificateBadge = document.getElementById("certificateBadge");
const certificateLead = document.getElementById("certificateLead");
const certificateSteps = document.getElementById("certificateSteps");
const downloadCertButton = document.getElementById("downloadCertButton");
const refreshTrustButton = document.getElementById("refreshTrustButton");
const desktopGuide = document.getElementById("desktopGuide");
const desktopBadge = document.getElementById("desktopBadge");
const desktopLead = document.getElementById("desktopLead");
const desktopSteps = document.getElementById("desktopSteps");
const desktopCommands = document.getElementById("desktopCommands");
const copyDesktopCommandsButton = document.getElementById("copyDesktopCommandsButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");

const bestScoreKey = "orbit-dash-best-score";

const userAgent = navigator.userAgent;
const displayModeStandalone = window.matchMedia("(display-mode: standalone)");
const platform = {
  isIOS:
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  isAndroid: /Android/i.test(userAgent),
  isSafari: /Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/i.test(userAgent),
  isTouch: window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0,
};

platform.isWindows = /Windows/i.test(userAgent);
platform.isMac = /Macintosh|Mac OS X/i.test(userAgent) && !platform.isIOS;
platform.isLinux = /Linux/i.test(userAgent) && !platform.isAndroid;
platform.browser = detectBrowser();

platform.isMobile = platform.isIOS || platform.isAndroid || window.innerWidth <= 820;
platform.isStandalone = displayModeStandalone.matches || window.navigator.standalone === true;

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

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setInstallGuide(badgeText, steps) {
  platformBadge.textContent = badgeText;
  installSteps.innerHTML = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  installGuide.hidden = steps.length === 0;
}

function setCertificateGuide(badgeText, leadText, steps, visible) {
  certificateBadge.textContent = badgeText;
  certificateLead.textContent = leadText;
  certificateSteps.innerHTML = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  certificateGuide.hidden = !visible;
}

function setDesktopGuide(badgeText, leadText, steps, commands) {
  desktopBadge.textContent = badgeText;
  desktopLead.textContent = leadText;
  desktopSteps.innerHTML = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  desktopGuide.hidden = steps.length === 0 && !commands;
  desktopCommands.hidden = !commands;
  desktopCommands.textContent = commands || "";
  copyDesktopCommandsButton.hidden = !commands;
}

function setDecisionCard(titleEl, textEl, title, text) {
  titleEl.textContent = title;
  textEl.textContent = text;
}

function setChipTone(element, tone) {
  element.classList.remove("tone-strong", "tone-medium", "tone-weak", "tone-neutral");
  element.classList.add(tone || "tone-neutral");
}

async function copyText(text, successMessage) {
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    installHint.textContent = successMessage;
  } catch {
    installHint.textContent = "复制失败，请手动选中复制。";
  }
}

function detectBrowser() {
  if (/Edg/i.test(userAgent)) {
    return "Edge";
  }
  if (/OPR|Opera/i.test(userAgent)) {
    return "Opera";
  }
  if (/Brave/i.test(navigator.userAgentData?.brands?.map((brand) => brand.brand).join(" ") || "")) {
    return "Brave";
  }
  if (/Firefox|FxiOS/i.test(userAgent)) {
    return "Firefox";
  }
  if (/Chrome|Chromium|CriOS/i.test(userAgent) && !/Edg|OPR/i.test(userAgent)) {
    return navigator.brave ? "Brave" : "Chrome";
  }
  if (platform.isSafari) {
    return "Safari";
  }
  return "Other";
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

function getSupportLevel(secureContext) {
  if (platform.isIOS) {
    return "主屏幕路径";
  }
  if (platform.isAndroid) {
    return secureContext ? (state.deferredPrompt ? "安装支持强" : "菜单安装") : "仅临时访问";
  }
  if (platform.browser === "Chrome" || platform.browser === "Edge") {
    return secureContext || location.hostname === "localhost" ? "安装支持强" : "仅临时访问";
  }
  if (platform.browser === "Brave" || platform.browser === "Opera") {
    return secureContext || location.hostname === "localhost" ? "安装支持中" : "仅临时访问";
  }
  if (platform.browser === "Safari") {
    return platform.isMac ? "部分支持" : "主屏幕路径";
  }
  if (platform.browser === "Firefox") {
    return "浏览优先";
  }
  return "视浏览器而定";
}

function getSupportTone(level) {
  if (["安装支持强", "主屏幕路径", "已激活", "支持", "是", "standalone", "可用"].includes(level)) {
    return "tone-strong";
  }
  if (["安装支持中", "菜单安装", "部分支持", "已注册", "browser"].includes(level)) {
    return "tone-medium";
  }
  if (["仅临时访问", "浏览优先", "不可用", "注册失败", "否", "不支持"].includes(level)) {
    return "tone-weak";
  }
  return "tone-neutral";
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

function getDebugPayload(secureContext) {
  return {
    platform: describePlatform(),
    browser: platform.browser,
    support: getSupportLevel(secureContext),
    protocol: location.protocol,
    host: location.host,
    secureContext,
    displayMode: getDisplayModeLabel(),
    standalone: platform.isStandalone,
    deferredPromptAvailable: Boolean(state.deferredPrompt),
    serviceWorker: state.serviceWorkerState,
    touch: platform.isTouch,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent,
  };
}

function updateRuntimeCards(secureContext) {
  runtimePlatformEl.textContent = describePlatform();
  runtimeBrowserEl.textContent = platform.browser;
  runtimeSupportEl.textContent = getSupportLevel(secureContext);
  runtimeProtocolEl.textContent = location.protocol.replace(":", "");
  runtimeSecureContextEl.textContent = secureContext ? "是" : "否";
  runtimeDisplayModeEl.textContent = getDisplayModeLabel();
  runtimeInstallPromptEl.textContent = state.deferredPrompt ? "可用" : "不可用";
  runtimeServiceWorkerEl.textContent = state.serviceWorkerState;
  runtimeTouchEl.textContent = platform.isTouch ? "支持" : "不支持";
  [
    runtimePlatformEl,
    runtimeBrowserEl,
    runtimeProtocolEl,
    runtimeDisplayModeEl,
  ].forEach((el) => setChipTone(el, "tone-neutral"));
  setChipTone(runtimeSupportEl, getSupportTone(runtimeSupportEl.textContent));
  setChipTone(runtimeSecureContextEl, getSupportTone(runtimeSecureContextEl.textContent));
  setChipTone(runtimeInstallPromptEl, getSupportTone(runtimeInstallPromptEl.textContent));
  setChipTone(runtimeServiceWorkerEl, getSupportTone(runtimeServiceWorkerEl.textContent));
  setChipTone(runtimeTouchEl, getSupportTone(runtimeTouchEl.textContent));
  debugDetailsEl.textContent = JSON.stringify(getDebugPayload(secureContext), null, 2);
}

function setActionButtons(primaryLabel, primaryHandler, secondaryLabel, secondaryHandler, lead) {
  nextActionLeadEl.textContent = lead;
  primaryActionButton.textContent = primaryLabel;
  primaryActionButton.onclick = primaryHandler;
  if (secondaryLabel && secondaryHandler) {
    secondaryActionButton.hidden = false;
    secondaryActionButton.textContent = secondaryLabel;
    secondaryActionButton.onclick = secondaryHandler;
    return;
  }

  secondaryActionButton.hidden = true;
  secondaryActionButton.onclick = null;
}

function updateDecisionCards(secureContext) {
  if (platform.isIOS) {
    setDecisionCard(mainPathTitleEl, mainPathTextEl, "Safari 添加到主屏幕", "主路径是 Safari 的“共享 -> 添加到主屏幕”，它是 iOS / iPadOS 最稳定的安装方式。");
    setDecisionCard(fallbackPathTitleEl, fallbackPathTextEl, "继续访问后手动安装", "若当前链接有风险提示，可先继续访问，再按主屏幕路径完成安装。");
    setDecisionCard(avoidPathTitleEl, avoidPathTextEl, "不要等待标准安装弹窗", "iOS / iPadOS 通常不是通过桌面 Chromium 那种标准安装弹窗来完成安装。" );
    setActionButtons(
      "查看主屏幕安装",
      () => installGuide.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      "安装 iOS 证书",
      () => downloadCertButton.click(),
      "当前环境最推荐的下一步是使用 Safari 的主屏幕安装路径。",
    );
    return;
  }

  if (platform.isAndroid) {
    setDecisionCard(mainPathTitleEl, mainPathTextEl, state.deferredPrompt && secureContext ? "浏览器原生安装" : "浏览器菜单安装", state.deferredPrompt && secureContext
      ? "当前环境支持原生安装，优先使用页面按钮或浏览器原生安装入口。"
      : "如果没有原生安装入口，主路径改为浏览器菜单中的“添加到主屏幕”或“安装应用”。");
    setDecisionCard(fallbackPathTitleEl, fallbackPathTextEl, "可信 HTTPS", "如果你要稳定验证 Android 安装能力，请尽量使用可信 HTTPS 地址。");
    setDecisionCard(avoidPathTitleEl, avoidPathTextEl, "不建议主推证书安装", "Android 更适合可信 HTTPS + 浏览器原生安装，而不是把证书导入当主路径。" );
    setActionButtons(
      state.deferredPrompt && secureContext ? "安装到主屏幕" : "查看菜单安装步骤",
      () => {
        if (state.deferredPrompt && secureContext) {
          installButton.click();
          return;
        }
        installGuide.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
      secureContext ? null : "查看证书说明",
      secureContext ? null : () => certificateGuide.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      state.deferredPrompt && secureContext
        ? "当前环境已具备较强的 Android 安装条件。"
        : "当前环境更适合通过浏览器菜单完成安装。",
    );
    return;
  }

  if (platform.browser === "Firefox") {
    setDecisionCard(mainPathTitleEl, mainPathTextEl, "改用 Chromium 主路径", "桌面端主路径建议切到 Chrome 或 Edge，以获得更完整的安装入口。" );
    setDecisionCard(fallbackPathTitleEl, fallbackPathTextEl, "当前浏览器可继续浏览", "Firefox 更适合浏览和调试普通页面功能。" );
    setDecisionCard(avoidPathTitleEl, avoidPathTextEl, "不推荐当桌面安装主路径", "Firefox 通常不是桌面 Web App 安装的主验证浏览器。" );
    setActionButtons(
      "查看桌面差异",
      () => desktopGuide.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      "复制诊断信息",
      () => copyDebugButton.click(),
      "当前浏览器更适合作为浏览与调试路径，而不是安装主路径。",
    );
    return;
  }

  if (platform.browser === "Safari") {
    setDecisionCard(mainPathTitleEl, mainPathTextEl, "桌面 Safari 仅作部分验证", "桌面 Safari 可验证普通访问与部分站点应用能力，但安装体验通常不如 Chromium 完整。" );
    setDecisionCard(fallbackPathTitleEl, fallbackPathTextEl, "改用 Chrome / Edge", "如果你要验证更完整的桌面安装入口，建议切到 Chrome 或 Edge。" );
    setDecisionCard(avoidPathTitleEl, avoidPathTextEl, "不要只在 Safari 验收", "桌面 Safari 不适合作为唯一桌面安装验收路径。" );
    setActionButtons(
      "查看桌面差异",
      () => desktopGuide.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      secureContext ? null : "查看证书说明",
      secureContext ? null : () => desktopGuide.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      "当前浏览器适合部分验证，但更完整的桌面安装建议用 Chromium 浏览器。",
    );
    return;
  }

  setDecisionCard(mainPathTitleEl, mainPathTextEl, "Chromium 原生安装", secureContext || location.hostname === "localhost"
    ? "当前浏览器与地址条件更接近桌面 Web App 主路径。优先使用浏览器原生安装入口。"
    : "当前浏览器较适合作为桌面安装主路径，但当前地址条件还不够稳定。" );
  setDecisionCard(fallbackPathTitleEl, fallbackPathTextEl, "切回 localhost 或可信 HTTPS", "如果安装入口未出现，优先检查当前是否仍在 localhost 或可信 HTTPS 地址上。" );
  setDecisionCard(avoidPathTitleEl, avoidPathTextEl, "不要把临时地址当正式路径", "不安全网络地址更适合调试访问，不适合作为稳定安装主路径。" );
  setActionButtons(
    state.deferredPrompt ? "安装桌面应用" : "查看桌面说明",
    () => {
      if (state.deferredPrompt) {
        installButton.click();
        return;
      }
      desktopGuide.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    desktopCommands.hidden ? null : "复制桌面命令",
    desktopCommands.hidden ? null : () => copyDesktopCommandsButton.click(),
    state.deferredPrompt
      ? "当前环境已接近桌面安装主路径。"
      : "当前环境还可继续优化，优先检查地址、安全上下文和浏览器支持度。",
  );
}

function getDesktopCertificateCommands() {
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

function updateCertificateDownloadLink() {
  if (platform.isIOS) {
    downloadCertButton.href = "/ios-root-ca.mobileconfig";
    downloadCertButton.textContent = "安装 iOS 证书";
    return;
  }

  downloadCertButton.href = "/root-ca-cert.cer";
  downloadCertButton.textContent = "下载根证书";
}

function refreshShellMode() {
  platform.isMobile = platform.isIOS || platform.isAndroid || window.innerWidth <= 820;
  platform.isStandalone = displayModeStandalone.matches || window.navigator.standalone === true;
  document.body.classList.toggle("is-mobile", platform.isMobile);
  document.body.classList.toggle("is-desktop", !platform.isMobile);
  document.body.classList.toggle("is-standalone", platform.isStandalone);
}

function describeDevice() {
  if (platform.isIOS) {
    return "iOS / iPadOS";
  }
  if (platform.isAndroid) {
    return "Android";
  }
  if (platform.isMobile) {
    return "移动浏览器";
  }
  return "桌面浏览器";
}

function updateInstallUi() {
  refreshShellMode();
  const secureContext = window.isSecureContext;
  updateCertificateDownloadLink();
  updateRuntimeCards(secureContext);
  setCertificateGuide("证书步骤", "先完成证书信任，浏览器才能把当前页面当作真正安全站点。", [], false);
  setDesktopGuide("桌面提示", "桌面端会根据当前系统和浏览器显示更细的安装与证书说明。", [], "");
  updateDecisionCards(secureContext);

  if (platform.isStandalone) {
    installButton.hidden = true;
    installHint.textContent = "你正在通过桌面或主屏幕图标打开。";
    setInstallGuide(`${describeDevice()} · 已安装`, ["现在它会以独立窗口打开，使用方式更接近原生应用。"]);
    if (!platform.isMobile) {
      setDesktopGuide(`${describePlatform()} · 已安装`, "当前窗口已经以站点应用或独立窗口模式运行。", [
        "此时说明系统里已有桌面入口，后续可直接从图标打开。",
      ], "");
    }
    updateDecisionCards(secureContext);
    return;
  }

  if (platform.isIOS) {
    installButton.hidden = false;
    installButton.textContent = "查看主屏幕安装";
    installHint.textContent = "iOS / iPadOS 请通过 Safari 的“共享 -> 添加到主屏幕”完成安装。";
    setInstallGuide(`${describeDevice()} · Safari`, [
      "请用 Safari 打开当前页面。",
      "点击底部“共享”按钮。",
      "选择“添加到主屏幕”。",
      "确认名称后点击“添加”，以后就能直接从主屏幕进入。",
    ]);
    setCertificateGuide(
      `${describeDevice()} · 可选证书步骤`,
      secureContext
        ? "如果你只想添加到主屏幕，可以直接继续。若想减少安全提示并获得更稳定的本地 HTTPS 体验，可选安装 iOS 证书。"
        : "当前链接还没有被 iOS / iPadOS 完全信任。你仍可继续访问并添加到主屏幕；如果想减少不安全提示，可以先安装并信任 iOS 证书。",
      [
        "点击“安装 iOS 证书”。",
        "前往“设置 -> 通用 -> VPN 与设备管理”完成安装。",
        "再到“设置 -> 通用 -> 关于本机 -> 证书信任设置”中开启完全信任。",
        "回到当前页面后点击“我已处理，重新检查”。",
      ],
      true,
    );
    updateDecisionCards(secureContext);
    return;
  }

  if (platform.isAndroid) {
    if (state.deferredPrompt && secureContext) {
      installButton.hidden = false;
      installButton.textContent = "安装到主屏幕";
      installHint.textContent = "当前浏览器支持安装，可以直接添加到主屏幕。";
      setInstallGuide(`${describeDevice()} · 可直接安装`, [
        "点击上方安装按钮。",
        "确认后会自动创建主屏幕入口。",
        "如果浏览器菜单里也有“安装应用”，优先使用原生入口。",
      ]);
      updateDecisionCards(secureContext);
      return;
    }

    installButton.hidden = true;
    installHint.textContent = secureContext
      ? "如果浏览器没有直接显示安装按钮，请打开浏览器菜单，选择“添加到主屏幕”或“安装应用”。"
      : "当前链接安全性不足，Android 浏览器通常不会提供完整安装入口。你可以临时继续访问；如需稳定安装，请改用可信 HTTPS。";
    setInstallGuide(`${describeDevice()} · 浏览器菜单安装`, [
      secureContext
        ? "优先查找浏览器原生的“安装应用”或“添加到主屏幕”。"
        : "当前地址更适合临时调试，不适合作为稳定安装入口。",
      "如果浏览器没有自动弹出安装提示，请打开右上角菜单。",
      "选择“添加到主屏幕”或“安装应用”。",
    ]);
    updateDecisionCards(secureContext);
    return;
  }

  if (platform.browser === "Firefox") {
    installButton.hidden = true;
    installHint.textContent = "当前是 Firefox。它更适合作为浏览与调试浏览器，不建议作为桌面安装主路径。";
    setInstallGuide(`${describePlatform()} · Firefox`, [
      "建议改用 Chrome 或 Edge 获取更完整的桌面安装体验。",
      "当前浏览器仍可用于浏览页面和调试普通功能。",
    ]);
    setDesktopGuide(`${describePlatform()} · 浏览器差异`, "当前浏览器支持度较弱，示例会给出建议路径。", [
      "主路径：Chrome / Edge。",
      "备选路径：Brave / Opera。",
      "当前浏览器：更适合浏览与调试，不建议作为安装主路径。",
    ], "");
    updateDecisionCards(secureContext);
    return;
  }

  if (platform.browser === "Safari") {
    installButton.hidden = true;
    installHint.textContent = "当前是桌面 Safari。可用部分能力，但安装体验通常不如 Chromium 完整。";
    setInstallGuide(`${describePlatform()} · Safari`, [
      "如果你只验证普通访问与部分站点应用能力，当前浏览器可以继续使用。",
      "如果你要验证更完整的安装入口，建议改用 Chrome 或 Edge。",
    ]);
    setDesktopGuide(`${describePlatform()} · Safari`, "桌面 Safari 可用部分能力，但不建议作为唯一安装验证路径。", [
      "主路径：Chrome / Edge。",
      "当前浏览器：可浏览与验证部分能力。",
      secureContext ? "若需消除安全提示，先把根证书导入系统钥匙串。" : "若当前地址不安全，先使用可信 HTTPS。",
    ], platform.isMac ? getDesktopCertificateCommands() : "");
    updateDecisionCards(secureContext);
    return;
  }

  if (state.deferredPrompt) {
    installButton.hidden = false;
    installButton.textContent = "安装桌面应用";
    installHint.textContent = "当前浏览器支持安装，可直接生成桌面应用入口。";
    setInstallGuide(`${describeDevice()} · 可直接安装`, [
      "点击上方安装按钮。",
      "确认后会自动创建桌面应用入口。",
      "以后可直接从桌面图标打开，不必先进入浏览器页面。",
    ]);
    setDesktopGuide(`${describePlatform()} · ${platform.browser}`, "当前组合适合作为桌面安装主路径。", [
      "当前浏览器通常会提供标准安装入口。",
      secureContext || location.hostname === "localhost"
        ? "当前地址条件满足后，桌面安装体验通常较稳定。"
        : "若当前地址不是 localhost 或可信 HTTPS，安装入口可能不出现。",
    ], !secureContext && location.hostname !== "localhost" ? getDesktopCertificateCommands() : "");
    updateDecisionCards(secureContext);
    return;
  }

  installButton.hidden = true;
  installHint.textContent = secureContext || location.hostname === "localhost"
    ? "如果当前浏览器支持安装，地址栏或菜单里会出现“安装应用”入口。"
    : "当前地址通常不满足桌面安装条件。开发时优先使用 localhost 或可信 HTTPS 地址。";
  setInstallGuide(`${describeDevice()} · 浏览器模式`, [
    secureContext || location.hostname === "localhost"
      ? "推荐用 Chrome 或 Edge 打开，以获得更完整的桌面安装体验。"
      : "当前地址更适合浏览调试，不适合作为稳定桌面安装入口。",
  ]);
  setDesktopGuide(`${describePlatform()} · ${platform.browser}`, secureContext || location.hostname === "localhost"
    ? "当前组合可继续浏览与测试；如果浏览器未给安装按钮，请检查浏览器支持度与安装条件。"
    : "当前地址条件不足，更适合作为临时访问或调试路径。", [
    secureContext || location.hostname === "localhost"
      ? "优先用 Chrome / Edge 获取桌面安装入口。"
      : "优先切回 localhost 或可信 HTTPS 地址。",
    platform.browser === "Brave" || platform.browser === "Opera"
      ? "当前浏览器通常可用，但入口位置和行为可能与 Chrome 不完全一致。"
      : "如果你当前浏览器不提供安装入口，请尝试主路径浏览器。",
  ], !secureContext && location.hostname !== "localhost" ? getDesktopCertificateCommands() : "");
  updateDecisionCards(secureContext);
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
  ctx.fillText("安装后它会像桌面应用一样独立打开", canvas.width / 2, 132);
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
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        state.serviceWorkerState = registration.active ? "已激活" : "已注册";
        updateInstallUi();
      })
      .catch(() => {
        state.serviceWorkerState = "注册失败";
        installHint.textContent = "Service Worker 注册失败，安装和离线能力可能不可用。";
        updateInstallUi();
      });
    return;
  }

  state.serviceWorkerState = "不支持";
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    updateInstallUi();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    updateInstallUi();
  });

  installButton.addEventListener("click", async () => {
    if (platform.isIOS) {
      installGuide.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (!state.deferredPrompt) {
      return;
    }
    await state.deferredPrompt.prompt();
    state.deferredPrompt = null;
    updateInstallUi();
  });

  if (typeof displayModeStandalone.addEventListener === "function") {
    displayModeStandalone.addEventListener("change", updateInstallUi);
  } else if (typeof displayModeStandalone.addListener === "function") {
    displayModeStandalone.addListener(updateInstallUi);
  }
}

refreshTrustButton.addEventListener("click", () => {
  window.location.reload();
});

copyDesktopCommandsButton.addEventListener("click", async () => {
  await copyText(desktopCommands.textContent, "桌面证书与启动命令已复制。");
});

copyDebugButton.addEventListener("click", async () => {
  await copyText(debugDetailsEl.textContent, "环境诊断信息已复制。");
});

downloadCertButton.addEventListener("click", () => {
  installHint.textContent = platform.isIOS
    ? "描述文件下载后，请前往设置完成安装，并在证书信任设置里开启完全信任。"
    : "证书下载后，请在系统或浏览器中完成信任，再刷新页面。";
});

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
bindKeyboard();
bindTouch(leftButton, -1);
bindTouch(rightButton, 1);
setupInstallPrompt();
registerServiceWorker();
window.addEventListener("resize", updateInstallUi);
updateInstallUi();
render();
requestAnimationFrame(loop);
