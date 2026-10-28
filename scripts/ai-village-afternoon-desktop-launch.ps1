param([switch]$Restart, [switch]$Stop, [switch]$SoftwareRendering)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.build/ai-village-afternoon-desktop'))
if (-not $testRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Test root escaped repository.' }
$carrier = [IO.Path]::GetFullPath((Get-Content -LiteralPath (Join-Path $testRoot 'carrier-location.json') -Raw | ConvertFrom-Json).carrier)
$approvedCarrier = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'dsh-ai-village-rc3-qa-ead9a0fb/carrier/DeepSeek Harness.exe'))
if ($carrier -ne $approvedCarrier) { throw 'Carrier must be the exact previously verified official temporary QA copy.' }
$asarPath = Join-Path (Split-Path -Parent $carrier) 'resources/app.asar'
if ((Get-Item -LiteralPath $carrier).VersionInfo.FileVersion -ne '0.2.1-rc.3') { throw 'Unexpected Desktop version.' }
if ((Get-FileHash -LiteralPath $asarPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne '04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0') { throw 'Official carrier bytes changed.' }
$port = 18784
$testProfile = (Join-Path $testRoot 'home').Replace('\', '/')
$testUserData = (Join-Path $testRoot 'electron-data').Replace('\', '/')
$pidFile = Join-Path $testRoot 'desktop.pid'
if (Test-Path -LiteralPath $pidFile) {
  $testPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $running = Get-CimInstance Win32_Process -Filter "ProcessId = $testPid"
  if ($running) {
    if (-not ($Restart -or $Stop)) { throw 'Isolated afternoon Desktop is already running.' }
    $prior = Get-Content -LiteralPath (Join-Path $testRoot 'launch.json') -Raw | ConvertFrom-Json
    $recordedCreation = [DateTimeOffset]$prior.processCreatedAt
    if ($prior.pid -ne $testPid -or $running.ExecutablePath -ne $carrier -or -not $running.CommandLine.Contains("--user-data-dir=$testUserData") -or -not $running.CommandLine.Contains("--remote-debugging-port=$port") -or $running.CreationDate.ToUniversalTime().Ticks -ne $recordedCreation.UtcTicks) { throw 'PID/creation time/arguments do not identify this isolated afternoon instance.' }
    & taskkill.exe /PID $testPid /T /F
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the verified isolated process tree.' }
  }
}
if ($Stop) { Write-Output 'Only the identified afternoon QA process tree stopped (or already exited).'; exit 0 }
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw 'CDP 18784 is occupied.' }
$previousDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = $testProfile
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $launchArgs = @("--user-data-dir=$testUserData", "--remote-debugging-port=$port", '--remote-debugging-address=127.0.0.1')
  if ($SoftwareRendering) { $launchArgs += @('--use-angle=swiftshader', '--enable-unsafe-swiftshader') }
  $started = Start-Process -FilePath $carrier -ArgumentList $launchArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$stamp.stdout.log") -RedirectStandardError (Join-Path $testRoot "$stamp.stderr.log")
  Set-Content -LiteralPath $pidFile -Value $started.Id
  $created = (Get-CimInstance Win32_Process -Filter "ProcessId = $($started.Id)").CreationDate.ToUniversalTime().ToString('o')
  [PSCustomObject]@{startedAt=[DateTime]::UtcNow.ToString('o'); processCreatedAt=$created; pid=$started.Id; port=$port; version='0.2.1-rc.3'; carrier=$carrier; arguments=$launchArgs; dshHome=$testProfile; softwareRendering=[bool]$SoftwareRendering; windowStyle='Hidden'; asarSha256=(Get-FileHash -LiteralPath $asarPath -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'launch.json')
  Write-Output "Isolated official afternoon Desktop started: PID $($started.Id), CDP 127.0.0.1:$port."
} finally { $env:DSH_HOME = $previousDshHome }
