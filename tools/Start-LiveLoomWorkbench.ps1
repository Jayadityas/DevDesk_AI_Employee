param([ValidateRange(0,3600)][int]$RunForSeconds=0)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$demo=Get-Content (Join-Path $root 'var/evidence/live-loom-latest.json') -Raw | ConvertFrom-Json
$port=8116
$listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Parse('127.0.0.1'),$port)
$listener.Server.ExclusiveAddressUse=$true
try{$listener.Start()}catch{throw 'Live demo port8116 is occupied; existing service preserved.'}finally{$listener.Stop()}
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=Join-Path $demo.release 'devdesk.exe';$info.Arguments='--serve "'+$demo.config+'" '+$port+' "'+(Join-Path $demo.release 'static')+'"'
$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$child=[Diagnostics.Process]::Start($info)
Write-Host 'Open http://127.0.0.1:8116. This is an empty LIVE recording queue, not completed-history replay.'
try{$end=if($RunForSeconds){[DateTime]::UtcNow.AddSeconds($RunForSeconds)}else{[DateTime]::MaxValue};while(-not $child.HasExited -and [DateTime]::UtcNow -lt $end){Start-Sleep -Milliseconds 250};if($child.HasExited -and $child.ExitCode -ne 0){throw 'Live demo server failed.'}}
finally{if(-not $child.HasExited){$child.Kill();$child.WaitForExit()};$child.Dispose()}
