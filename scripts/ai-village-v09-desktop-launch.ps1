param([switch]$Restart, [switch]$Stop, [ValidatePattern('^ai-village-v09-desktop(?:-[a-z0-9-]+)?$')][string]$RunRoot = 'ai-village-v09-desktop')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = [IO.Path]::GetFullPath((Join-Path (Join-Path $repoRoot '.build') $RunRoot))
if (-not $testRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Test directory must stay inside repository.' }
$carrier = Join-Path $repoRoot '.build\ai-village-phase5\carrier\DeepSeek Harness.exe'
if (-not (Test-Path -LiteralPath $carrier)) { throw 'Cached official Desktop distribution is missing; no download or host modification is performed.' }
if ((Get-Item -LiteralPath $carrier).VersionInfo.FileVersion -ne '0.2.1-rc.2') { throw 'Unexpected official Desktop version.' }
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$testProfile = (Join-Path $testRoot 'home').Replace('\', '/')
$testUserData = (Join-Path $testRoot 'electron-data').Replace('\', '/')
$pidFile = Join-Path $testRoot 'desktop.pid'
if (Test-Path -LiteralPath $pidFile) {
  $testPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $running = Get-CimInstance Win32_Process -Filter "ProcessId = $testPid"
  if ($running) {
    if (-not ($Restart -or $Stop)) { throw 'The isolated Desktop is already running.' }
    if ($running.ExecutablePath -ne $carrier -or -not $running.CommandLine.Contains($testUserData)) { throw 'Process identity does not match isolated carrier and user-data directory.' }
    & taskkill.exe /PID $testPid /T /F
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop only the isolated Desktop process tree.' }
  }
}
if ($Stop) { Write-Output 'Isolated Desktop stopped (or already exited).'; exit 0 }
if (Get-NetTCPConnection -LocalPort 18767 -State Listen -ErrorAction SilentlyContinue) { throw 'CDP port 18767 is occupied.' }
$previousDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = $testProfile
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $started = Start-Process -FilePath $carrier -ArgumentList @(
    "--user-data-dir=$testUserData", '--remote-debugging-port=18767', '--remote-debugging-address=127.0.0.1',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'
  ) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$stamp.stdout.log") -RedirectStandardError (Join-Path $testRoot "$stamp.stderr.log")
  Set-Content -LiteralPath $pidFile -Value $started.Id
  Write-Output "Isolated official Desktop started: PID $($started.Id), CDP 127.0.0.1:18767."
} finally { $env:DSH_HOME = $previousDshHome }

