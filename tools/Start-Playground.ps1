param([ValidateSet('clean','frontend','backend','feature')][string]$Scenario='clean',[int]$Port=8080,[switch]$ResetData,[switch]$Build,[ValidateRange(0,3600)][int]$RunForSeconds=0)
$ErrorActionPreference='Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
$root=Split-Path $PSScriptRoot
$source=if ($Scenario -eq 'clean') { Join-Path $root 'playground' } else { Join-Path $root "var\fixtures\$Scenario" }
if (-not (Test-Path -LiteralPath (Join-Path $source 'src\main.cpp'))) { throw 'Fixture source missing. Run tools\Initialize-Fixtures.ps1 first.' }
$executable=Join-Path $source 'build\team-tasks.exe'
if ($Build -or -not (Test-Path -LiteralPath $executable)) { & (Join-Path $PSScriptRoot 'Build-Playground.ps1') -Source $source }
$dataDirectory=Join-Path $root 'var\data'
New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
$database=Join-Path $dataDirectory "$Scenario.db"
# Refuse reset while this scenario's server is running. Data reset never edits source.
$running=Get-CimInstance Win32_Process -Filter "Name='team-tasks.exe'" | Where-Object { $_.ExecutablePath -eq $executable }
if ($running) { throw 'This scenario is already running. Stop its server with Ctrl+C before starting or resetting it.' }
if ($ResetData -or -not (Test-Path -LiteralPath $database)) {
    & $executable --db $database --seed
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic seed reset failed.' }
}
Write-Host "Scenario: $Scenario. Reset controls are local CLI only. Ctrl+C stops the server."
Write-Host "Open http://127.0.0.1:$Port"
$previewProcess=New-Object System.Diagnostics.Process
$previewProcess.StartInfo.FileName=$executable
$previewProcess.StartInfo.Arguments='--db "' + $database + '" --static "' + (Join-Path $source 'build\static') + '" --port ' + $Port + ' --scenario ' + $Scenario
$previewProcess.StartInfo.UseShellExecute=$false
$previewProcess.StartInfo.CreateNoWindow=$true
try {
    if (-not $previewProcess.Start()) { throw 'Could not start the playground.' }
    $previewClock=[System.Diagnostics.Stopwatch]::StartNew()
    while (-not $previewProcess.HasExited) {
        if ($RunForSeconds -gt 0 -and $previewClock.Elapsed.TotalSeconds -ge $RunForSeconds) { break }
        Start-Sleep -Milliseconds 250
    }
    if ($previewProcess.HasExited -and $previewProcess.ExitCode -ne 0) { throw 'Playground server exited with an error.' }
} finally {
    if (-not $previewProcess.HasExited) {
        $previewProcess.Kill()
        $previewProcess.WaitForExit(3000) | Out-Null
    }
    $previewProcess.Dispose()
}
