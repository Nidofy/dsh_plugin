param([switch]$Restart, [switch]$Stop, [switch]$SoftwareRendering)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.build/ai-village-rc3-desktop'))
if (-not $testRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Test root escaped repository.' }
$carrier = Join-Path $testRoot 'carrier/DeepSeek Harness.exe'
$carrierLocation = Join-Path $testRoot 'carrier-location.json'
if (Test-Path -LiteralPath $carrierLocation) {
  $temporaryCarrier = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'dsh-ai-village-rc3-qa-ead9a0fb/carrier/DeepSeek Harness.exe'))
  $carrier = [IO.Path]::GetFullPath((Get-Content -LiteralPath $carrierLocation -Raw | ConvertFrom-Json).carrier)
  if ($carrier -ne $temporaryCarrier) { throw 'External carrier must be the exact dedicated temporary QA copy.' }
}
$asarPath = Join-Path (Split-Path -Parent $carrier) 'resources/app.asar'
$port = 18783
$testProfile = (Join-Path $testRoot 'home').Replace('\', '/')
$testUserData = (Join-Path $testRoot 'electron-data').Replace('\', '/')
$pidFile = Join-Path $testRoot 'desktop.pid'
if (-not (Test-Path -LiteralPath $carrier)) { throw 'Extract the verified official rc.3 Desktop into the dedicated carrier first.' }
if ((Get-Item -LiteralPath $carrier).VersionInfo.FileVersion -ne '0.2.1-rc.3') { throw 'Unexpected Desktop version.' }
if ((Get-FileHash -LiteralPath $asarPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne '04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0') { throw 'Official rc.3 distribution bytes do not match the verified download.' }
if (Test-Path -LiteralPath $pidFile) {
  $testPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $running = Get-CimInstance Win32_Process -Filter "ProcessId = $testPid"
  if ($running) {
    if (-not ($Restart -or $Stop)) { throw 'Isolated rc.3 Desktop is already running.' }
    if ($running.ExecutablePath -ne $carrier -or -not $running.CommandLine.Contains("--user-data-dir=$testUserData")) { throw 'PID is not the isolated rc.3 carrier with its dedicated user-data directory.' }
    & taskkill.exe /PID $testPid /T /F
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the verified isolated process tree.' }
  }
}
if ($Stop) { Write-Output 'Only the identified rc.3 QA process tree stopped (or already exited).'; exit 0 }
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw 'CDP 18783 is occupied.' }
$previousDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = $testProfile
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $launchArgs = @("--user-data-dir=$testUserData", "--remote-debugging-port=$port", '--remote-debugging-address=127.0.0.1')
  if ($SoftwareRendering) { $launchArgs += @('--use-angle=swiftshader', '--enable-unsafe-swiftshader') }
  $started = Start-Process -FilePath $carrier -ArgumentList $launchArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$stamp.stdout.log") -RedirectStandardError (Join-Path $testRoot "$stamp.stderr.log")
  Set-Content -LiteralPath $pidFile -Value $started.Id
  [PSCustomObject]@{startedAt=[DateTime]::UtcNow.ToString('o'); pid=$started.Id; port=$port; version='0.2.1-rc.3'; carrier=$carrier; arguments=$launchArgs; dshHome=$testProfile; softwareRendering=[bool]$SoftwareRendering; windowStyle='Hidden'; asarSha256=(Get-FileHash -LiteralPath $asarPath -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'launch.json')
  Write-Output "Isolated official rc.3 Desktop started: PID $($started.Id), CDP 127.0.0.1:$port."
} finally { $env:DSH_HOME = $previousDshHome }
