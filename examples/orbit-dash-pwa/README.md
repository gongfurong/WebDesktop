# Orbit Dash Example

这是一个最小可安装 Web App / PWA 示例项目。

## 当前覆盖范围

- 桌面端：Windows、macOS、Linux
- 移动端：iOS / iPadOS、Android
- 浏览器主路径：Chrome、Edge
- 浏览器备选：Brave、Opera、Safari（部分能力）
- 弱支持浏览器：Firefox 仅建议用于浏览与调试

示例页面本身会根据当前系统、浏览器和安全状态自动切换安装与证书引导。

## 启动

在当前目录运行：

```bash
node server.js
```

## 本地 HTTPS

从仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-cert.ps1 -ProjectRoot .\examples\orbit-dash-pwa
```

Windows 反向与清理：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\manage-cert-windows.ps1 status -ProjectRoot .\examples\orbit-dash-pwa
powershell -ExecutionPolicy Bypass -File .\scripts\manage-cert-windows.ps1 remove -ProjectRoot .\examples\orbit-dash-pwa
powershell -ExecutionPolicy Bypass -File .\scripts\manage-cert-windows.ps1 clean -ProjectRoot .\examples\orbit-dash-pwa
powershell -ExecutionPolicy Bypass -File .\scripts\manage-cert-windows.ps1 reset -ProjectRoot .\examples\orbit-dash-pwa
powershell -ExecutionPolicy Bypass -File .\scripts\manage-cert-windows.ps1 reset -ProjectRoot .\examples\orbit-dash-pwa -DryRun
```

macOS：

```bash
./scripts/install-cert-macos.sh install --project-root ./examples/orbit-dash-pwa
./scripts/install-cert-macos.sh remove --project-root ./examples/orbit-dash-pwa
./scripts/install-cert-macos.sh clean --project-root ./examples/orbit-dash-pwa
./scripts/install-cert-macos.sh reset --project-root ./examples/orbit-dash-pwa
./scripts/install-cert-macos.sh reset --project-root ./examples/orbit-dash-pwa --dry-run
```

Linux：

```bash
./scripts/install-cert-linux.sh install --project-root ./examples/orbit-dash-pwa --with-nss
./scripts/install-cert-linux.sh remove --project-root ./examples/orbit-dash-pwa --with-nss
./scripts/install-cert-linux.sh clean --project-root ./examples/orbit-dash-pwa
./scripts/install-cert-linux.sh reset --project-root ./examples/orbit-dash-pwa --with-nss
./scripts/install-cert-linux.sh reset --project-root ./examples/orbit-dash-pwa --with-nss --dry-run
```

## 相关文档

- 仓库首页：`../../README.md`
- 文档导航：`../../docs/README.md`
- 共享知识总览：`../../docs/knowledge/00-总览.md`
- 示例项目说明与测试：`../../docs/knowledge/10-示例项目说明与测试.md`
- 用户使用指南：`../../docs/human/用户使用指南.md`
- AI 路由入口：`../../docs/ai/00-入口路由.md`

## 旧缓存排查

如果你改了页面代码，但浏览器里看起来还是旧版本，甚至服务停止后页面还能打开，通常是旧的 Service Worker 和 Cache Storage 还在生效。

优先处理方式：

1. 启动当前最新版服务
2. 打开页面右上角 `设置`
3. 点击 `清理本地缓存并刷新`

如果仍未恢复，再使用浏览器开发者工具手动：

- Unregister Service Worker
- Clear site data
