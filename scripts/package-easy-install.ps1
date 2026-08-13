param(
  [string]$InstallerPath = ''
)

$ErrorActionPreference = 'Stop'
$expectedHash = '1A3BAF49F20C321BDCC9421F5B7AAB8C1E8A33792C93086463D148B502C1BE3D'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifactRoot = Join-Path $projectRoot 'artifacts'
$stage = Join-Path $artifactRoot 'easy-install'
$pluginVersion = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'plugin.json') | ConvertFrom-Json).version
$archive = Join-Path $artifactRoot "steam-pinyin-search-easy-install-v$pluginVersion.zip"
$defaultInstallerPath = Join-Path $artifactRoot 'MillenniumInstaller-Windows-v1.12.1.exe'
if (-not $InstallerPath) { $InstallerPath = $defaultInstallerPath }

Push-Location $projectRoot
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'package-plugin.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Plugin packaging failed.' }
  if (-not (Test-Path -LiteralPath $InstallerPath)) {
    $InstallerPath = $defaultInstallerPath
    Invoke-WebRequest -Uri 'https://github.com/SteamClientHomebrew/Installer/releases/download/v1.12.1/MillenniumInstaller-Windows.exe' -OutFile $InstallerPath
  }
  $actualHash = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash
  if ($actualHash -ne $expectedHash) { throw "Official installer hash mismatch: $actualHash" }
  if ((Get-AuthenticodeSignature -LiteralPath $InstallerPath).Status -ne 'Valid') { throw 'Official installer signature is invalid.' }

  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path $stage 'payload') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'easy-install\install.cmd') -Destination $stage
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'easy-install\install.ps1') -Destination $stage
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'easy-install\README-ZH-CN.txt') -Destination $stage
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'easy-install\THIRD_PARTY_NOTICES.txt') -Destination $stage
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'easy-install\MILLENNIUM-INSTALLER-LICENSE.txt') -Destination $stage
  Copy-Item -LiteralPath $InstallerPath -Destination (Join-Path $stage 'MillenniumInstaller-Windows.exe')
  Copy-Item -LiteralPath (Join-Path $artifactRoot 'package\steam-pinyin-search') -Destination (Join-Path $stage 'payload') -Recurse
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
  Write-Output $archive
} finally {
  Pop-Location
}
