param([string]$DockerCommand = 'docker', [string]$Image = 'dsh-neural-lab-cpu:0.1')
$ErrorActionPreference = 'Stop'
if (-not (Get-Command $DockerCommand -ErrorAction SilentlyContinue)) {
    $candidate = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
    if (Test-Path -LiteralPath $candidate) { $DockerCommand = $candidate }
}
if ([IO.Path]::IsPathRooted($DockerCommand)) { $env:PATH = (Split-Path $DockerCommand) + ';' + $env:PATH }
& $DockerCommand version
if ($LASTEXITCODE -ne 0) { throw 'Docker Linux daemon is unavailable. Start Docker Desktop; host execution is not used.' }
& $DockerCommand build --progress plain -t $Image (Join-Path $PSScriptRoot 'cpu-image')
if ($LASTEXITCODE -ne 0) { throw 'CPU image preparation failed' }
& $DockerCommand run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 1g --cpus 1 $Image python -c 'import numpy, torch; print(numpy.__version__, torch.__version__); assert torch.version.cuda is None'
if ($LASTEXITCODE -ne 0) { throw 'CPU image self-check failed' }
Write-Output "CPU image ready: $Image. For offline transport: docker save -o neural-lab-cpu.tar $Image; on the destination: docker load -i neural-lab-cpu.tar"
