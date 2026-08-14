# 安装、升级与卸载

本文面向普通 Steam 用户。Steam Pinyin Search 跟随 Millennium 和 Steam
启动，不会安装 Windows Service、独立 Electron 应用或额外常驻进程。

## 方式一：Millennium 插件商店（正式收录后推荐）

1. 按 [Millennium 官方安装文档](https://docs.steambrew.app/users/getting-started/installation)
   安装 Millennium。
2. 打开 **Steam → 设置 → Millennium → Plugins**。
3. 在 **Install a plugin** 中输入 steambrew.app 收录后显示的插件 ID。
4. 启用 **Steam Pinyin Search**，然后重新加载 Steam。

插件尚未通过 PluginDatabase 审核时，请使用下面的手动安装方式。官方输入框
接收已审核的插件 ID，不接收 ZIP 文件。

## 方式二：手动 ZIP（Windows / Linux / macOS）

从 GitHub Release 下载最新的 `steam-pinyin-search-v*.zip`，完整解压后，把其中
顶层的 `steam-pinyin-search` 文件夹放入：

| 平台 | 插件目录 |
| --- | --- |
| Windows | `%STEAM%\millennium\plugins\` |
| Linux | `~/.local/share/millennium/plugins/` |
| macOS | `~/Library/Application Support/Millennium/plugins/` |

最终路径里应直接看到 `plugin.json` 和 `.millennium/Dist/`，不要多套一层同名
文件夹。随后在 Millennium 设置里启用插件并重新加载 Steam。

Windows 已用 Steam Stable 与 Millennium 3.4.0 实机验证。**Linux 和 macOS
均未经测试，不声明兼容或可用。** 插件包虽然不含原生二进制，但 Steam 内部 UI
hook 可能因操作系统而不同。Millennium 对 macOS 的支持仍标记为实验性；
Flatpak Steam、Snap Steam 和 ARM Linux 不在 Millennium 当前支持范围内。

Steam Beta 也暂不声明兼容：2026-08-13 的 `publicbeta` build `1786491548`
会使 Millennium 3.4.0 在插件加载前崩溃；这是上游 loader 阻塞，详见
[`runtime-validation.md`](runtime-validation.md)。请使用 Steam Stable。

## 方式三：Windows 裸 Steam 小白包

下载并完整解压最新的 `steam-pinyin-search-easy-install-v*.zip`：

1. 退出 Steam。
2. 双击 `install.cmd`，同意管理员权限。
3. 完成屏幕上出现的 Millennium 官方安装器。
4. 安装脚本会复制插件、启用插件并重启 Steam。

整合包携带的是未修改、签名有效且经过 SHA-256 校验的官方 Millennium
Installer v1.12.1。它会联网下载当前稳定 Millennium，不是冻结版本的离线魔改包。

## 开启在线别名与商店搜索

打开 **Steam → 设置 → Millennium → Plugins → Steam Pinyin Search**：

- **Enable Store pinyin search**：商店增强总开关；不需要商店搜索时可以关闭。
- **Online search server (optional)**：可填写自己的服务地址，也可以使用项目维护的
  `https://steam-search.hede.wang`。
- 留空时为纯本地模式；新安装的本地商店目录为空，仍保留 Steam 原生搜索。
- 配置服务器后，商店搜索会远程优先、本地兜底；Library 也能搜索服务器中的
  “老头环”等社区别名。

在线模式只发送当前规范化后的查询字符串和结果数量。Library 名称、用户拥有的
AppID、SteamID、账号资料和机器 ID 都不会上传；服务器返回结果后，Library
匹配会在本机与用户实际拥有的 AppID 取交集。

保存设置后重新加载 Steam。服务器超时、离线或返回异常时，Steam 原生搜索与
Library 本地拼音搜索继续工作。

## 升级

- 插件商店安装：按 Millennium 提示更新。
- 手动安装：退出 Steam，用新版 ZIP 中的整个 `steam-pinyin-search` 文件夹覆盖
  旧文件夹，然后重新启动 Steam。Library 缓存会按 schema 自动增量更新或失效。
- 小白包：可重新运行新版 `install.cmd`；脚本不会创建第二套 Millennium。

## 卸载

1. 在 Millennium 设置中禁用插件并重新加载 Steam。
2. 完全退出 Steam。
3. 删除对应插件目录下的 `steam-pinyin-search` 文件夹。

插件的 Library 缓存和本地 Store 目录存储在 Steam 页面上下文的 localStorage。
禁用 Store 搜索并保存会清理本地 Store 目录；也可在 Store DevTools 执行
`SteamPinyinSearch.clearLocalCatalog()`。

## 常见问题

- **Millennium 里看不到插件**：检查是否多解压了一层目录，以及 `plugin.json`、
  `.millennium/Dist/index.js`、`.millennium/Dist/webkit.js` 是否存在。
- **商店没有下拉结果**：确认开关已打开、查询至少两个字符、保存后已重载 Steam；
  纯本地模式必须先从远程结果学习或手工导入目录。
- **在线地址保存失败**：先确认使用 v0.1.2 或更新版本；v0.1.2 已兼容 Millennium
  3.4.0 的旧版 JSON 字符串配置响应。地址必须是有效的 `http://` 或 `https://`
  基础地址；公开服务推荐 HTTPS。仍失败时打开 Millennium 日志查看
  `[SteamPinyinSearch]` 错误。
- **Steam 更新后搜索失效**：先禁用插件保证原生行为，再到 GitHub Issues 提交 Steam
  分支、Millennium 版本和调试日志。插件找不到 hook 时会停止增强而不是强行修改 UI。
