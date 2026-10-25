param([switch]$Restart, [switch]$Stop, [switch]$SoftwareRendering, [switch]$UnthrottledQa, [switch]$VisibleQa, [ValidatePattern('^(?:[a-z0-9][a-z0-9-]{0,40})?$')][string]$RunTag = '')
$Port = 18774
$RunRoot = 'ai-village-tea-qa-desktop'
if ($RunTag) { $RunRoot += '-' + $RunTag }
$ErrorActionPreference = 'Stop'
if ($UnthrottledQa -and $RunTag -ne 'approved-pre3') { throw 'Controlled offscreen scheduling is authorized only for RunTag approved-pre3.' }
if ($VisibleQa -and $RunTag -ne 'approved-pre3') { throw 'Visible QA is limited to the dedicated approved-pre3 profile.' }
if ($VisibleQa -and $UnthrottledQa) { throw 'Keep visible and controlled offscreen evidence separate.' }
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
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "CDP port $Port is occupied." }
$previousDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = $testProfile
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $launchArgs = @("--user-data-dir=$testUserData", "--remote-debugging-port=$Port", '--remote-debugging-address=127.0.0.1')
  if ($SoftwareRendering) { $launchArgs += @('--use-angle=swiftshader', '--enable-unsafe-swiftshader') }
  if ($UnthrottledQa) { $launchArgs += @('--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion') }
  # VisibleQa must only be invoked after the user explicitly authorizes showing this isolated window.
  $launchWindowStyle = if ($VisibleQa) { 'Normal' } else { 'Hidden' }
  $started = Start-Process -FilePath $carrier -ArgumentList $launchArgs -WindowStyle $launchWindowStyle -PassThru -RedirectStandardOutput (Join-Path $testRoot "$stamp.stdout.log") -RedirectStandardError (Join-Path $testRoot "$stamp.stderr.log")
  Set-Content -LiteralPath $pidFile -Value $started.Id
  [PSCustomObject]@{ startedAt=[DateTime]::UtcNow.ToString('o'); pid=$started.Id; port=$Port; version=(Get-Item -LiteralPath $carrier).VersionInfo.FileVersion; arguments=$launchArgs; dshHome=$testProfile; softwareRendering=[bool]$SoftwareRendering; unthrottledQa=[bool]$UnthrottledQa; visibleQa=[bool]$VisibleQa; schedulingCondition=$(if ($VisibleQa) { 'user-authorized-visible-qa' } elseif ($UnthrottledQa) { 'controlled-offscreen-scheduling' } else { 'default-hidden' }); windowStyle=$launchWindowStyle } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'launch.json')
  Write-Output "Isolated official Desktop started: PID $($started.Id), CDP 127.0.0.1:$Port."
} finally { $env:DSH_HOME = $previousDshHome }
