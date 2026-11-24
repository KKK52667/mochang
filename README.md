# 墨场 · 原创剧本写作工作台

一个手机优先、兼容桌面端的原创剧本写作工作台。支持作品、人物、场景、台词、时间线、人物关系网和灵感笔记，不预设任何故事题材。

## GitHub Pages 发布

1. 在仓库 **Settings → Pages** 中找到 **Build and deployment**。
2. 选择 **Source: Deploy from a branch**。
3. 设置 **Branch: main**，目录选择 **/(root)**，点击 **Save**。
4. 等待 GitHub Pages 发布完成，在 [https://kkk52667.github.io/mochang/](https://kkk52667.github.io/mochang/) 打开工作台。

**注意：** GitHub Free 账户为仓库使用 Pages 时通常需要 Public 仓库。公开仓库意味着网站源代码可见；不会因此自动公开保存在浏览器本地的剧本。但这个版本没有服务器账户和加密云存储，不应作为敏感未发表作品的唯一副本。

## 保存和备份

本版本仅通过浏览器本地存储保存作品。相同网站在不同浏览器、手机、电脑上保存的内容互不共享；清除网站数据、切换域名或设备可能导致本机作品无法读取。请定期在工作台中导出完整 JSON 备份，并妥善保存。导出的 JSON 备份包含作品内容，不要上传到公开仓库。需要跨设备自动同步时，可另行增加 Supabase 身份验证和按用户隔离的数据表。

## 目录

- `index.html` — 网页主程序，包含全部主要写作功能
- `manifest.webmanifest` — 手机主屏幕安装信息
- `icon.svg` — 应用图标
- `sw.js` — 离线缓存
- `.nojekyll` — 禁用 Jekyll 处理
- `robots.txt` — 提醒搜索引擎不要抓取

将网站添加到手机主屏幕，可获得接近独立 App 的使用体验。首次使用和应用更新需要连接网络。
