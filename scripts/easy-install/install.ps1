$ErrorActionPreference = 'Stop'

$installerHash = '1A3BAF49F20C321BDCC9421F5B7AAB8C1E8A33792C93086463D148B502C1BE3D'
$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$installerPath = Join-Path $bundleRoot 'MillenniumInstaller-Windows.exe'
$payloadPath = Join-Path $bundleRoot 'payload\steam-pinyin-search'

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
  Write-Host 'Requesting administrator access to update the Steam directory...' -ForegroundColor Cyan
  $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $MyInvocation.MyCommand.Path))
  $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  exit $elevated.ExitCode
}

try {
  Write-Host 'Steam Pinyin Search Easy Installer' -ForegroundColor Cyan
  Write-Host '1/5 Verifying the official Millennium installer...'
  if (-not (Test-Path -LiteralPath $installerPath)) { throw 'MillenniumInstaller-Windows.exe is missing from this bundle.' }
  $actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
  if ($actualHash -ne $installerHash) { throw "Millennium installer hash mismatch: $actualHash" }
  $signature = Get-AuthenticodeSignature -LiteralPath $installerPath
  if ($signature.Status -ne 'Valid') { throw "Millennium installer signature is invalid: $($signature.StatusMessage)" }

  Write-Host '2/5 Starting the official signed Millennium installer...' -ForegroundColor Cyan
  Write-Host 'Complete the visible official installer window. This script will then continue.'
  $installer = Start-Process -FilePath $installerPath -PassThru
  $installer.WaitForExit()

  $steamPath = (Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -Name SteamPath -ErrorAction Stop).SteamPath
  if (-not $steamPath) { throw 'Steam could not be found in the current-user registry.' }
  $millenniumDll = Join-Path $steamPath 'millennium\lib\millennium.dll'
  if (-not (Test-Path -LiteralPath $millenniumDll)) { throw 'Millennium was not detected. The official installer may have been cancelled.' }

  Write-Host '3/5 Waiting for Millennium to initialize its configuration...'
  $configPath = Join-Path $steamPath 'millennium\config\config.json'
  if (-not (Test-Path -LiteralPath $configPath)) {
    Start-Process -FilePath (Join-Path $steamPath 'steam.exe') -WorkingDirectory $steamPath
    for ($attempt = 0; $attempt -lt 60 -and -not (Test-Path -LiteralPath $configPath); $attempt += 1) {
      Start-Sleep -Seconds 1
    }
  }
  if (-not (Test-Path -LiteralPath $configPath)) { throw 'Millennium did not create its configuration within 60 seconds. Start Steam once and retry.' }

  Write-Host '4/5 Installing and enabling Steam Pinyin Search...'
  Get-Process steam, steamwebhelper -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 3
  $pluginRoot = Join-Path $steamPath 'millennium\plugins'
  $target = Join-Path $pluginRoot 'steam-pinyin-search'
  New-Item -ItemType Directory -Path $pluginRoot -Force | Out-Null
  if (Test-Path -LiteralPath $target) {
    $backup = "$target.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item -LiteralPath $target -Destination $backup
  }
  Copy-Item -LiteralPath $payloadPath -Destination $target -Recurse

  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if (-not $config.PSObject.Properties['plugins']) {
    $config | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{ enabledPlugins = @() })
  } elseif (-not $config.plugins.PSObject.Properties['enabledPlugins']) {
    $config.plugins | Add-Member -NotePropertyName enabledPlugins -NotePropertyValue @()
  }
  $enabled = @($config.plugins.enabledPlugins)
  if ($enabled -notcontains 'steam-pinyin-search') { $enabled += 'steam-pinyin-search' }
  $config.plugins.enabledPlugins = $enabled
  $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding UTF8

  Write-Host '5/5 Starting Steam...'
  Start-Process -FilePath (Join-Path $steamPath 'steam.exe') -WorkingDirectory $steamPath
  Write-Host 'Installation complete. Library pinyin search will load automatically.' -ForegroundColor Green
  Write-Host 'Store pinyin results require the project API. Native Steam search remains available without it.'
  Read-Host 'Press Enter to close'
} catch {
  Write-Host "Installation failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'A plugin failure does not uninstall Steam or the official Millennium installation.'
  Read-Host 'Press Enter to close'
  exit 1
}
