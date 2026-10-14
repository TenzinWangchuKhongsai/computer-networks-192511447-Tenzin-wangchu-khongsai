# Smart Office IoT Platform - Windows Startup Setup
# Run this script as Administrator to configure auto-start on Windows boot
#
# Usage:
#   Install:  .\setup-windows-startup.ps1 -Action install
#   Remove:   .\setup-windows-startup.ps1 -Action remove
#   Status:   .\setup-windows-startup.ps1 -Action status

param(
    [string]$Action = 'install'
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = 'SmartOffice-IoT-Controller'
$BackendDir = Join-Path $ScriptDir 'backend'
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  Smart Office IoT - Startup Manager    ' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

if (-not $NodeExe) {
    Write-Host '[ERROR] Node.js not found. Install Node.js from https://nodejs.org first.' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

Write-Host "[INFO] Node.js: $NodeExe" -ForegroundColor Green
Write-Host "[INFO] Backend: $BackendDir" -ForegroundColor Green
Write-Host ''

if ($Action -eq 'install') {
    Write-Host '[INFO] Creating Windows Task Scheduler entry...' -ForegroundColor Yellow
    
    $StartScript = Join-Path $BackendDir 'src\server.js'
    
    $TaskAction = New-ScheduledTaskAction `
        -Execute $NodeExe `
        -Argument $StartScript `
        -WorkingDirectory $BackendDir
    
    $TaskTrigger = New-ScheduledTaskTrigger -AtStartup
    
    $TaskSettings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1)
    
    $TaskPrincipal = New-ScheduledTaskPrincipal `
        -UserId $env:USERNAME `
        -LogonType Interactive `
        -RunLevel Highest
    
    # Remove existing task if present
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $TaskAction `
        -Trigger $TaskTrigger `
        -Settings $TaskSettings `
        -Principal $TaskPrincipal `
        -Description 'Smart Office IoT Background Controller'
    
    Write-Host ''
    Write-Host '[SUCCESS] Task Scheduler entry created!' -ForegroundColor Green
    Write-Host "  Task:    $TaskName" -ForegroundColor Green
    Write-Host '  Trigger: At system startup' -ForegroundColor Green
    Write-Host '  Action:  Start Node.js backend server' -ForegroundColor Green
    Write-Host ''
    Write-Host 'After next reboot:' -ForegroundColor Cyan
    Write-Host '  Backend auto-starts -> CCTV monitoring -> Automation active' -ForegroundColor Cyan
    Write-Host '  Access dashboard: http://localhost:5173 (after starting frontend manually)' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '[NOTE] Frontend (Vite) still needs manual start for development.' -ForegroundColor Yellow
    Write-Host '       For production deployment, build the frontend first:' -ForegroundColor Yellow
    Write-Host '       cd frontend && npm run build' -ForegroundColor Yellow
    
} elseif ($Action -eq 'remove') {
    Write-Host '[INFO] Removing Windows Task Scheduler entry...' -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host '[SUCCESS] Task removed. Smart Office will no longer auto-start.' -ForegroundColor Green
    
} elseif ($Action -eq 'status') {
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($Task) {
        Write-Host "[STATUS] Task '$TaskName' exists" -ForegroundColor Green
        Write-Host "  State: $($Task.State)" -ForegroundColor Green
        $Info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "  Last Run: $($Info.LastRunTime)" -ForegroundColor Green
        Write-Host "  Last Result: $($Info.LastTaskResult)" -ForegroundColor Green
    } else {
        Write-Host '[STATUS] Task not installed' -ForegroundColor Yellow
        Write-Host "  Run with -Action install to set up auto-start" -ForegroundColor Yellow
    }
}

Write-Host ''
Read-Host 'Press Enter to close'
