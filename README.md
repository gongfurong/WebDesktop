# WebDesktop

一个可安装、可离线运行、可作为桌面或主屏幕入口使用的轻量网页游戏示例。

一个用于探索 Web 应用桌面化、PWA 安装流程、本地 HTTPS 证书、以及面向人类与 AI 的文档体系设计的示例仓库。

An example repository for exploring web-to-desktop app flows, PWA installation paths, local HTTPS certificate tooling, and documentation design for both humans and AI.

## 文档入口

- 启动说明：见本文档
- 文档导航：`docs/README.md`
- 共享知识总览：`docs/knowledge/00-总览.md`
- 用户使用指南：`docs/human/用户使用指南.md`
- AI 路由入口：`docs/ai/00-入口路由.md`

## 先看哪份

- 如果你是使用者、测试或演示人员：先看 `docs/human/用户使用指南.md`
- 如果你是开发者或 AI 执行者：先看 `docs/ai/00-入口路由.md`
- 如果你想先理解通用原理：看 `docs/knowledge/00-总览.md`

## 项目特点

- 独立窗口安装
- `manifest.json`
- `service worker` 离线缓存
- 桌面与触摸控制
- 本地静态服务器
- iOS / iPadOS 添加到主屏幕引导

## 工程结构

- `examples/orbit-dash-pwa/`: 示例项目
- `scripts/`: 证书生成与平台辅助脚本
- `docs/knowledge/`: 人类与 AI 共用的模块化知识库
- `docs/human/`: 偏人类阅读、使用、测试与验收
- `docs/ai/`: 偏 AI 路由、策略、执行与输出

## 示例启动

```bash
node "examples/orbit-dash-pwa/server.js"
```

启动后，本地访问地址、局域网访问地址和端口号以终端输出为准。

如果你要让其他设备通过网络访问当前服务，并希望使用可信 HTTPS，需要先生成本地证书：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-cert.ps1 -ProjectRoot .\examples\orbit-dash-pwa
```

生成后再启动：

```bash
node "examples/orbit-dash-pwa/server.js"
```

生成后，服务会自动切换成 HTTPS；具体访问地址和端口以终端输出为准。

如果非本机访问地址发生变化，例如局域网 IP、主机名或域名变化，需要重新生成证书，把新的访问标识写进证书 SAN 列表。

脚本现在会同时做两件事：

- 生成一个本地根证书 CA
- 用这个 CA 给当前站点签发服务端证书，并自动安装到 Windows 当前用户信任根证书中

如果 Chrome 或 Edge 在运行中，请重启浏览器再测试。

## 提示

- 本机桌面开发：优先使用 `http://localhost:<port>`
- 跨设备本地联调：优先使用生成证书后的 `https://<host>`
- 当前证书生成与自动信任脚本仅覆盖 Windows；macOS / Linux 需要手动信任或改用正式 HTTPS / 隧道方案
- Windows 反向与清理脚本：`powershell -ExecutionPolicy Bypass -File .\scripts\manage-cert-windows.ps1 <remove|clean|reset|status> -ProjectRoot .\examples\orbit-dash-pwa`
- macOS 辅助脚本：`./scripts/install-cert-macos.sh install --project-root ./examples/orbit-dash-pwa`
- Linux 辅助脚本：`./scripts/install-cert-linux.sh install --project-root ./examples/orbit-dash-pwa --with-nss`
- iOS / iPadOS 主路径：`Safari -> 共享 -> 添加到主屏幕`
- Android 主路径：浏览器原生安装入口，或菜单中的“添加到主屏幕/安装应用”

## 安装验证

在 Chromium 桌面浏览器中打开后：

- 地址栏或菜单中应出现“安装应用”入口
- 安装后会生成桌面图标
- 再次打开会是独立窗口，而不是普通标签页

说明：桌面 Chromium 浏览器的安装体验依赖浏览器的可安装性判断。这个示例已经包含常见前提，但不同浏览器和不同版本的 UI 提示可能略有差异。

## 跨设备访问

启动后，终端会输出本地地址和一个或多个网络访问地址。任何非本机设备都可以使用这些网络地址访问当前服务，前提是：

- 访问设备与服务所在机器网络可达
- 防火墙允许对应端口
- 当前地址与证书配置匹配

如果是移动端设备：

- iOS / iPadOS：优先使用 Safari 打开，并通过“共享 -> 添加到主屏幕”安装入口
- Android：优先使用浏览器原生安装入口，或菜单中的“添加到主屏幕 / 安装应用”

如果使用本地 HTTPS：

- iOS / iPadOS 通常更适合通过 `mobileconfig` 安装信任证书
- 其他平台通常更适合传统证书文件导入
