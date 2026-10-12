$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$source=Join-Path $root 'devdesk'
$buildRoot=Join-Path $source 'build'
New-Item -ItemType Directory -Force $buildRoot | Out-Null
$files=@(Get-ChildItem "$source/src","$source/static","$source/db","$source/prompts","$source/third_party","$source/runner" -File -Recurse | Sort-Object FullName)
$digestText=($files | ForEach-Object {$_.FullName.Substring($source.Length)+':'+(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}) -join "`n"
foreach($helper in @('investigation-helper','repair-helper','control-contract','preview-helper','repair-profile')){
 $label=if($helper -eq 'investigation-helper'){'helper'}else{$helper}
 $digestText+="`n${label}:"+(Get-FileHash (Join-Path $PSScriptRoot "$helper.mjs") -Algorithm SHA256).Hash
}
$hasher=[Security.Cryptography.SHA256]::Create()
try{$digest=([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($digestText)))).Replace('-','').ToLowerInvariant()}finally{$hasher.Dispose()}
$output=Join-Path $buildRoot "releases/$digest"
function Select-Release {
 $temporary=Join-Path $buildRoot ('latest.'+[Guid]::NewGuid().ToString('N')+'.tmp')
 @{directory=$output} | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
 Move-Item -LiteralPath $temporary -Destination (Join-Path $buildRoot 'latest.json') -Force
}
$required=@('devdesk.exe','build-info.json','investigation-helper.mjs','repair-helper.mjs','control-contract.mjs','preview-helper.mjs','repair-profile.mjs','static/index.html','static/app.js','static/styles.css','prompts/investigation.md','prompts/repair.md','prompts/project.md','libpq.dll','libcrypto-3-x64.dll','libssl-3-x64.dll','libiconv-2.dll','libintl-9.dll','zlib1.dll','libwinpthread-1.dll')
if(Test-Path (Join-Path $output 'build-info.json')){
 $metadata=Get-Content (Join-Path $output 'build-info.json') -Raw | ConvertFrom-Json
 if($metadata.build -ne $digest){throw 'Release metadata does not match its source fingerprint.'}
 foreach($file in $required){if(-not(Test-Path (Join-Path $output $file) -PathType Leaf)){throw "Immutable release is incomplete: $file. Existing release preserved."}}
 Select-Release
 Write-Host "Existing immutable build selected: $output"
 return
}
$compiler='C:/msys64/ucrt64/bin/g++.exe'
$pg='C:/Program Files/PostgreSQL/17'
if(-not(Test-Path $compiler)){throw 'C++ compiler missing: install MSYS2 UCRT64 g++.'}
New-Item -ItemType Directory -Force $output | Out-Null
$unity=(@('support.cpp','image.cpp','provider.cpp','worker.cpp','repair.cpp','reliability.cpp','integration.cpp','consensus.cpp','routes.cpp','main.cpp') | ForEach-Object {'#include "'+(Join-Path $source "src/$_").Replace('\','/')+'"'}) -join "`n"
[IO.File]::WriteAllText((Join-Path $output 'unity.cpp'),$unity)
$arguments=@('-std=c++20','-O0','-g','-Wall','-Wextra','-Wpedantic','-pthread','-static-libgcc','-static-libstdc++',('-I'+(Join-Path $source 'third_party')),('-I'+"$pg/include"),(Join-Path $output 'unity.cpp'),"$pg/lib/libpq.lib",'-lbcrypt','-lole32','-lwindowscodecs','-luuid','-lws2_32','-lcrypt32','-lwinhttp','-o',(Join-Path $output 'devdesk.exe'))
& $compiler @arguments
if($LASTEXITCODE -ne 0){throw 'Workbench C++ compilation failed; latest release selection preserved.'}
foreach($dll in @('libpq.dll','libcrypto-3-x64.dll','libssl-3-x64.dll','libiconv-2.dll','libintl-9.dll','zlib1.dll')){Copy-Item -LiteralPath (Join-Path "$pg/bin" $dll) -Destination $output -Force}
Copy-Item -LiteralPath 'C:/msys64/ucrt64/bin/libwinpthread-1.dll' -Destination $output -Force
foreach($directory in @('static','prompts')){Copy-Item -LiteralPath (Join-Path $source $directory) -Destination $output -Recurse -Force}
foreach($helper in @('investigation-helper','repair-helper','control-contract','preview-helper','repair-profile')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot "$helper.mjs") -Destination $output -Force}
@{build=$digest;compiler=(& $compiler -dumpfullversion);postgres=(& "$pg/bin/postgres.exe" --version);built_at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'build-info.json') -Encoding UTF8
Select-Release
Write-Host "Built $output/devdesk.exe"
