param([ValidateRange(0,3600)][int]$RunForSeconds=0)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$demo=Get-Content (Join-Path $root 'var/evidence/loom-demo-latest.json') -Raw | ConvertFrom-Json
$listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Parse('127.0.0.1'),8115)
$listener.Server.ExclusiveAddressUse=$true
try{$listener.Start()}catch{throw 'Demo port8115 is occupied; existing process preserved.'}finally{$listener.Stop()}
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=Join-Path $demo.release 'devdesk.exe';$info.Arguments='--serve "'+$demo.config+'" 8115 "'+(Join-Path $demo.release 'static')+'"'
$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$child=[Diagnostics.Process]::Start($info)
Write-Host 'Open http://127.0.0.1:8115. Sign in as asha using the demo accounts file locally, before recording.'
Write-Host 'History contains real verified frontend/backend/feature completions. Do not run workers against this presentation schema.'
try{$end=if($RunForSeconds){[DateTime]::UtcNow.AddSeconds($RunForSeconds)}else{[DateTime]::MaxValue};while(-not $child.HasExited -and [DateTime]::UtcNow -lt $end){Start-Sleep -Milliseconds 250};if($child.HasExited -and $child.ExitCode -ne 0){throw 'Demo server failed.'}}
finally{if(-not $child.HasExited){$child.Kill();$child.WaitForExit()};$child.Dispose()}
