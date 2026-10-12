$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$file=Join-Path $root 'var\config\model.json'
New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
if(-not(Test-Path $file)) {
    [ordered]@{provider='gemini';model='gemini-3.5-flash-lite';api_key='';vision=$true;max_actions=12;max_calls=12;max_seconds=300;max_tokens=200000;max_usd=0.50;input_usd_per_million=0.30;output_usd_per_million=2.50} | ConvertTo-Json | Set-Content $file -Encoding UTF8
}
Write-Host 'Prepared ignored var/config/model.json. Enter your API key locally; never paste it into chat. Existing configuration was preserved.'
