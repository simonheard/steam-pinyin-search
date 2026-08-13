# Steam Pinyin Search v0.1.0

首个可测试版本：Steam Library 支持中文、英文、全拼、紧凑拼音、首字母、数字、
混合文本和社区别名；Store 搜索提供可关闭的本地模式、用户配置远程模式及静默
本地回退。Library 数据不上传，在线别名匹配只发送查询并在本机与拥有的 AppID
取交集。

## 下载

- `steam-pinyin-search-v0.1.0.zip`：已安装 Millennium 用户的跨平台手动包。
- `steam-pinyin-search-easy-install-v0.1.0.zip`：Windows 裸 Steam 小白包，包含
  未修改且签名/哈希校验通过的 Millennium 官方安装器。

安装方法见 [installation.md](installation.md)。ZIP 不能上传到 Millennium 的
**Install a plugin** 输入框；正式插件商店使用 PluginDatabase submodule 审核。

## SHA-256

```text
6A0BCC29C4BF33EB9A4BD8809DCB12495DCB5340AA1CDA31CD624DC2204C2E21  steam-pinyin-search-v0.1.0.zip
D29A928A174CF3242FA564E021DE604D0992FF582440FFD2E3810478EDFF5A38  steam-pinyin-search-easy-install-v0.1.0.zip
```

## 已验证

- Windows Steam Stable + Millennium 3.4.0 实机加载和 Library 搜索。
- lint、TypeScript strict typecheck、61 个测试、生产构建、npm audit。
- Node 22 + pnpm 11 与 Node 20 + pnpm 10 隔离生产构建。

Linux、macOS 和 Steam Beta 的 Steam UI 实机验证仍待完成；详情见
[submission-checklist.md](submission-checklist.md)。
