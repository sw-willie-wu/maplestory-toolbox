# Downloads WzComparerR2 (Kagamia/WzComparerR2, release tag "ci-build") and copies
# WzComparerR2.WzLib.dll plus its runtime dependency into tools/wz-export/lib/.
# Pinned asset name + SHA-256; update both (and README) when bumping the version.
$ErrorActionPreference = 'Stop'

$AssetName = 'WcR2_With_Plugins_net8_20261004.1.zip'
$Sha256 = 'B634C25AAF61BCDE3E3FE5F2F49A6D5CAB96D8FB6EC3494DAE2596BFA55E569E'
$Url = "https://github.com/Kagamia/WzComparerR2/releases/download/ci-build/$AssetName"

$LibDir = Join-Path $PSScriptRoot 'lib'
$ZipPath = Join-Path $LibDir $AssetName
$ExtractDir = Join-Path $LibDir ([IO.Path]::GetFileNameWithoutExtension($AssetName))

New-Item -ItemType Directory -Force $LibDir | Out-Null

if (-not (Test-Path $ZipPath)) {
    Write-Host "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing
}

$actual = (Get-FileHash -Algorithm SHA256 $ZipPath).Hash
if ($actual -ne $Sha256) {
    Remove-Item -Force $ZipPath
    throw "SHA-256 mismatch for ${AssetName}: expected $Sha256, got $actual (file deleted)"
}

# Extract into its own directory; only the two DLLs below are used.
if (Test-Path $ExtractDir) { Remove-Item -Recurse -Force $ExtractDir }
New-Item -ItemType Directory -Force $ExtractDir | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir

$Wanted = @('WzComparerR2.WzLib.dll', 'System.Drawing.Common.dll')
$Found = @()
foreach ($name in $Wanted) {
    $hit = Get-ChildItem -Path (Join-Path $ExtractDir 'Lib') -Filter $name | Select-Object -First 1
    if (-not $hit) { throw "Missing Lib/$name in $AssetName" }
    Copy-Item $hit.FullName (Join-Path $LibDir $name) -Force
    $Found += $hit.FullName
}
Write-Host "Copied:`n  $($Found -join "`n  ")"
