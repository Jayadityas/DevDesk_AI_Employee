# Developer-only source fixture creation. This script is not a worker repair tool.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$repository=Join-Path $root 'playground'
$fixtureRoot=Join-Path $root 'var\fixtures'
New-Item -ItemType Directory -Force -Path $fixtureRoot | Out-Null
& git -c "safe.directory=$repository" -C $repository rev-parse 'phase1-clean^{commit}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'The phase1-clean tag is required.' }
$utf8=New-Object System.Text.UTF8Encoding($false)
foreach ($scenario in @('frontend','backend','feature')) {
    $checkout=Join-Path $fixtureRoot $scenario
    if (Test-Path -LiteralPath $checkout) {
        Write-Host "Preserving existing $scenario fixture. No source reset performed."
        continue
    }
    & git -c "safe.directory=$repository" -C $repository worktree add -b "fixture/$scenario" $checkout phase1-clean
    if ($LASTEXITCODE -ne 0) { throw "Could not create $scenario fixture; reconcile existing branches rather than deleting them." }
    if ($scenario -eq 'frontend') {
        $path=Join-Path $checkout 'static\styles.css'
        $css=[IO.File]::ReadAllText($path)
        $css += "`n/* Developer-seeded mobile action overlap fixture. */`n@media (max-width: 640px) { .task-actions { position: relative; min-height: 50px; } .task-actions button { width: 145px; } .task-actions .remove { position: absolute; left: 105px; top: 14px; } }`n"
        [IO.File]::WriteAllText($path,$css,$utf8)
    } elseif ($scenario -eq 'backend') {
        $path=Join-Path $checkout 'src\task_repository.cpp'
        $code=[IO.File]::ReadAllText($path)
        $original="WHERE (?1 = '' OR status = ?1) ORDER BY id;"
        if (-not $code.Contains($original)) { throw 'Expected query was not found; fixture initialization requires review.' }
        $code=$code.Replace($original,"WHERE (?1 = '' OR status = ?1 OR ?1 = 'todo') ORDER BY id;")
        [IO.File]::WriteAllText($path,$code,$utf8)
    }
    if ($scenario -ne 'feature') {
        & git -c "safe.directory=$checkout" -C $checkout add -- static/styles.css src/task_repository.cpp
        if ($LASTEXITCODE -ne 0) { throw 'Fixture staging failed.' }
        & git -c "safe.directory=$checkout" -C $checkout -c commit.gpgsign=false -c user.name='DevDesk Demo' -c user.email='devdesk@example.invalid' commit -m "Seed $scenario defect for manual reproduction"
        if ($LASTEXITCODE -ne 0) { throw 'Fixture commit failed.' }
    }
    Write-Host "Created independent $scenario source fixture."
}
