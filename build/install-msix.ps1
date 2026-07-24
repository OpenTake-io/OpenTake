# OpenTake MSIX Installation Script
# This script helps install the OpenTake MSIX package on Windows 10/11

param(
    [Parameter(HelpMessage="Path to the MSIX package file")]
    [string]$PackagePath,

    [Parameter(HelpMessage="Install for current user only (default)")]
    [switch]$UserInstall,

    [Parameter(HelpMessage="Install for all users (requires admin)")]
    [switch]$AllUsers,

    [Parameter(HelpMessage="Force reinstall if already installed")]
    [switch]$Force,

    [Parameter(HelpMessage="Skip dependency installation")]
    [switch]$SkipDependencies
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Check Windows version
function Test-WindowsVersion {
    $version = [System.Environment]::OSVersion.Version
    $build = $version.Build

    if ($build -lt 17763) {
        Write-Error "Windows 10 version 1809 (build 17763) or later is required. Current build: $build"
        return $false
    }

    Write-Host "✅ Windows version compatible (build $build)" -ForegroundColor Green
    return $true
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Install WebView2 runtime if needed
function Install-WebView2 {
    if ($SkipDependencies) {
        Write-Host "⏭️ Skipping dependency installation" -ForegroundColor Yellow
        return
    }

    Write-Host "🔍 Checking for WebView2 runtime..." -ForegroundColor Cyan

    # Check if WebView2 is already installed
    $webView2Path = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-235B8DB51B8F}"
    $userWebView2Path = "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-235B8DB51B8F}"

    if (Test-Path $webView2Path) {
        Write-Host "✅ WebView2 runtime already installed (system)" -ForegroundColor Green
        return
    }

    if (Test-Path $userWebView2Path) {
        Write-Host "✅ WebView2 runtime already installed (user)" -ForegroundColor Green
        return
    }

    Write-Host "📥 Downloading WebView2 runtime installer..." -ForegroundColor Cyan

    # Download WebView2 bootstrapper
    $tempDir = [System.IO.Path]::GetTempPath()
    $webView2Installer = Join-Path $tempDir "MicrosoftEdgeWebview2Setup.exe"

    try {
        Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $webView2Installer -UseBasicParsing

        Write-Host "📦 Installing WebView2 runtime..." -ForegroundColor Cyan
        Start-Process -FilePath $webView2Installer -ArgumentList "/silent", "/install" -Wait -NoNewWindow

        Write-Host "✅ WebView2 runtime installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Warning "⚠️ Failed to install WebView2 runtime: $_"
        Write-Host "Please install WebView2 manually from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/" -ForegroundColor Yellow
    }
    finally {
        # Clean up installer
        if (Test-Path $webView2Installer) {
            Remove-Item $webView2Installer -Force
        }
    }
}

# Install MSIX package
function Install-OpenTakeMsix {
    param([string]$Path)

    Write-Host "📦 Installing OpenTake MSIX package..." -ForegroundColor Cyan

    # Check if package file exists
    if (-not (Test-Path $Path)) {
        Write-Error "Package file not found: $Path"
        return $false
    }

    # Check if already installed
    $package = Get-AppxPackage -Name "OpenTake" -ErrorAction SilentlyContinue
    if ($package -and -not $Force) {
        Write-Host "⚠️ OpenTake is already installed (version $($package.Version))" -ForegroundColor Yellow
        $response = Read-Host "Do you want to reinstall? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Installation cancelled" -ForegroundColor Yellow
            return $false
        }
        Write-Host "🔄 Removing existing installation..." -ForegroundColor Cyan
        Get-AppxPackage -Name "OpenTake" | Remove-AppxPackage
    }

    try {
        # Install the package
        if ($AllUsers) {
            Write-Host "👤 Installing for all users..." -ForegroundColor Cyan
            Add-AppxProvisionedPackage -Online -PackagePath $Path -SkipLicense
        }
        else {
            Write-Host "👤 Installing for current user..." -ForegroundColor Cyan
            Add-AppxPackage -Path $Path
        }

        Write-Host "✅ OpenTake installed successfully!" -ForegroundColor Green

        # Verify installation
        $installedPackage = Get-AppxPackage -Name "OpenTake" -ErrorAction SilentlyContinue
        if ($installedPackage) {
            Write-Host "📋 Installed version: $($installedPackage.Version)" -ForegroundColor Green
            Write-Host "📁 Install location: $($installedPackage.InstallLocation)" -ForegroundColor Green
        }

        return $true
    }
    catch {
        Write-Error "❌ Failed to install MSIX package: $_"
        return $false
    }
}

# Main installation flow
function Main {
    Write-Host "🚀 OpenTake MSIX Installer" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host ""

    # Check Windows version
    if (-not (Test-WindowsVersion)) {
        exit 1
    }

    # Check administrator privileges if needed
    if ($AllUsers -and -not (Test-Administrator)) {
        Write-Error "Administrator privileges required for all-users installation. Please run as administrator."
        exit 1
    }

    # Install dependencies
    Install-WebView2

    # Get package path
    if (-not $PackagePath) {
        # Look for MSIX files in current directory
        $msixFiles = Get-ChildItem -Path "." -Filter "*.msix" | Sort-Object LastWriteTime -Descending

        if ($msixFiles.Count -eq 0) {
            Write-Error "No MSIX files found in current directory. Please specify the package path."
            exit 1
        }

        if ($msixFiles.Count -eq 1) {
            $PackagePath = $msixFiles[0].FullName
        }
        else {
            Write-Host "Multiple MSIX files found:" -ForegroundColor Yellow
            for ($i = 0; $i -lt $msixFiles.Count; $i++) {
                Write-Host "  [$($i + 1)] $($msixFiles[$i].Name)" -ForegroundColor White
            }
            $selection = Read-Host "Select package number (1-$($msixFiles.Count))"
            $PackagePath = $msixFiles[[int]$selection - 1].FullName
        }
    }

    # Install the package
    $success = Install-OpenTakeMsix -Path $PackagePath

    if ($success) {
        Write-Host ""
        Write-Host "🎉 Installation completed successfully!" -ForegroundColor Green
        Write-Host "You can now launch OpenTake from the Start menu." -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "❌ Installation failed. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
}

# Run main function
Main
