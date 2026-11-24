# 墨场 · 原创剧本写作工作台

📱 手机优先，兼容电脑。支持人物档案、分场台词、时间线、关系网、笔记和 JSON 备份。通过 GitHub Pages 托管，增加 Supabase 登录与云端同步。

- 在线网址：https://kkk52667.github.io/mochang/
- 重要说明：**网页更新不等于已开通数据库。先执行下面的 Supabase 配置步骤，才能使用云端功能。** 在此之前仍然可以正常使用本机写作。

## 如何连接 Supabase（首次配置）

**推荐为墨场单独创建一个 Supabase 项目**，避免与已有项目的用户、配置和数据混在一起。

1. 在 https://supabase.com/dashboard 选择或新建项目。
2. 打开 **SQL Editor → New query**，将 [`supabase/schema.sql`](./supabase/schema.sql) 的全文粘贴进去，点击 **Run**。脚本创建一张 `mochang_documents` 表和 `mochang_save` 存稿函数，启用行级安全策略（RLS），每个已登录用户只能读写自己的记录。
3. 在 **Authentication → Sign In / Providers → Email** 确保邮箱登录启用。若邮箱验证开启，注册后需要点击验证邮件才能登录。
4. 在 **Authentication → URL Configuration** 将 **Site URL** 设置为 `https://kkk52667.github.io/mochang/`，**Redirect URLs** 添加同一个地址。此设置用于邮箱验证和密码找回。
5. 在项目 **Connect / API Keys** 中复制 **Project URL**（形式 `https://xxxx.supabase.co`）以及 **Publishable Key**（或旧版 `anon` Key）。绝对不要使用 `service_role`、`sb_secret_...`、数据库密码或任何私钥。
6. 打开墨场网站，在电脑右上角或手机底部「更多 → 云端账号与同步」进入设置，填写 URL 和 Publishable / anon Key。点击保存，然后注册、登录。
7. 第一次登录时，如果云端尚无稿件，网站会询问是否把当前设备的已有作品上传。确认后，后续修改将在本地立即保存，并约 1 秒后同步云端。
8. 在其他设备重复填写 Project URL 和 Publishable Key，并登录**同一邮箱账户**。页面会加载云端作品。

## 安全与数据保护

- 网页代码存储在公开 GitHub 仓库，但**作品正文不提交到 GitHub**。云端稿件存放在 Supabase 数据库，RLS 限制用户间的访问；管理员仍拥有相应管理权限。
- 本地输入立即保存。网络中断时本机可继续编辑，待恢复网络会尝试同步；但未同步完成前，请不要清理网站数据。
- 当不同设备对同一份记录作出冲突修改时，会**暂停同步并保留本机待上传稿件**，不会默默以最新上传覆盖旧版本。可在云端设置中选择加载云端或明确用本机稿件覆盖，建议先下载备份。
- 旧版本机数据不会在登录时不经提示就覆盖已有云端稿件；软件会在当前浏览器留存迁移备份，可在「云端账号与同步」中追加旧稿为新作品。
- **仍请定期使用「备份所有作品 JSON」**。本地存储不是永久保证；云端同步也不等于独立的历史版本备份。Supabase 免费项目存在休眠、流量和容量限制。
- 不要在公共电脑保持登录。浏览器本地会保存登录会话，以便自动续签；定期更新浏览器并避免安装不可信扩展。

## 技术组成

- `index.html`：响应式编辑器（所有主要编辑界面）
- `cloud.js`：Supabase 邮箱认证、数据保存、跨设备同步与版本冲突处理
- `supabase/schema.sql`：数据表、RLS 和版本校验 RPC
- `manifest.webmanifest`、`icon.svg`：手机主屏幕图标和 PWA 信息
- `sw.js`：静态资源离线缓存，不会缓存 Supabase 的个人数据 API 响应
- `.nojekyll`：GitHub Pages 静态文件设置

无需 Netlify、Node.js、Vite 或任何服务端代码即可在 GitHub Pages 上运行。**未配置 Supabase 时仍可本机写作。**