[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
$handle = $null
try {
    # 同一写句柄内比较和提交，FileShare.Read 禁止并发写入、删除和原子替换。
    $mode = if ($null -eq $inputData.expected) { [IO.FileMode]::CreateNew } else { [IO.FileMode]::Open }
    $handle = [IO.File]::Open([string]$inputData.path, [IO.FileMode]$mode, [IO.FileAccess]::ReadWrite, [IO.FileShare]::Read)
    $bytes = New-Object byte[] $handle.Length
    $offset = 0
    while ($offset -lt $bytes.Length) {
        $read = $handle.Read($bytes, $offset, $bytes.Length - $offset)
        if ($read -eq 0) { throw 'Incomplete read' }
        $offset += $read
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $actual = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    if ($null -ne $inputData.expected -and $actual -ne $inputData.expected) {
        @{ status = 'conflict' } | ConvertTo-Json -Compress
    } else {
        $next = $utf8.GetBytes($inputData.content)
        $handle.Position = 0
        $handle.Write($next, 0, $next.Length)
        $handle.SetLength($next.Length)
        $handle.Flush($true)
        @{ status = 'ok' } | ConvertTo-Json -Compress
    }
} catch [IO.IOException] {
    # 有句柄说明可能已经开始写入，保留 journal；没有句柄则确认未改稿。
    @{ status = $(if ($null -eq $handle) { 'busy' } else { 'uncertain' }) } | ConvertTo-Json -Compress
} catch {
    @{ status = $(if ($null -eq $handle) { 'denied' } else { 'uncertain' }) } | ConvertTo-Json -Compress
} finally {
    if ($null -ne $handle) { $handle.Dispose() }
}
