param([switch]$Restart)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $repoRoot '.build\ai-village-v0.4-desktop'
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$carrier = Join-Path $repoRoot '.build\ai-village-phase5\carrier\DeepSeek Harness.exe'
$testProfile = (Join-Path $testRoot 'home').Replace('\', '/')
$testUserData = (Join-Path $testRoot 'electron-data').Replace('\', '/')
if (-not (Test-Path -LiteralPath $carrier)) { throw 'Copy the official Desktop distribution into the isolated carrier folder first.' }
$pidFile = Join-Path $testRoot 'desktop.pid'
if (Test-Path -LiteralPath $pidFile) {
  $testPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $running = Get-CimInstance Win32_Process -Filter "ProcessId = $testPid"
  if ($running) {
    if (-not $Restart) { throw 'The isolated Desktop is already running.' }
    if ($running.ExecutablePath -ne $carrier -or -not $running.CommandLine.Contains($testUserData)) {
      throw 'Recorded process does not match the isolated carrier and user-data directory.'
    }
    # Deliberately simulate a cold process loss after the acceptance script has saved a paused world.
    & taskkill.exe /PID $testPid /T /F
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the isolated test process tree.' }
  }
}
$previousDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = $testProfile
  $started = Start-Process -FilePath $carrier -ArgumentList @(
    "--user-data-dir=$testUserData", '--remote-debugging-port=18755', '--remote-debugging-address=127.0.0.1', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'
  ) -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $testRoot 'carrier.stdout.log') `
    -RedirectStandardError (Join-Path $testRoot 'carrier.stderr.log')
  Set-Content -LiteralPath $pidFile -Value $started.Id
  Write-Output "Isolated official Desktop started: PID $($started.Id), CDP localhost:18755."
} finally {
  $env:DSH_HOME = $previousDshHome
}
