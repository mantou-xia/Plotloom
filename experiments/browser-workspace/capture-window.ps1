param([long]$WindowHandle, [string]$OutputPath)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SpikeWindowCapture {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
}
'@
# 只捕获本次启动的 Electron 窗口，不截取整个桌面或其他应用。
[void][SpikeWindowCapture]::SetProcessDPIAware()
$spikeRect = New-Object SpikeWindowCapture+RECT
if (-not [SpikeWindowCapture]::GetWindowRect([IntPtr]$WindowHandle, [ref]$spikeRect)) { throw '实验窗口不存在' }
$spikeBitmap = New-Object System.Drawing.Bitmap(($spikeRect.Right - $spikeRect.Left), ($spikeRect.Bottom - $spikeRect.Top))
$spikeGraphics = [System.Drawing.Graphics]::FromImage($spikeBitmap)
$spikeHdc = $spikeGraphics.GetHdc()
try {
  if (-not [SpikeWindowCapture]::PrintWindow([IntPtr]$WindowHandle, $spikeHdc, 2)) { throw '实验窗口截图失败' }
} finally { $spikeGraphics.ReleaseHdc($spikeHdc) }
try { $spikeBitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $spikeGraphics.Dispose(); $spikeBitmap.Dispose() }
