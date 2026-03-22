# Recordly

语言: [EN](README.md) | 简中

<p align="center">
  <img src="https://i.postimg.cc/tRnL8gHp/Frame-5.png" width="220" alt="Recordly logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-111827?style=for-the-badge" alt="macOS Windows Linux" />
  <img src="https://img.shields.io/badge/open%20source-MIT-2563eb?style=for-the-badge" alt="MIT license" />
</p>

### 制作精致、专业级的屏幕录制视频。
[Recordly](https://www.recordly.dev) 是一款开源的录屏与编辑工具，适合制作演示、讲解、教程、产品视频和社交媒体短片。你可以录制屏幕或窗口，直接进入编辑器，并通过光标特效、缩放、背景、注释、摄像头叠加等功能快速导出更完整的成片。

<p align="center">
  <img src="./demo.gif" width="750" alt="Recordly demo video">
</p>

> [!NOTE]
> 非常感谢 **tadees** 对项目的支持。这笔捐助帮助承担了 macOS 签名与公证所需的 Apple Developer 费用。
[**支持项目**](https://ko-fi.com/webadderall/goal?g=0)

---

## Recordly 是什么？

Recordly 是一款桌面应用，用于录制和编辑屏幕内容，并内置了面向演示视频的运动表达工具。你不需要先导出原始录像、再切到另一个编辑器去补缩放、光标润色或背景样式，Recordly 会在同一个工作流里完成这些事情。

Recordly 支持以下平台：

- **macOS** 12.3+
- **Windows** 10 Build 19041+
- **Linux** 现代发行版

平台说明：

- **macOS** 使用原生的 ScreenCaptureKit 捕获辅助程序。
- **Windows** 在支持的系统版本上使用原生 Windows Graphics Capture（WGC）辅助程序，并支持原生 WASAPI 音频。
- **Linux** 通过 Electron 捕获 API 录制。目前 Linux 不支持隐藏真实光标。

---

# 核心功能

## 自动缩放、光标润色与画面样式
Recordly 可以根据操作自动强调重点区域，平滑光标运动，添加运动特效，并将最终画面放进带有壁纸、纯色、渐变、模糊、留白和阴影的样式化边框中。

<p>
  <img src="./feature1.gif" width="450" alt="Recordly cursor and zoom demo video">
</p>

## 动态摄像头气泡叠加
你可以把摄像头素材作为气泡叠加层加入画面，使用预设位置或自定义坐标摆放，支持镜像、阴影、圆角调节，也可以让它跟随缩放变化，保证运动镜头中整体视觉更协调。

<p>
  <img src="./feature2.gif" width="450" alt="Recordly webcam overlay demo video">
</p>

## 为演示而设计的时间线编辑
通过拖拽式时间线工具添加缩放、裁剪、变速、注释、额外音轨和裁切等内容，并将工程保存为 `.recordly` 项目文件，随时回来继续编辑。

<p>
  <img src="./feature3.png" width="450" alt="Recordly timeline editor screenshot">
</p>

## 全部功能

### 录制

- 录制整个显示器或单个应用窗口
- 录制完成后直接进入编辑器
- 录制麦克风音频和系统音频
- 在支持的平台上使用原生捕获后端
- 从保存的 `.recordly` 项目文件继续编辑
- 可在应用中打开已有录像或已有项目文件

### 时间线与编辑

- 拖拽式时间线编辑
- 裁掉不需要的片段
- 添加手动缩放区域
- 根据光标活动生成自动缩放建议
- 添加加速和减速区域
- 添加文本、图片和图形注释
- 在时间线上添加额外音频片段
- 裁切录制画面
- 保存并重新打开项目，保留编辑状态

### 光标控制

- 显示或隐藏渲染后的光标叠加层
- 调整光标大小
- 光标平滑
- 光标运动模糊
- 点击弹跳效果
- 光标摆动效果
- 光标循环模式，方便导出更自然的循环片段
- 使用 macOS 风格的渲染光标素材

### 摄像头叠加

- 启用或禁用摄像头叠加素材
- 上传、替换或移除摄像头素材
- 镜像摄像头画面
- 调整尺寸
- 使用预设位置或自定义 X/Y 坐标
- 调整边距
- 调整圆角程度
- 调整阴影强度
- 可选的缩放联动摄像头缩放效果

### 画面样式与背景

- 内置壁纸
- 运行时自动发现 wallpapers 目录中的壁纸
- 上传自定义背景图片
- 纯色背景
- 渐变背景
- 画面留白
- 圆角
- 背景模糊
- 投影阴影
- 最终画面的宽高比预设

### 导出

- MP4 导出
- GIF 导出
- 导出质量选择
- GIF 帧率选择
- GIF 循环开关
- GIF 尺寸预设
- 宽高比和输出尺寸控制
- 在系统文件管理器中定位导出文件

### 工作流与易用性

- 可自定义键盘快捷键
- 应用内快捷键说明
- 在编辑器中直接打开反馈和问题链接
- 编辑器偏好设置持久化
- 导出后更稳定的预览恢复

---

# 截图

<p align="center">
  <img src="https://i.postimg.cc/CKxm8DRs/Screenshot-2026-03-20-at-7-07-22-pm.png" width="700" alt="Recordly editor screenshot">
</p>

<p align="center">
  <img src="https://i.postimg.cc/hjwdYRyV/Screenshot-2026-03-20-at-1-53-57-pm.png" width="700" alt="Recordly recording interface screenshot">
</p>

<p align="center">
  <img src="https://i.postimg.cc/Zn9VY6bg/Screenshot-2026-03-18-at-6-32-59-pm.png" width="700" alt="Recordly timeline screenshot">
</p>

---

# 安装

## 下载构建版本

预构建发布版本请见：

https://github.com/webadderall/Recordly/releases

---

## Arch Linux / Manjaro（yay）

可通过 AUR 安装（[recordly-bin](https://aur.archlinux.org/packages/recordly-bin)）：

```bash
yay -S recordly-bin
```

PKGBUILD、桌面入口、发布同步，以及可选的**本地源码打包**都维护在 **[recordly-aur](https://github.com/firtoz/recordly-aur)** 中，因此这个仓库本身不需要承担 Arch 的每次发布维护工作。关于维护者联系方式和软件包更新方式，请查看该仓库或 AUR 软件包页面。

---

## 从源码构建

```bash
git clone https://github.com/webadderall/Recordly.git recordly
cd recordly
npm install
npm run dev
```

如果需要打包构建：

```bash
npm run build
```

也可以使用平台专用构建命令：

- `npm run build:mac`
- `npm run build:win`
- `npm run build:linux`

---

## macOS: “App cannot be opened”

本地构建的应用可能会被 macOS 隔离。

可以用以下命令移除隔离标记：

```bash
xattr -rd com.apple.quarantine /Applications/Recordly.app
```

---

# 系统要求

| 平台 | 最低版本 | 说明 |
|---|---|---|
| **macOS** | macOS 12.3 (Monterey) | 使用 ScreenCaptureKit 捕获所必需。 |
| **Windows** | Windows 10 20H1（Build 19041，2020 年 5 月） | 原生 Windows Graphics Capture（WGC）辅助程序及更稳定光标隐藏效果所必需。 |
| **Linux** | 任意现代发行版 | 通过 Electron 捕获录制。系统音频通常需要 PipeWire。 |

> [!IMPORTANT]
> 在 Windows 19041 之前的版本上，应用仍可能通过回退捕获方式录制，但真实系统光标可能仍会出现在视频中。

---

# 使用方法

## 录制

1. 启动 Recordly。
2. 选择屏幕或窗口。
3. 选择麦克风和系统音频选项。
4. 开始录制。
5. 停止录制后进入编辑器。

## 编辑

在编辑器中，你可以：

- 添加裁剪、缩放、变速和注释片段
- 调整光标行为和预览音量
- 使用壁纸、纯色、渐变、模糊、留白和圆角来美化画面
- 添加或调整摄像头叠加素材
- 添加额外音频片段
- 裁切画面并选择宽高比

你可以随时将工作保存为 `.recordly` 项目。

## 导出

支持以下导出格式：

- **MP4**，适合常规视频输出
- **GIF**，适合轻量分享和循环片段

你可以在导出前调整对应格式的设置，例如质量、GIF 帧率、GIF 循环方式和输出尺寸。

---

# 限制

### 光标捕获

Recordly 会在录制画面上渲染一个经过美化的光标叠加层，但真实系统光标是否能被隐藏仍取决于平台能力。

**macOS**
- ScreenCaptureKit 可以较干净地排除真实光标。

**Windows**
- 最佳效果需要 Windows 10 Build 19041+ 和原生捕获辅助程序。
- 较旧版本会回退到 Electron 捕获，因此真实光标可能仍会显示。

**Linux**
- Electron 桌面捕获目前不支持隐藏真实光标。
- 如果同时启用渲染光标叠加，导出中可能会同时看到真实光标和样式化光标。

### 系统音频

系统音频支持因平台而异。

**Windows**
- 支持原生 WASAPI

**Linux**
- 通常需要 PipeWire

**macOS**
- 需要 macOS 12.3+ 和基于 ScreenCaptureKit 的工作流

---

# 工作原理

Recordly 将平台相关的捕获层与基于渲染器的编辑、导出流程结合在一起。

**捕获**
- Electron 负责录制流程和应用级控制
- macOS 使用原生的 ScreenCaptureKit 辅助程序
- Windows 在可用时使用原生 Windows Graphics Capture（WGC）和原生音频辅助程序

**编辑**
- 时间线区域定义缩放、裁剪、变速、音频叠加和注释
- 光标和摄像头样式由编辑器状态统一控制

**渲染**
- 场景合成由 **PixiJS** 负责

**导出**
- 预览使用的同一套场景逻辑会被用于导出 MP4 或 GIF

**项目**
- `.recordly` 文件会保存源媒体路径和编辑器状态，方便后续继续编辑

---

# 贡献

欢迎贡献。

特别需要帮助的方向包括：

- Linux 录制与光标行为改进
- 导出性能与稳定性优化
- UI 和 UX 打磨
- 本地化工作
- 更多编辑工具与工作流优化

请尽量让 Pull Request 保持聚焦，测试录制、编辑、导出流程，并避免无关重构。

详细指南请参阅 `CONTRIBUTING.md`。

---

# 社区

问题反馈和功能建议：

https://github.com/webadderall/Recordly/issues

欢迎提交 Pull Request。

---

# 捐助与赞助者

[捐助](https://ko-fi.com/webadderall/goal?g=0)

感谢所有支持者，帮助 Recordly 持续保持开源并继续开发。

- Tadees

- Anonymous supporter
- erwan
- Anonymous supporter

其他事项可发送邮件至 `youngchen3442@gmail.com`，或通过 [@webadderall](https://x.com/webadderall) 私信联系。

---

# 许可证

Recordly 基于 **MIT License** 发布。

---

# 致谢

## 鸣谢

Recordly 最初构建于优秀的 [OpenScreen](https://github.com/siddharthvaddem/openscreen) 项目之上，随后逐步扩展出了自己的录制、编辑、光标、摄像头、导出与打包工作流。

创建者  
[@webadderall](https://x.com/webadderall)

---
