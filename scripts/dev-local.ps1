$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$exampleFile = Join-Path $root '.env.example'

if (-not (Test-Path -LiteralPath $envFile)) {
  Copy-Item -LiteralPath $exampleFile -Destination $envFile
  Write-Host 'Criado .env local a partir de .env.example.'
}

Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

Set-Location $root
pnpm infra:up

Start-Process powershell.exe -ArgumentList @(
  '-NoProfile',
  '-NoExit',
  '-Command',
  "Set-Location '$root'; pnpm --filter @arcsyn-shift/api dev; if (`$LASTEXITCODE -ne 0) { Read-Host 'A API encerrou com erro. Pressione Enter para fechar' }"
)

Start-Process powershell.exe -ArgumentList @(
  '-NoProfile',
  '-NoExit',
  '-Command',
  "Set-Location '$root'; pnpm --filter @arcsyn-shift/web dev --host 0.0.0.0 --port 5173 --strictPort; if (`$LASTEXITCODE -ne 0) { Read-Host 'O frontend não pôde usar a porta 5173. Pressione Enter para fechar' }"
)

Write-Host 'Infraestrutura, API e frontend iniciados.'
Write-Host 'Frontend: http://localhost:5173'
Write-Host 'API:      http://localhost:3000/api/health'
