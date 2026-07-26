[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "restart", "status", "logs")]
  [string]$Action = "start",

  [ValidateRange(1, 65535)]
  [int]$Port = 3000,

  [ValidatePattern("^[a-zA-Z0-9.:-]+$")]
  [string]$BindAddress = "127.0.0.1",

  [ValidateRange(1, 60)]
  [int]$WaitSeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory ".."))
$statePath = Join-Path $projectRoot ".dev-server.pid"
$stdoutPath = Join-Path $projectRoot ".dev-server.log"
$stderrPath = Join-Path $projectRoot ".dev-server.err.log"
$packagePath = Join-Path $projectRoot "package.json"

function Write-Step {
  param([string]$Message)
  Write-Host "[ProfileWeb] $Message" -ForegroundColor Cyan
}

function Test-Property {
  param(
    [object]$InputObject,
    [string]$Name
  )

  return $null -ne $InputObject -and $InputObject.PSObject.Properties.Name -contains $Name
}

function Read-ServerState {
  if (-not (Test-Path -LiteralPath $statePath)) {
    return $null
  }

  $rawState = (Get-Content -Raw -LiteralPath $statePath).Trim()

  if (-not $rawState) {
    return $null
  }

  if ($rawState -match "^\d+$") {
    return [PSCustomObject]@{
      SchemaVersion = 0
      ProcessId = [int]$rawState
      Legacy = $true
    }
  }

  try {
    return $rawState | ConvertFrom-Json
  }
  catch {
    throw "The state file is invalid: $statePath"
  }
}

function Get-ManagedProcess {
  param([object]$State)

  if ($null -eq $State -or -not (Test-Property $State "ProcessId")) {
    return $null
  }

  $managedProcess = Get-Process -Id ([int]$State.ProcessId) -ErrorAction SilentlyContinue

  if ($null -eq $managedProcess) {
    return $null
  }

  if (-not (Test-Property $State "ProjectRoot") -or
      -not (Test-Property $State "ProcessStartTicks")) {
    return $null
  }

  $recordedRoot = [System.IO.Path]::GetFullPath([string]$State.ProjectRoot)
  $sameRoot = [string]::Equals(
    $recordedRoot.TrimEnd("\"),
    $projectRoot.TrimEnd("\"),
    [System.StringComparison]::OrdinalIgnoreCase
  )

  if (-not $sameRoot) {
    return $null
  }

  try {
    $actualStartTicks = [string]$managedProcess.StartTime.ToUniversalTime().Ticks
  }
  catch {
    return $null
  }

  if ($actualStartTicks -ne [string]$State.ProcessStartTicks) {
    return $null
  }

  return $managedProcess
}

function Remove-StaleState {
  if (Test-Path -LiteralPath $statePath) {
    Remove-Item -LiteralPath $statePath -Force
  }
}

function Test-TcpPort {
  param(
    [string]$Address,
    [int]$TargetPort,
    [int]$TimeoutMilliseconds = 250
  )

  $client = [System.Net.Sockets.TcpClient]::new()

  try {
    $connection = $client.BeginConnect($Address, $TargetPort, $null, $null)

    if (-not $connection.AsyncWaitHandle.WaitOne($TimeoutMilliseconds)) {
      return $false
    }

    $client.EndConnect($connection)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $client.Dispose()
  }
}

function Get-DescendantProcessIds {
  param([int]$RootProcessId)

  $processSnapshot = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
  $descendants = [System.Collections.Generic.List[int]]::new()

  function Add-Children {
    param([int]$ParentProcessId)

    foreach ($child in $processSnapshot | Where-Object {
      [int]$_.ParentProcessId -eq $ParentProcessId
    }) {
      Add-Children -ParentProcessId ([int]$child.ProcessId)
      $descendants.Add([int]$child.ProcessId)
    }
  }

  Add-Children -ParentProcessId $RootProcessId
  return $descendants
}

function Stop-ManagedProcessTree {
  param([System.Diagnostics.Process]$ManagedProcess)

  $rootProcessId = $ManagedProcess.Id
  $descendantIds = @(Get-DescendantProcessIds -RootProcessId $rootProcessId)

  foreach ($descendantId in $descendantIds) {
    Stop-Process -Id $descendantId -Force -ErrorAction SilentlyContinue
  }

  Stop-Process -Id $rootProcessId -Force -ErrorAction SilentlyContinue
}

function Show-RecentLogs {
  $foundLog = $false

  if (Test-Path -LiteralPath $stdoutPath) {
    $foundLog = $true
    Write-Host ""
    Write-Host "----- stdout -----" -ForegroundColor DarkGray
    Get-Content -LiteralPath $stdoutPath -Tail 60
  }

  if (Test-Path -LiteralPath $stderrPath) {
    $errorLines = @(Get-Content -LiteralPath $stderrPath -Tail 60)

    if ($errorLines.Count -gt 0) {
      $foundLog = $true
      Write-Host ""
      Write-Host "----- stderr -----" -ForegroundColor DarkGray
      $errorLines
    }
  }

  if (-not $foundLog) {
    Write-Step "No logs are available yet."
  }
}

function Start-Project {
  if (-not (Test-Path -LiteralPath $packagePath)) {
    throw "package.json was not found in $projectRoot"
  }

  $currentState = Read-ServerState
  $currentProcess = Get-ManagedProcess -State $currentState

  if ($null -ne $currentProcess) {
    $runningPort = if (Test-Property $currentState "Port") {
      [int]$currentState.Port
    } else {
      $Port
    }
    $runningAddress = if (Test-Property $currentState "BindAddress") {
      [string]$currentState.BindAddress
    } else {
      $BindAddress
    }

    Write-Step "Already running (PID $($currentProcess.Id))."
    Write-Host "URL: http://${runningAddress}:$runningPort"
    return
  }

  if ($null -ne $currentState) {
    Remove-StaleState
    Write-Step "Removed a stale server state file."
  }

  if (Test-TcpPort -Address $BindAddress -TargetPort $Port) {
    throw "Port $Port is already in use by a process not managed by this script."
  }

  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue

  if ($null -eq $npmCommand) {
    throw "npm.cmd was not found. Install Node.js and make sure npm is on PATH."
  }

  $shellExecutable = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
  $escapedNpmPath = $npmCommand.Source.Replace("'", "''")
  $escapedAddress = $BindAddress.Replace("'", "''")
  $serverCommand = "& '$escapedNpmPath' run dev -- --hostname '$escapedAddress' --port $Port"
  $encodedCommand = [Convert]::ToBase64String(
    [Text.Encoding]::Unicode.GetBytes($serverCommand)
  )

  Write-Step "Starting the development server..."

  $serverProcess = Start-Process `
    -FilePath $shellExecutable `
    -ArgumentList @(
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      $encodedCommand
    ) `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -WindowStyle Hidden `
    -PassThru

  $serverProcess.Refresh()

  $state = [ordered]@{
    SchemaVersion = 1
    ProcessId = $serverProcess.Id
    ProcessStartTicks = [string]$serverProcess.StartTime.ToUniversalTime().Ticks
    ProjectRoot = $projectRoot
    BindAddress = $BindAddress
    Port = $Port
    StartedAtUtc = [DateTime]::UtcNow.ToString("o")
  }

  $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8

  $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)

  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 350

    $managedProcess = Get-ManagedProcess -State (Read-ServerState)

    if ($null -eq $managedProcess) {
      Remove-StaleState
      Show-RecentLogs
      throw "The development server exited before it became ready."
    }

    if (Test-TcpPort -Address $BindAddress -TargetPort $Port) {
      Write-Step "Development server is ready (PID $($serverProcess.Id))."
      Write-Host "URL: http://${BindAddress}:$Port"
      Write-Host "Logs: $stdoutPath"
      return
    }
  }

  Write-Step "The process is running but the port was not ready within $WaitSeconds seconds."
  Write-Host "Run 'npm run dev:logs' to inspect the output."
}

function Stop-Project {
  $currentState = Read-ServerState

  if ($null -eq $currentState) {
    Write-Step "Already stopped."
    return
  }

  $currentProcess = Get-ManagedProcess -State $currentState

  if ($null -eq $currentProcess) {
    Remove-StaleState
    Write-Step "No verified managed process was running; stale state was removed."
    return
  }

  Write-Step "Stopping the development server (PID $($currentProcess.Id))..."
  Stop-ManagedProcessTree -ManagedProcess $currentProcess
  Remove-StaleState

  $stoppedPort = if (Test-Property $currentState "Port") {
    [int]$currentState.Port
  } else {
    $Port
  }
  $stoppedAddress = if (Test-Property $currentState "BindAddress") {
    [string]$currentState.BindAddress
  } else {
    $BindAddress
  }

  $deadline = [DateTime]::UtcNow.AddSeconds(5)

  while (
    [DateTime]::UtcNow -lt $deadline -and
    (Test-TcpPort -Address $stoppedAddress -TargetPort $stoppedPort)
  ) {
    Start-Sleep -Milliseconds 200
  }

  Write-Step "Stopped."
}

function Show-Status {
  $currentState = Read-ServerState
  $currentProcess = Get-ManagedProcess -State $currentState

  if ($null -eq $currentProcess) {
    if ($null -ne $currentState) {
      Remove-StaleState
      Write-Step "Stopped (stale state cleaned)."
    } else {
      Write-Step "Stopped."
    }
    return
  }

  $runningPort = [int]$currentState.Port
  $runningAddress = [string]$currentState.BindAddress
  $ready = Test-TcpPort -Address $runningAddress -TargetPort $runningPort
  $readiness = if ($ready) { "ready" } else { "starting" }

  Write-Step "Running (PID $($currentProcess.Id), $readiness)."
  Write-Host "URL: http://${runningAddress}:$runningPort"
  Write-Host "Started: $($currentState.StartedAtUtc)"
}

switch ($Action) {
  "start" {
    Start-Project
  }
  "stop" {
    Stop-Project
  }
  "restart" {
    Stop-Project
    Start-Project
  }
  "status" {
    Show-Status
  }
  "logs" {
    Show-RecentLogs
  }
}
