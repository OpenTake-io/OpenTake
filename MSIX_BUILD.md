# MSIX 构建指南

本项目支持将 OpenTake 打包为 Windows MSIX 格式，这是 Windows 10/11 推荐的应用打包格式。

## 概述

MSIX (Microsoft Installer XML) 是一种现代 Windows 应用打包格式，具有以下优势：

- ✅ **自动更新** - 支持无缝更新机制
- ✅ **干净卸载** - 完全清理应用数据
- ✅ **沙箱隔离** - 增强的安全性
- ✅ **Windows Store** - 可发布到 Microsoft Store
- ✅ **企业部署** - 支持 Intune 和 SCCM 部署

## 构建方式

### 1. 本地构建

#### 前置要求

- Windows 10/11
- Python 3.11+
- Node.js 22+
- PIL/Pillow (用于生成 MSIX 资产)

#### 步骤

```bash
# 1. 安装依赖
npm install

# 2. 生成 MSIX 资产
python scripts/prepare-msix-assets.py

# 3. 构建 MSIX 包
npm run build:win:msix
```

#### 可选：签名 MSIX 包

```bash
# 使用证书签名
npx electron-builder --win msix --x64 \
  --config.win.certificateFile="path/to/certificate.pfx" \
  --config.win.certificatePassword="your-password"
```

### 2. GitHub Actions 自动构建

项目包含 `.github/workflows/build-msix.yml` 工作流，支持：

- **自动触发** - 推送到 `dev` 或 `main` 分支时自动构建
- **手动触发** - 通过 GitHub Actions 手动运行
- **可选签名** - 支持使用证书签名 MSIX 包

#### 手动触发构建

1. 进入 GitHub 仓库的 Actions 页面
2. 选择 "Build MSIX Package" 工作流
3. 点击 "Run workflow"
4. 选择是否签名 MSIX 包
5. 点击 "Run workflow" 按钮

#### 签名配置

要启用 MSIX 签名，需要在 GitHub 仓库设置中添加以下 Secrets：

- `WINDOWS_SIGNING_CERTIFICATE_P12_BASE64` - Base64 编码的 P12 证书
- `WINDOWS_SIGNING_CERTIFICATE_PASSWORD` - 证书密码

## 配置说明

### electron-builder.json5

MSIX 相关配置位于 `electron-builder.json5` 文件的 `msix` 部分：

```json5
"msix": {
  "applicationId": "io.opentake.app",        // 应用唯一标识
  "identityName": "OpenTake",                // 应用标识名称
  "publisher": "CN=OpenTake, O=OpenTake, C=US", // 发布者信息
  "publisherDisplayName": "OpenTake",        // 发布者显示名称
  "languages": ["en-US", "zh-CN"],           // 支持的语言
  "backgroundColor": "transparent",          // 背景颜色
  "showNameOnTiles": true,                   // 在磁贴上显示名称
  "setBuildNumber": true,                    // 自动设置构建号
  "logo": "build/msix-assets/Square150x150Logo.png",  // Logo
  "splashScreen": "build/msix-assets/SplashScreen.png", // 启动画面
  "extensions": [...]                        // 扩展依赖
}
```

### MSIX 资产

MSIX 包需要以下图像资产：

| 资产名称 | 尺寸 | 用途 |
|---------|------|------|
| Square44x44Logo | 44x44 | 小图标 |
| Square150x150Logo | 150x150 | 中等图标 |
| Wide310x150Logo | 310x150 | 宽磁贴 |
| Square310x310Logo | 310x310 | 大磁贴 |
| StoreLogo | 50x50 | Store 图标 |
| SplashScreen | 620x300 | 启动画面 |

这些资产由 `scripts/prepare-msix-assets.py` 脚本自动生成。

## 安装和部署

### 本地安装

```powershell
# 使用 PowerShell 安装
Add-AppxPackage -Path "OpenTake-1.0.0-x64.msix"

# 使用安装脚本安装
.\Install.ps1
```

### 企业部署

#### Microsoft Intune

1. 登录 Microsoft Endpoint Manager 管理中心
2. 选择 "应用" > "所有应用"
3. 点击 "添加" > "业务线应用"
4. 上传 MSIX 包
5. 配置部署设置

#### SCCM

1. 在 SCCM 控制台中创建应用程序
2. 选择 "手动指定应用程序信息"
3. 上传 MSIX 包
4. 配置部署类型和检测规则

## 故障排除

### 常见问题

#### 1. 安装失败：签名错误

**错误信息**: `The package signature is invalid`

**解决方案**:
- 确保证书有效且未过期
- 检查证书是否包含正确的主题名称
- 验证证书密码是否正确

#### 2. 安装失败：依赖缺失

**错误信息**: `The package requires a framework dependency`

**解决方案**:
- 确保目标系统安装了 WebView2 运行时
- 检查 Windows 版本是否满足最低要求 (10.0.17763.0)

#### 3. 应用无法启动

**可能原因**:
- 缺少必要的系统权限
- WebView2 运行时未正确安装
- 应用配置错误

**解决方案**:
- 检查 Windows 事件查看器中的错误日志
- 重新安装 WebView2 运行时
- 验证应用清单文件中的权限配置

### 调试模式

要启用 MSIX 包的调试模式：

```powershell
# 启用调试日志
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--enable-logging --v=1"

# 安装应用
Add-AppxPackage -Path "OpenTake.msix" -DependencyPath "Dependencies\x64\Microsoft.WebView2.FixedVersionRuntime.109.0.1518.46.cab"

# 查看日志
Get-AppPackageLog -Name "OpenTake"
```

## 最佳实践

### 1. 版本管理

- 使用语义化版本号 (例如: 1.2.3)
- 每次发布递增版本号
- 在 CI/CD 中自动设置版本号

### 2. 证书管理

- 使用受信任的 CA 签发的证书
- 定期更新证书
- 安全存储证书和密码

### 3. 测试流程

- 在多个 Windows 版本上测试
- 验证升级和卸载流程
- 测试企业部署场景

### 4. 性能优化

- 压缩图像资产
- 优化应用启动时间
- 减少包大小

## 相关资源

- [MSIX 官方文档](https://docs.microsoft.com/en-us/windows/msix/)
- [electron-builder MSIX 配置](https://www.electron.build/configuration/msix)
- [Windows 应用认证](https://docs.microsoft.com/en-us/windows/uwp/publish/app-certification-process)
- [Microsoft Store 提交指南](https://docs.microsoft.com/en-us/windows/uwp/publish/app-submissions)

## 支持

如果遇到 MSIX 构建问题，请：

1. 检查 GitHub Issues 中是否已有相关问题
2. 查看构建日志中的详细错误信息
3. 提交新的 Issue 并附上以下信息：
   - Windows 版本
   - Node.js 版本
   - 完整的错误日志
   - 构建配置
