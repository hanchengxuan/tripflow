# TripFlow 品牌图标 · 折页

一张纸质地图，只保留让它成为地图的那件事——折痕。全部几何在 [`build.mjs`](build.mjs)
里，用 Playwright 自带的 Chromium 光栅化，项目不需要再多装一套图形工具链。

```bash
node assets/brand/build.mjs          # 只出 preview.html 规格页
node assets/brand/build.mjs --ship   # 额外出 out/ship 下的 light / dark / web 三套
ICON_PALETTE=p3 node assets/brand/build.mjs --ship   # 换成朱红那套
```

## 构造

三片折页的面宽是 168 / 236 / 176 —— 中间最宽因为它正对着我们，两翼宽度也不相等，
避免整块读成对称的招牌。上下边错开 52，纸才是折起来的而不是三根柱子。整体
3.5° 倾角，光学中心压在画面正中（几何 bbox 中心是 516 而不是 512，代码里补了这 4px）。

颜色是三级折光，不是两色平涂：正面最亮，两翼是主色的深浅两阶。

| | Ground | 左翼·背光 | 正面·唯一亮色 | 右翼·中间调 |
| --- | --- | --- | --- | --- |
| light (`p1`) | `#F1F2EF` | `#123B32` | `#17B98A` | `#2C6D5C` |
| dark | `#0E1F1B` | `#E8EFEC` | `#2ED39B` | `#52907C` |
| light (`p3`) | `#F3F3F0` | `#13342D` | `#FF5A36` | `#2E6659` |

dark 不是把 light 反相：正面那片保持发光，两翼压成中间调，否则深底上三片会糊成一块。

## 产物

每个文件都同时有 `.svg` 源和 `.png` 成品。

**`out/ship/light/`** — 应用图标主体

| 文件 | 尺寸 | 去处 |
| --- | --- | --- |
| `icon-1024.png` | 1024 | iOS / 通用应用图标 |
| `android-foreground.png` | 512 | Android 自适应前景（框到 0.78×，裁切后仍留呼吸） |
| `android-background.png` | 512 | Android 自适应背景 |
| `android-monochrome.png` | 512 | Android 主题图标 |
| `splash-mark.png` | 512 | 启动图，配 `backgroundColor: "#F1F2EF"` |

**`out/ship/dark/`** — iOS 18 的深色与着色变体

| 文件 | 说明 |
| --- | --- |
| `icon-1024.png` | 深底不透明版，也可直接当独立深色图标用 |
| `icon-1024-transparent.png` | iOS 18 dark 变体要的透明版 |
| `icon-1024-tinted.png` | iOS 18 tinted 变体。系统按亮度重新着色，所以这版是灰阶而不是纯黑，否则三片折页会塌成一块 |
| `splash-mark.png` | 深色启动图，配 `backgroundColor: "#0E1F1B"` |

**`out/ship/web/`** — 网站图标

| 文件 | 说明 |
| --- | --- |
| `favicon.svg` | 跟随浏览器深浅色：同一份几何，配色由文件内的 `prefers-color-scheme` 切换 |
| `favicon-16/32/48/64.png` | 位图回退 |
| `apple-touch-icon-180.png` | iOS 添加到主屏 |
| `icon-192.png` / `icon-512.png` | web manifest |
| `icon-maskable-512.png` | PWA maskable，按各平台最多裁掉两成边框预留 |

favicon 用 1.22× 收得比应用图标更紧——浏览器标签本身就没有留白，再按应用图标的
比例留边会显得图形很小。

网站接法：

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
```

## 接入 app.json

成品默认不覆盖 `assets/images/`，定稿后再拷：

```bash
cp assets/brand/out/ship/light/icon-1024.png assets/images/tripflow-icon.png
cp assets/brand/out/ship/web/favicon-64.png assets/images/tripflow-favicon.png
cp assets/brand/out/ship/light/android-foreground.png assets/images/android-icon-foreground.png
cp assets/brand/out/ship/light/android-background.png assets/images/android-icon-background.png
cp assets/brand/out/ship/light/android-monochrome.png assets/images/android-icon-monochrome.png
cp assets/brand/out/ship/light/splash-mark.png assets/images/splash-mark.png
```

`app.json` 里两处配色还停在更早那版的蓝，需要一起改，否则会和瓷白图标打架：

- `android.adaptiveIcon.backgroundColor`：`#E6F4FE` → `#F1F2EF`
- `expo-splash-screen` 的 `backgroundColor`：`#208AEF` → `#F1F2EF`，`image` 指向 `./assets/images/splash-mark.png`
