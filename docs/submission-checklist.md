# Millennium PluginDatabase 提交准备

核对日期：2026-08-14。官方插件库接收的是公开 Git 仓库的 Git submodule，
不是 ZIP。每次更新都需要新的 PluginDatabase pull request 推进 submodule commit。

当前官方提交：[PluginDatabase PR #225](https://github.com/SteamClientHomebrew/PluginDatabase/pull/225)。
PR 已固定到 v0.1.2 commit `5c3c55c`，如实保留 Stable/Beta 联合测试项未勾选并说明
Beta 中 Millennium 在插件加载前崩溃。上游 Test Build 当前为 `action_required`，需要
PluginDatabase 维护者批准首次贡献者工作流后才会运行，不代表构建失败。

## 本仓库已经准备好

- [x] 公开源代码、MIT License、第三方声明。
- [x] `plugin.json` 使用当前 schema，`useBackend: false`，没有自定义原生二进制。
- [x] TypeScript strict、lint、单元测试、构建和 benchmark。
- [x] PluginDatabase 风格的 Node 20 + pnpm 生产构建 CI。
- [x] Windows Steam Stable + Millennium 3.4.0 本机运行验证。
- [x] 手动插件 ZIP 和 Windows 小白安装包。
- [x] README、安装、隐私、自建服务、发布说明。

## 提交前仍需人工完成

- [x] 已在 2026-08-13 安装并启动当前 Steam `publicbeta` build `1786491548`；
  Millennium 3.4.0 在插件前端加载前连续三次发生 `EXCEPTION_ACCESS_VIOLATION`。
- [ ] Millennium 支持该 Beta build 后，重新完成插件启用、搜索和重载验证；当前不得
  声明插件通过 Steam Beta 测试。
- [x] 确认 GitHub Actions 在仓库中全部通过（CI #7，2026-08-14）。
- [x] 已正式发布 v0.1.2 GitHub Release，并附上普通 ZIP、小白 ZIP 与校验值。
- [ ] 在 PluginDatabase PR 中等待独立第三方测试者勾选 Stable/Beta 验证框；作者
  不应自行勾选这两个第三方确认项。
- [ ] 官方模板高度鼓励先测试另外两个待审插件并附反馈链接，可在提交 PR 前完成。

### 当前上游 CI 注意事项

截至 2026-08-13，PluginDatabase 的公开 workflow 固定 Node 20，却执行无版本限制的
`npm install -g pnpm`；npm 当前 latest `pnpm@11.21.0` 要求 Node 22.13+。这会让
pnpm 在读取任何插件项目以前就失败，是上游 CI 版本组合问题。本项目已在以下两种
组合完成隔离生产构建：

- Node 22.17 + pnpm 11.19；
- Node 20.20 + pnpm 10.34.5（与 PluginDatabase Node 版本兼容）。

仓库 CI 的兼容任务暂时显式固定 pnpm 10.34.5。如果正式 PR 出现 pnpm 自身的
`node:sqlite` / Node 版本错误，请链接上游 workflow 的 Node/pnpm 行向 reviewer
说明，不要通过改插件代码或放宽安全配置绕过。等 PluginDatabase 把 Node 升到 22
或把 pnpm 固定到 10 后即可正常执行。

## 本地发布检查

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run benchmark
npm run build
npm run package:plugin
npm run package:easy
```

检查 ZIP 内容，确认仓库与制品都没有 `.env`、Steam Web API key、VPS 凭据、
数据库或个人缓存。服务端 key 只允许出现在部署机器的环境变量中。

## 添加到 PluginDatabase

```bash
git clone https://github.com/YOUR_NAME/PluginDatabase.git
cd PluginDatabase
git switch -c add-steam-pinyin-search
git submodule add https://github.com/simonheard/steam-pinyin-search plugins/steam-pinyin-search
git commit -m "feat: add Steam Pinyin Search"
git push -u origin add-steam-pinyin-search
```

然后向 `SteamClientHomebrew/PluginDatabase` 开 pull request，选择 **Plugin
Submission** 模板。提交中的 submodule 应固定到已经测试、CI 通过且与最新 Release
一致的 commit。当前应固定到 `v0.1.2` / commit `5c3c55c`；该版本已经包含
Millennium 3.4 设置读写兼容修复，并完成在线模式实机确认。

## 可复制的 PR 说明草稿

> Steam Pinyin Search adds local Chinese-name, full-pinyin, compact-pinyin,
> initials, mixed-text, and community-alias search to the Steam Library. It also
> provides an opt-in Store autocomplete with local-only and user-configured remote
> modes. Library data never leaves the device; online Library alias matching sends
> only the typed query and intersects public AppIDs locally.
>
> I am the original author/authorized maintainer. The project is fully open source
> under the MIT License. It has no paid features, analytics, account system,
> Millennium Python backend, or custom native binaries. The optional public API is
> also self-hostable from this repository.
>
> Standard Millennium Python backend: **No**<br>
> Custom binaries: **No**

随后逐项使用官方 PR 模板。只勾选已经亲自完成的 Stable/Beta 作者测试；模板末尾
要求第三方测试者确认的框必须保持未勾选，等待 reviewer/tester 操作。

## 更新已收录插件

在 PluginDatabase fork 中推进 submodule 后再次提 PR：

```bash
git submodule update --remote plugins/steam-pinyin-search
git add plugins/steam-pinyin-search
git commit -m "chore: update Steam Pinyin Search"
```

## 官方来源

- [Submitting Addons](https://docs.steambrew.app/developers/submitting)
- [PluginDatabase](https://github.com/SteamClientHomebrew/PluginDatabase)
- [Millennium](https://github.com/SteamClientHomebrew/Millennium)
- [pnpm build settings and Node compatibility](https://pnpm.io/settings/build)
