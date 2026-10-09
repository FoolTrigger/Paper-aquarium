# tools/build-dist.ps1
# Build release distribution: Windows Installer (Setup.exe) and Portable (ZIP)

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$distDir = Join-Path $rootDir "dist"

Write-Host "================================================="
Write-Host "Building Paper Aquarium Releases"
Write-Host "================================================="

# 1. Clean / create dist
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# 2. Check / generate icon
$iconPath = Join-Path $rootDir "assets\app-icon.ico"
if (-not (Test-Path $iconPath)) {
    Write-Host "Generating application icon..."
    & powershell -ExecutionPolicy Bypass -File (Join-Path $rootDir "tools\generate-icon.ps1")
}

# 3. Compile PaperAquarium.exe
Write-Host "Compiling native launcher (PaperAquarium.exe)..."
& powershell -ExecutionPolicy Bypass -File (Join-Path $rootDir "tools\build-launcher.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Launcher build failed."
    exit 1
}

# 4. Prepare standalone Node.js runtime
$runtimeDir = Join-Path $rootDir "runtime"
$runtimeNode = Join-Path $runtimeDir "node.exe"
if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

if (-not (Test-Path $runtimeNode)) {
    $systemNode = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $systemNode -or -not (Test-Path $systemNode)) {
        Write-Error "node.exe not found in system to bundle into runtime."
        exit 1
    }
    Write-Host "Copying node.exe to runtime folder ($systemNode)..."
    Copy-Item $systemNode $runtimeNode -Force
}

# 5. Build Inno Setup Installer
$isccPaths = @(
    "C:\Users\Fool\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)

$isccExe = $null
foreach ($p in $isccPaths) {
    if (Test-Path $p) {
        $isccExe = $p
        break
    }
}

if ($isccExe) {
    Write-Host "Building Windows Installer (PaperAquarium-Setup.exe)..."
    $issFile = Join-Path $rootDir "installer\setup.iss"
    & $isccExe "/Qp" $issFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Inno Setup compilation failed."
        exit 1
    }
    Write-Host "Windows Installer successfully created."
} else {
    Write-Warning "Inno Setup Compiler (ISCC.exe) not found! Skipping installer."
}

# 6. Build Portable ZIP
Write-Host "Building Portable version (PaperAquarium-Portable.zip)..."
$portableStaging = Join-Path $distDir "portable_staging\PaperAquarium"
New-Item -ItemType Directory -Path $portableStaging -Force | Out-Null

Copy-Item (Join-Path $rootDir "PaperAquarium.exe") $portableStaging -Force
Copy-Item (Join-Path $rootDir "server.js") $portableStaging -Force
Copy-Item (Join-Path $rootDir "package.json") $portableStaging -Force
Get-ChildItem -Path $rootDir -Filter "*.html" | ForEach-Object {
    Copy-Item $_.FullName $portableStaging -Force
}


$portableRuntime = Join-Path $portableStaging "runtime"
New-Item -ItemType Directory -Path $portableRuntime -Force | Out-Null
Copy-Item $runtimeNode (Join-Path $portableRuntime "node.exe") -Force

Copy-Item (Join-Path $rootDir "assets") $portableStaging -Recurse -Force
Copy-Item (Join-Path $rootDir "demos") $portableStaging -Recurse -Force
Copy-Item (Join-Path $rootDir "vendor") $portableStaging -Recurse -Force

Set-Content -Path (Join-Path $portableStaging "portable.txt") -Value "Paper Aquarium Portable Mode" -Encoding UTF8
$portableData = Join-Path $portableStaging "data\tanks"
New-Item -ItemType Directory -Path $portableData -Force | Out-Null
Set-Content -Path (Join-Path $portableData ".gitkeep") -Value "" -Encoding UTF8

$portableZip = Join-Path $distDir "PaperAquarium-Portable.zip"
Write-Host "Compressing portable archive..."
Compress-Archive -Path "$portableStaging\*" -DestinationPath $portableZip -CompressionLevel Optimal -Force
Remove-Item (Join-Path $distDir "portable_staging") -Recurse -Force

Write-Host ""
Write-Host "================================================="
Write-Host "Build finished successfully!"
Write-Host "Release artifacts in: $distDir"
Get-ChildItem $distDir | ForEach-Object {
    $mb = [Math]::Round($_.Length / 1MB, 2)
    Write-Host ("  - " + $_.Name + " (" + $mb + " MB)")
}
Write-Host "================================================="
