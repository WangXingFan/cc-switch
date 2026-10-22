param(
    [Parameter(Mandatory = $true)]
    [string]$MsiPath
)

$ErrorActionPreference = 'Stop'
$msi = Get-Item -LiteralPath $MsiPath
$installer = New-Object -ComObject WindowsInstaller.Installer
$db = $installer.GetType().InvokeMember('OpenDatabase', 'InvokeMethod', $null, $installer, @($msi.FullName, 0))
$view = $db.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $db, @('SELECT `Value` FROM `Property` WHERE `Property`=''REBOOT'''))
$view.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $view, $null) | Out-Null
$record = $view.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $view, $null)
$reboot = if ($null -ne $record) { $record.GetType().InvokeMember('StringData', 'GetProperty', $null, $record, 1) } else { $null }
$view.GetType().InvokeMember('Close', 'InvokeMethod', $null, $view, $null) | Out-Null
if ($reboot -ne 'ReallySuppress') {
    throw "MSI must set REBOOT=ReallySuppress to prevent updates restarting Windows (found: '$reboot')"
}
Write-Host "MSI restart policy: $reboot"

# Ensure the WiX extension fragment was linked, including the separate updater
# and manual-install policies. Merely compiling an unreferenced fragment is not enough.
$closeView = $db.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $db, @('SELECT `WixCloseApplication`, `Target`, `Condition`, `Attributes` FROM `WixCloseApplication`'))
$closeView.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $closeView, $null) | Out-Null
$closePolicies = @{}
while ($null -ne ($closeRecord = $closeView.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $closeView, $null))) {
    $id = $closeRecord.GetType().InvokeMember('StringData', 'GetProperty', $null, $closeRecord, 1)
    $closePolicies[$id] = @{
        Target = $closeRecord.GetType().InvokeMember('StringData', 'GetProperty', $null, $closeRecord, 2)
        Condition = $closeRecord.GetType().InvokeMember('StringData', 'GetProperty', $null, $closeRecord, 3)
        Attributes = $closeRecord.GetType().InvokeMember('IntegerData', 'GetProperty', $null, $closeRecord, 4)
    }
}
$closeView.GetType().InvokeMember('Close', 'InvokeMethod', $null, $closeView, $null) | Out-Null
foreach ($policy in @(
    @{ Id = 'TerminateAppForUpdate'; Condition = 'AUTOLAUNCHAPP'; Attributes = 32 },
    @{ Id = 'CloseAppForInstall'; Condition = 'NOT AUTOLAUNCHAPP'; Attributes = 1 }
)) {
    $actual = $closePolicies[$policy.Id]
    if ($null -eq $actual -or $actual.Target -ne 'cc-switch.exe' -or
        $actual.Condition -ne $policy.Condition -or $actual.Attributes -ne $policy.Attributes) {
        throw "MSI close-application policy is missing or incorrect: $($policy.Id)"
    }
    Write-Host "MSI close-application policy: $($policy.Id)"
}
