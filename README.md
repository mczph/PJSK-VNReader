<p align="center"><img src="desktop/assets/icon.svg" width="96" alt="SEKAI NOVEL 图标"></p>

# PJSK-VNReader · SEKAI NOVEL

将 Project SEKAI 剧情以视觉小说形式呈现的非官方阅读应用。提供 Windows 桌面版和浏览器版，使用 Electron、React、Express 与 Cubism / WebGL；剧情与素材按需从公开资源服务下载。

## 下载与使用

Windows 用户可在 [Releases](https://github.com/mczph/PJSK-VNReader/releases) 下载 x64 便携 exe，直接运行，无需安装 Node.js。首次读取目录及章节需要联网。

- [完整使用说明](docs/USER_GUIDE.md)：剧情、快捷键、存档、画质、下载与缓存管理。
- [开发与打包](docs/DEVELOPMENT.md)：源码运行、测试、CI 和发布步骤。
- [架构说明](docs/ARCHITECTURE.md)：桌面服务、剧本演出、音频生命周期与数据存储。
- [更新记录](CHANGELOG.md)：当前版本为 **0.1.5**。

## 功能

- 独立的主界面、剧情选择、设置、存档、Backlog 与资源管理界面，支持暗色模式和全屏操作。
- 日 / 国 / 台 / 国际 / 韩服主线、活动及个人剧情；主线按组合显示，个人剧情包含角色介绍、卡片前篇 / 后篇。
- 原剧情背景、配音、BGM、Live2D 角色及常见演出效果，主要出场角色展示 Q 版头像。
- 点击 / 空格先补全文字，文字完整后再次操作中断配音并快速推进；自动模式保留正常演出并等待文字、配音完成。
- 自动播放、快进、上一句、跳转、配音重播；8 个普通存档、快速存档与续读书签。
- Backlog 搜索、角色筛选、重播配音及返回对白；实际已读记录和手动标记。
- 主界面及组合页 BGM，音量设置、后台暂停，退出剧情清理旧语音。
- 字体导入、角色主题色、文字速度、标点停顿、自动间隔及透明对白遮罩。
- 每批最多 500 章的下载队列，暂停 / 继续 / 重试；缓存统计、文件全选、章节清理和一键清空。
- Live2D 性能档位、按出场加载、后台暂停及离开章节释放纹理。

## AI 辅助开发说明

本项目的代码实现、界面调整、测试脚本和说明文档大量使用 OpenAI Codex 辅助生成与修改。功能需求与设计方向由维护者提出，开发过程根据使用反馈持续迭代；生成的实现通过自动化测试和实际桌面运行检查进行验证。

AI 用于开发阶段，阅读器运行不依赖 AI 服务，也不使用 AI 生成、翻译或改写游戏剧情。剧情文本、配音、角色模型和背景等游戏素材来自文中列出的资源服务，保留原权利方的版权归属。

## 快速启动源码

使用 Node.js 24 的最新维护版本或更高版本。克隆本仓库并进入目录后运行：

```powershell
npm ci
npm run desktop
```

浏览器开发：

```powershell
npm run dev
```

访问 `http://127.0.0.1:5173`。构建后的浏览器版使用 `npm run build`、`npm start`，地址为 `http://127.0.0.1:3001`。Windows 便携版使用 `npm run desktop:build` 打包，产物位于 `release/`。

## 常用快捷键

| 按键 | 功能 |
| --- | --- |
| Space / Enter / → | 补全文字；文字完整后推进 |
| A / K / 按住 Ctrl | 自动 / 持续快进 / 临时快进 |
| S 或 F5 / F9 | 快速存档 / 快速读档 |
| Shift+S / L | 存档菜单 / 读档菜单 |
| B 或 Backspace | Backlog |
| J / V / H | 跳转 / 重播配音 / 隐藏对白 |
| Esc / F | 阅读设置或关闭菜单 / 全屏 |

完整按键说明见 [使用文档](docs/USER_GUIDE.md#快捷键)，也可在应用设置和按钮提示中查看。桌面版另支持 F11 原生全屏。

## 数据与资源

桌面版素材缓存位于应用数据目录的 `cache/`；设置、存档、续读与已读记录镜像到 `reader-state.json`。设置页可打开数据目录、导入 / 导出存档备份。浏览器版使用当前站点的 localStorage；导入字体保存在 IndexedDB。

资源按需下载并按来源 URL 去重。缺失媒体可尝试日服同路径文件，剧情文本保留所选服务器原文，没有机器翻译。当前图片采用原尺寸 WebP，部分文件存在有损压缩，不能称为全部最高画质；Live2D 保留模型原始纹理，显示精度受性能设置影响。尺寸抽查和复查方法见 [使用说明](docs/USER_GUIDE.md#画面音量与画质)。

仓库只包含程序源码、软件图标、锁定依赖清单、测试和文档；不上传下载的游戏素材、用户存档、字体、依赖目录或本地测试数据。exe 通过 Release 附件分发。

## 检查与当前范围

```powershell
npm test
npm run build
```

交互、真实音画与桌面回归的运行条件见 [开发文档](docs/DEVELOPMENT.md#验证)。GitHub Actions 运行基础测试、构建和隔离的阅读 / 音频 / 快捷键回归。

尚未实现区域 / 特殊剧情、姓名输入和剧情分支。演出不是 Unity 原渲染器的完整移植；部分粒子、转场、特殊着色器和卡面 CG 指令存在差异，新模型或特殊资源可能需要进一步适配。桌面封装本身不保证性能提升。

## 致谢与素材来源

- [pjsk.cleista.cc](https://pjsk.cleista.cc/)：剧情分类和阅读体验参考。
- [MySekaiStoryteller](https://github.com/Untitled-Story/MySekaiStoryteller)：演出播放器设计参考，本项目未复制其实现代码。
- [Sekai-World](https://github.com/Sekai-World) 与 [sekai-viewer](https://github.com/Sekai-World/sekai-viewer)：公开 master 数据、资源路径与脚本字段参考。
- [sekai.best](https://sekai.best/)：游戏资源服务。
- [Live2D](https://www.live2d.com/)：Cubism 运行库；本仓库不内置 Cubism Core，运行时从官方地址获取。

游戏素材版权属于 SEGA / Colorful Palette / Crypton 等原权利方。本项目为非官方同人阅读工具，与官方没有关联。软件依赖及第三方资源保留各自的许可证和权利归属。
