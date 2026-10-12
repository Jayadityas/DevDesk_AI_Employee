param([string]$Source = (Join-Path (Split-Path $PSScriptRoot) 'playground'))
$ErrorActionPreference = 'Stop'
$Source = (Resolve-Path -LiteralPath $Source).Path
$outputDirectory = Join-Path $Source 'build'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$compiler = 'C:\msys64\ucrt64\bin\g++.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'MSYS2 UCRT64 g++ was not found.' }
$commit = & git -c "safe.directory=$Source" -C $Source rev-parse HEAD 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Initialize and commit the playground repository before building.' }
$sourceFiles = @(Get-ChildItem -LiteralPath (Join-Path $Source 'src'),(Join-Path $Source 'static'),(Join-Path $Source 'third_party') -File -Recurse | Sort-Object FullName)
$digestText = ($sourceFiles | ForEach-Object { $_.FullName.Substring($Source.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) -join "`n"
$hasher = [System.Security.Cryptography.SHA256]::Create()
try { $digest = ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($digestText)))).Replace('-','').ToLowerInvariant() }
finally { $hasher.Dispose() }
# Generated header avoids Windows PowerShell native-argument quote stripping.
$identity = '#define PLAYGROUND_COMMIT "' + $commit + '"' + "`n" + '#define PLAYGROUND_BUILD "' + $digest + '"' + "`n"
[IO.File]::WriteAllText((Join-Path $outputDirectory 'build_identity.hpp'),$identity)
# One translation unit avoids parsing the large HTTP/JSON headers twice.
$unity = (@('main.cpp','routes.cpp','task_repository.cpp') | ForEach-Object { '#include "' + (Join-Path $Source "src\$_").Replace('\','/') + '"' }) -join "`n"
[IO.File]::WriteAllText((Join-Path $outputDirectory 'unity.cpp'),$unity)
$arguments = @('-std=c++20','-O0','-g','-Wall','-Wextra','-Wpedantic','-pthread','-static-libgcc','-static-libstdc++', '-I' + (Join-Path $Source 'third_party'), '-I' + $outputDirectory, '-IC:\msys64\ucrt64\include', (Join-Path $outputDirectory 'unity.cpp'), '-LC:\msys64\ucrt64\lib','-lsqlite3','-lws2_32','-lcrypt32','-o',(Join-Path $outputDirectory 'team-tasks.exe'))
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'C++ compilation failed.' }
foreach ($dll in @('libsqlite3-0.dll','libwinpthread-1.dll')) {
    Copy-Item -LiteralPath (Join-Path 'C:\msys64\ucrt64\bin' $dll) -Destination $outputDirectory -Force
}
$staticOutput = Join-Path $outputDirectory 'static'
New-Item -ItemType Directory -Force -Path $staticOutput | Out-Null
foreach ($asset in @('index.html','app.js','styles.css')) {
    Copy-Item -LiteralPath (Join-Path $Source "static\$asset") -Destination $staticOutput -Force
}
[ordered]@{ commit=$commit; build=$digest; compiler=(& $compiler -dumpfullversion); built_at=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputDirectory 'build-info.json') -Encoding UTF8
Write-Host "Built $outputDirectory\team-tasks.exe"
