param([int]$Port=8094,[switch]$Build,[int]$RunForSeconds=0)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535 -or $RunForSeconds -lt 0) { throw 'Invalid port or duration.' }
$root = Split-Path $PSScriptRoot
$probe = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Parse('127.0.0.1'),$Port)
$probe.Server.ExclusiveAddressUse = $true
try { $probe.Start() }
catch { throw "Port $Port is already occupied. Choose a different -Port; the existing process is left running." }
finally { $probe.Stop() }
& (Join-Path $PSScriptRoot 'Setup-DevDeskPostgres.ps1')
$latest = Join-Path $root 'devdesk\build\latest.json'
if ($Build -or -not (Test-Path $latest)) { & (Join-Path $PSScriptRoot 'Build-Workbench.ps1') }
$release = (Get-Content $latest -Raw | ConvertFrom-Json).directory
$exe = Join-Path $release 'devdesk.exe'
$config = Join-Path $root 'var\config\workbench.json'
& $exe --seed $config (Join-Path $root 'var\config\demo-accounts.json')
if ($LASTEXITCODE -ne 0) { throw 'Synthetic account initialization failed.' }
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName=$exe
$info.Arguments='--serve "'+$config+'" '+$Port+' "'+(Join-Path $release 'static')+'"'
$info.UseShellExecute=$false
$info.CreateNoWindow=$true
$child=[Diagnostics.Process]::Start($info)
Write-Host "Open http://127.0.0.1:$Port. Press Ctrl+C to stop the workbench."
try {
    $deadline=if($RunForSeconds -gt 0){[DateTime]::UtcNow.AddSeconds($RunForSeconds)}else{[DateTime]::MaxValue}
    while(-not $child.HasExited -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 250}
    if($child.HasExited -and $child.ExitCode -ne 0){throw 'Workbench exited with a failure.'}
} finally {
    if(-not $child.HasExited){$child.Kill();$child.WaitForExit()}
    $child.Dispose()
}
