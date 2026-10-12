param([Parameter(Mandatory=$true)][string]$RunDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$RunDirectory=[IO.Path]::GetFullPath($RunDirectory)
$evidenceRoot=[IO.Path]::GetFullPath((Join-Path $root 'var\evidence'))+[IO.Path]::DirectorySeparatorChar
if(-not $RunDirectory.StartsWith($evidenceRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Test output must stay under var/evidence.'}
New-Item -ItemType Directory -Force $RunDirectory | Out-Null
$secrets=Get-Content (Join-Path $root 'var\config\postgres-admin.json') -Raw | ConvertFrom-Json
$schema='test_'+[Guid]::NewGuid().ToString('N')
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName='C:\Program Files\PostgreSQL\17\bin\psql.exe'
$info.Arguments='-X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5433 -U devdesk_admin -d devdesk_demo'
$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$info.EnvironmentVariables['PGPASSWORD']=$secrets.admin
$process=[Diagnostics.Process]::Start($info)
$migration=(Get-ChildItem (Join-Path $root 'devdesk\db') -Filter '*.sql' | Sort-Object Name | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$sql="CREATE SCHEMA $schema AUTHORIZATION devdesk_owner; SET ROLE devdesk_owner; SET search_path TO $schema;`n"+$migration+"`nGRANT USAGE ON SCHEMA $schema TO devdesk_app; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA $schema TO devdesk_app; REVOKE UPDATE ON events,scope_approvals,candidate_decisions,feature_votes,feature_poll_members,feature_polls FROM devdesk_app; GRANT UPDATE(state,closed_at) ON feature_polls TO devdesk_app; REVOKE DELETE ON scope_approvals,candidate_decisions FROM devdesk_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA $schema TO devdesk_app;"
$process.StandardInput.WriteLine($sql);$process.StandardInput.Close()
$null=$process.StandardOutput.ReadToEnd();$null=$process.StandardError.ReadToEnd();$process.WaitForExit()
$exit=$process.ExitCode;$process.Dispose();if($exit -ne 0){throw 'Fresh test schema setup failed.'}
@{dsn="host=127.0.0.1 port=5433 dbname=devdesk_demo user=devdesk_app password=$($secrets.app)";schema=$schema;uploads=(Join-Path $RunDirectory 'uploads')} | ConvertTo-Json | Set-Content (Join-Path $RunDirectory 'test-config.json') -Encoding UTF8
Write-Host 'Fresh isolated Phase 2 test schema created; manual demo records preserved.'
