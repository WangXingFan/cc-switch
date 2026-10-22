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
