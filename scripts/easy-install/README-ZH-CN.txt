Steam Pinyin Search 小白整合包
================================

适用：Windows 10/11、已经安装但尚未安装 Millennium 的普通 Steam 客户端。

安装：
1. 完全解压本 ZIP，不能直接在压缩包内运行。
2. 双击 install.cmd。
3. 接受 Windows 管理员权限提示。
4. 在弹出的 Millennium 官方签名安装器中完成安装。
5. 脚本会自动安装并启用 Steam Pinyin Search，然后重启 Steam。

安全说明：
- MillenniumInstaller-Windows.exe 是 SteamClientHomebrew 官方 v1.12.1 原始签名文件，没有修改或重签名。
- 安装脚本会同时验证 SHA-256 和 Windows Authenticode 签名。
- 官方安装器会联网下载当前稳定 Millennium runtime，因此本包不是离线安装包。
- Library 游戏名称只在本机建立索引，绝不上传。
- 商店增强只发送搜索词；公共 API 未部署或网络失败时，Steam 原搜索继续工作。

卸载插件：
关闭 Steam，删除：
  <Steam目录>\millennium\plugins\steam-pinyin-search

Millennium 的卸载请使用其官方安装器/官方文档：
https://docs.steambrew.app/users/getting-started/uninstalling

项目：https://github.com/simonheard/steam-pinyin-search

