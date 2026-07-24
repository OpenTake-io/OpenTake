# OpenTake MSIX Uninstallation Script
# This script helps uninstall the OpenTake MSIX package from Windows 10/11

param(
    [Parameter(HelpMessage="Force uninstall without confirmation")]
    [switch]$Force,

    [Parameter(HelpMessage="Keep user data after uninstall")]
    [switch]$KeepData
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Check if OpenTake is installed
function Get-OpenTakePackage {
    $package = Get-AppxPackage -Name "OpenTake" -ErrorAction SilentlyContinue
    return $package
}

# Remove OpenTake package
function Remove-OpenTakeMsix {
    param([bool]$KeepUserData)

    Write-Host "🔍 Checking for installed OpenTake package..." -ForegroundColor Cyan

    $package = Get-OpenTakePackage

    if (-not $package) {
        Write-Host "⚠️ OpenTake is not installed" -ForegroundColor Yellow
        return $true
    }

    Write-Host "📋 Found OpenTake version: $($package.Version)" -ForegroundColor Green
    Write-Host "📁 Install location: $($package.InstallLocation)" -ForegroundColor Green

    # Confirm uninstall
    if (-not $Force) {
        Write-Host ""
        Write-Host "⚠️ This will uninstall OpenTake from your system." -ForegroundColor Yellow
        if (-not $KeepUserData) {
            Write-Host "⚠️ User data will be removed." -ForegroundColor Yellow
        }
        Write-Host ""
        $response = Read-Host "Do you want to continue? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Uninstall cancelled" -ForegroundColor Yellow
            return $false
        }
    }

    try {
        Write-Host "🔄 Uninstalling OpenTake..." -ForegroundColor Cyan

        # Remove the package
        $package | Remove-AppxPackage

        Write-Host "✅ OpenTake uninstalled successfully" -ForegroundColor Green

        # Clean up user data if requested
        if (-not $KeepUserData) {
            Write-Host "🧹 Cleaning up user data..." -ForegroundColor Cyan

            $userDataPaths = @(
                "$env:LOCALAPPDATA\OpenTake",
                "$env:APPDATA\OpenTake",
                "$env:LOCALAPPDATA\Packages\OpenTake*"
            )

            foreach ($path in $userDataPaths) {
                if (Test-Path $path) {
                    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
                    Write-Host "  Removed: $path" -ForegroundColor Gray
                }
            }
        }

        # Verify uninstallation
        $remainingPackage = Get-OpenTakePackage
        if ($remainingPackage) {
            Write-Warning "⚠️ Package may still be partially installed. Please restart your computer to complete the uninstallation."
            return $false
        }

        return $true
    }
    catch {
        Write-Error "❌ Failed to uninstall OpenTake: $_"
        return $false
    }
}

# Main uninstallation flow
function Main {
    Write-Host "🗑️ OpenTake MSIX Uninstaller" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Cyan
    Write-Host ""

    # Check if running as administrator (optional but recommended)
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        Write-Host "ℹ️ Running without administrator privileges. Some cleanup operations may be limited." -ForegroundColor Yellow
    }

    # Uninstall the package
    $success = Remove-OpenTakeMsix -KeepUserData $KeepData

    if ($success) {
        Write-Host ""
        Write-Host "🎉 Uninstallation completed successfully!" -ForegroundColor Green

        if (-not $KeepData) {
            Write-Host "All user data has been removed." -ForegroundColor Green
        }
        else {
            Write-Host "User data has been preserved." -ForegroundColor Green
        }

        Write-Host ""
        Write-Host "Thank you for using OpenTake!" -ForegroundColor Cyan
    }
    else {
        Write-Host ""
        Write-Host "❌ Uninstallation failed or was cancelled." -ForegroundColor Red
        exit 1
    }
}

# Run main function
Main
