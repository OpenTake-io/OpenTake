# 图标文件说明

本项目使用多格式图标策略，在保证兼容性的同时优化文件大小。

## 文件结构

```
icons/
├── icons/
│   ├── png/           # Linux 图标 (PNG 格式)
│   │   ├── 16x16.png
│   │   ├── 24x24.png
│   │   ├── 32x32.png
│   │   ├── 48x48.png
│   │   ├── 64x64.png
│   │   ├── 128x128.png
│   │   ├── 256x256.png
│   │   ├── 512x512.png
│   │   └── 1024x1024.png
│   ├── win/
│   │   └── icon.ico   # Windows 图标 (ICO 格式)
│   └── mac/
│       └── icon.icns  # macOS 图标 (ICNS 格式)
└── public/
    ├── app-icons/      # PNG 格式应用图标
    │   ├── opentake-{size}.png
    │   └── opentakemac-{size}.png
    └── app-icons-webp/ # WebP 格式应用图标 (推荐)
        ├── opentake-{size}.webp
        ├── opentakemac-{size}.webp
        └── linux/
            └── {size}x{size}.webp
```

## 格式对比

| 格式 | 大小 | 兼容性 | 使用场景 |
|------|------|--------|----------|
| **PNG** | 中等 | ★★★★★ | 系统图标、旧版浏览器 |
| **WebP** | 最小 | ★★★★☆ | Web、Electron 应用、现代浏览器 |
| **ICO** | 中等 | Windows | Windows 应用图标 |
| **ICNS** | 中等 | macOS | macOS 应用图标 |

## 使用建议

### 系统图标 (保持原格式)
- **Windows**: 使用 `icons/icons/win/icon.ico`
- **macOS**: 使用 `icons/icons/mac/icon.icns`
- **Linux**: 使用 `icons/icons/png/` 目录下的 PNG 文件

### Web 和应用内显示 (推荐 WebP)
- **README**: 使用 `public/app-icons-webp/opentake-256.webp`
- **应用内**: 使用 `public/app-icons-webp/` 目录下的 WebP 文件
- **Electron**: WebP 完全支持，可直接使用

### 兼容性说明

#### WebP 支持情况
- ✅ Chrome 32+ (2014)
- ✅ Firefox 65+ (2019)
- ✅ Edge 18+ (2018)
- ✅ Safari 14+ (2020)
- ✅ Electron (所有版本)
- ❌ IE (不支持)

#### 回退策略
如果需要支持旧版浏览器，可以使用 HTML `<picture>` 标签：

```html
<picture>
  <source srcset="icon.webp" type="image/webp">
  <img src="icon.png" alt="Icon">
</picture>
```

## 重新生成图标

### 生成所有格式
```bash
python3 scripts/generate-icons.py
python3 scripts/compress-icons.py
python3 scripts/convert-to-webp.py
```

### 仅压缩 PNG
```bash
python3 scripts/compress-icons.py
```

### 仅生成 WebP
```bash
python3 scripts/convert-to-webp.py
```

## 文件大小统计

### PNG 格式 (压缩后)
- 1024x1024: ~248 KB
- 512x512: ~106 KB
- 256x256: ~39 KB
- 128x128: ~14 KB

### WebP 格式
- 1024x1024: ~36 KB (85% 减少)
- 512x512: ~16 KB (85% 减少)
- 256x256: ~8 KB (80% 减少)
- 128x128: ~4 KB (74% 减少)

**总体节省**: WebP 比 PNG 小约 **84%**
