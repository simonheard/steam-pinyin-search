$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifactRoot = Join-Path $projectRoot 'artifacts'
$stageRoot = Join-Path $artifactRoot 'package'
$pluginStage = Join-Path $stageRoot 'steam-pinyin-search'
$archivePath = Join-Path $artifactRoot 'steam-pinyin-search-v0.1.0.zip'

Push-Location $projectRoot
try {
  & npm.cmd run build:plugin
  if ($LASTEXITCODE -ne 0) { throw 'Plugin build failed.' }

  if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path $pluginStage '.millennium\Dist') -Force | Out-Null
  Copy-Item -LiteralPath 'plugin.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md' -Destination $pluginStage
  Copy-Item -LiteralPath '.millennium\Dist\index.js', '.millennium\Dist\webkit.js' -Destination (Join-Path $pluginStage '.millennium\Dist')
  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  Compress-Archive -LiteralPath $pluginStage -DestinationPath $archivePath -CompressionLevel Optimal
  Write-Output $archivePath
} finally {
  Pop-Location
}
