# 开发、测试与发布

## 环境与安装

建议 Windows 10 / 11、Node.js 24 的最新维护版本、npm 和支持 WebGL 的显卡驱动。Windows x64 是当前桌面打包目标。

克隆仓库并进入目录后安装锁定版本的依赖：

```powershell
npm ci
```

需要 Playwright 的浏览器回归检查时，先运行：

```powershell
npx playwright install chromium
```

本项目使用 Node 的 `--use-env-proxy`，因此不要使用缺少该参数的旧版 Node。代理通过进程环境中的 `HTTPS_PROXY` / `HTTP_PROXY` 设置；`.env` 不会自动载入。桌面服务通过 Electron 的网络桥接读取远程资源。

## 启动

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动资源服务 3001 和 Vite 开发页 5173 |
| `npm run build` | 构建前端到 `dist/` |
| `npm start` | 从 3001 提供已构建的浏览器版 |
| `npm run desktop` | 先构建前端，再启动桌面应用 |
| `npm run desktop:dev` | 直接启动最近一次前端构建 |
| `npm run desktop:pack` | 构建 Windows 目录版到 `release/win-unpacked/` |
| `npm run desktop:build` | 构建 Windows x64 便携 exe |
| `npm run branding:icons` | 从 SVG 重建 ICO、PNG 和网页图标，需要 Chromium |

浏览器地址是 `http://127.0.0.1:5173` 或 `http://127.0.0.1:3001`。如果 3001 已占用，先结束已有开发服务。桌面内部服务使用随机本机端口，不依赖开发服务器。

## 源码结构

```text
desktop/       Electron 主进程、预加载桥接、资源子进程、软件图标
server/        目录、剧本解析、资源代理 / 缓存、队列、模型和特效下载
src/           主菜单、剧情选择、播放器、设置、Backlog 与资源管理 UI
public/        网页静态图标
tests/         Node 单元与资源服务测试
scripts/       浏览器 / 桌面回归、图标生成和画质抽查
docs/          使用、开发与架构说明
```

数据流和生命周期说明见 [架构说明](ARCHITECTURE.md)。功能及快捷键见 [使用说明](USER_GUIDE.md)。

## 验证

基础检查不依赖真实游戏资源：

```powershell
npm test
npm run build
node scripts/advance-smoke.mjs
node scripts/shortcuts-smoke.mjs
node scripts/unit-bgm-smoke.mjs
```

后三项需要 Chromium 和已有 `dist/`，使用临时本机服务、测试剧情与音频，不需要另外启动 `npm start`。`npm run test:resources` 也启动自己的临时服务与缓存目录，验证队列、共享资源和删除。

以下浏览器回归需要先保持 `npm start` 运行；真实目录 / 媒体检查还需要外网：

```powershell
npm run test:browser
npm run test:reader
npm run test:click-voice
npm run test:effects
npm run test:library
npm run test:regional
npm run test:personal
node scripts/avatars-smoke.mjs
```

`test:reader` 包含 Windows 自带 Arial 字体导入检查。生成的截图、临时测试状态与画质报告位于 `artifacts/`，不提交到仓库。

桌面回归会启动真实窗口并使用独立测试数据目录：

```powershell
npm run build
npm run test:desktop
```

验证指定的便携版：

```powershell
$env:SEKAI_TEST_EXE = (Resolve-Path 'release/SEKAI-NOVEL-0.1.5-x64.exe').Path
$env:SEKAI_TEST_DATA_DIR = 'artifacts/packaged-desktop-vn'
npm run test:desktop
```

`SEKAI_USER_DATA` 可为手动桌面运行指定独立数据目录。不要把真实存档目录用于清理测试；`SEKAI_TEST_CLEAR=1` 会让桌面回归清空它自己的测试缓存。

画质抽查需要联网：

```powershell
node --use-env-proxy scripts/image-quality-audit.mjs
```

## CI

GitHub Actions 在 Windows 与 Node.js 24 上安装锁定依赖，运行基础测试、前端构建与三个隔离的交互回归。CI 不打包 exe，不读取用户存档，也不下载真实游戏素材。

工作流使用官方 [actions/checkout](https://github.com/actions/checkout) 与 [actions/setup-node](https://github.com/actions/setup-node)。

## 发布

1. 同步修改 `package.json` 和 `package-lock.json` 的版本号，更新 [CHANGELOG](../CHANGELOG.md)。
2. 运行与变更相关的测试，再执行 `npm run desktop:build`。
3. 验证 `release/SEKAI-NOVEL-<版本>-x64.exe`，检查图标、版本、音画、存读档及退出行为。
4. 把 exe 作为 GitHub Release 附件上传；不把 `release/`、`dist/`、`node_modules/` 或游戏缓存写入 Git 历史。

如果打包器在当前网络中需要代理，可在当前 PowerShell 会话设置：

```powershell
$env:ELECTRON_GET_USE_PROXY = '1'
$env:GLOBAL_AGENT_HTTPS_PROXY = $env:HTTPS_PROXY
npm run desktop:build
```

当前 exe 没有代码签名。项目未配置证书或签名密钥。
