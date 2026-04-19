param(
  [string]$Version = ""
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir

if (-not $Version) {
  $packageJson = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
  $Version = $packageJson.version
}

$distDir = Join-Path $root 'dist'
$stageDir = Join-Path $distDir ('whiteowl-extension-' + $Version)
$zipPath = Join-Path $distDir ('whiteowl-extension-v' + $Version + '.zip')

$include = @(
  '_locales',
  '2.png',
  '3.png',
  '4.png',
  '5.png',
  '6.png',
  'background.js',
  'content.js',
  'ex.mp4',
  'i18n-ext.js',
  'icon128.png',
  'icon16.png',
  'icon48.png',
  'lightweight-charts.js',
  'logo.png',
  'manifest.json',
  'owl.svg',
  'provider.js',
  'result_transparent.webm',
  'sidepanel.css',
  'sidepanel.html',
  'sidepanel.js',
  'swap-progress.webm'
)

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

foreach ($item in $include) {
  $source = Join-Path $root $item
  $target = Join-Path $stageDir $item
  $targetParent = Split-Path -Parent $target
  if (-not (Test-Path $source)) {
    throw "Missing release asset input: $item"
  }
  New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
  Copy-Item $source $target -Recurse -Force
}

Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
Write-Output $zipPath