param([string]$FixtureRoot = (Join-Path $PSScriptRoot '../fixtures/mini-mart'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = [IO.Path]::GetFullPath($FixtureRoot)
$catalog = Get-Content -LiteralPath (Join-Path $taskRoot 'catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force (Join-Path $taskRoot 'images'), (Join-Path $taskRoot 'invoices') | Out-Null
$font = New-Object Drawing.Font('Arial', 22, [Drawing.FontStyle]::Bold)
$small = New-Object Drawing.Font('Arial', 14)
$colors = @('#25856B', '#4B8DCF', '#D9932C', '#B86690', '#8C9B44', '#5774A8')
try {
  for ($i = 0; $i -lt $catalog.Count; $i++) {
    $product = $catalog[$i]
    $bitmap = New-Object Drawing.Bitmap(512, 512)
    $g = [Drawing.Graphics]::FromImage($bitmap)
    $brush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml($colors[[int][Math]::Floor($i / 10)]))
    try {
      $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.Clear([Drawing.Color]::FromArgb(246, 247, 242))
      $group = [int][Math]::Floor($i / 10)
      if ($group -eq 0 -or $group -eq 5) {
        $g.FillRectangle($brush, 170, 110, 170, 270)
        $g.FillRectangle($brush, 210, 60, 90, 65)
        $g.FillRectangle([Drawing.Brushes]::DarkSlateGray, 205, 45, 100, 25)
      } elseif ($group -eq 1) {
        $g.FillRectangle($brush, 155, 100, 200, 285)
        $points = [Drawing.Point[]]@([Drawing.Point]::new(155, 100), [Drawing.Point]::new(200, 55), [Drawing.Point]::new(310, 55), [Drawing.Point]::new(355, 100))
        $g.FillPolygon($brush, $points)
      } else {
        $g.FillRectangle($brush, 125, 95, 260, 285)
        $g.FillRectangle([Drawing.Brushes]::DarkSlateGray, 125, 85, 260, 12)
        $g.FillRectangle([Drawing.Brushes]::DarkSlateGray, 125, 380, 260, 12)
      }
      $g.FillRectangle([Drawing.Brushes]::White, 145, 175, 220, 145)
      $g.DrawString('AN NHIÊN', $font, $brush, 160, 185)
      $g.DrawString(('MẪU {0:00}' -f ($i+1)), $font, $brush, 175, 235)
      $g.DrawString('MINI MART DEMO', $small, [Drawing.Brushes]::DimGray, 167, 285)
      $rect = New-Object Drawing.RectangleF(25, 405, 462, 80)
      $format = New-Object Drawing.StringFormat
      $format.Alignment = [Drawing.StringAlignment]::Center
      $g.DrawString($product.name, $small, [Drawing.Brushes]::Black, $rect, $format)
      $format.Dispose()
      $bitmap.Save((Join-Path $taskRoot ('images/' + $product.id + '.png')), [Drawing.Imaging.ImageFormat]::Png)
    } finally { $brush.Dispose(); $g.Dispose(); $bitmap.Dispose() }
  }
  for ($sheet = 1; $sheet -le 3; $sheet++) {
    $bitmap = New-Object Drawing.Bitmap(1200, 1300)
    $g = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $g.Clear([Drawing.Color]::White)
      $g.DrawString('SIÊU THỊ MINI AN NHIÊN', $font, [Drawing.Brushes]::Black, 65, 60)
      $g.DrawString(('PHIẾU NHẬP MÔ PHỎNG - PN{0:000}' -f $sheet), $font, [Drawing.Brushes]::Black, 65, 115)
      $g.DrawString('Dữ liệu giả dùng thử OCR. Không phải hóa đơn hợp lệ.', $small, [Drawing.Brushes]::DimGray, 65, 170)
      $g.DrawString('Sản phẩm / Mã demo                         ĐVT       Số lượng', $small, [Drawing.Brushes]::Black, 65, 230)
      $answers = @()
      for ($line = 0; $line -lt 6; $line++) {
        $product = $catalog[($sheet-1)*10 + $line]
        $quantity = 6 + 2*$line
        $y = 290 + 130*$line
        $g.DrawString($product.name, $small, [Drawing.Brushes]::Black, 65, $y)
        $g.DrawString(($product.barcode + '                              ' + $product.unit + '              ' + $quantity), $small, [Drawing.Brushes]::Black, 65, ($y+40))
        $answers += @{ productId = $product.id; barcode = $product.barcode; name = $product.name; unit = $product.unit; quantity = $quantity }
      }
      $bitmap.Save((Join-Path $taskRoot ('invoices/invoice-' + $sheet + '.png')), [Drawing.Imaging.ImageFormat]::Png)
      @{ number = ('PN{0:000}' -f $sheet); lines = $answers } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $taskRoot ('invoices/invoice-' + $sheet + '.json'))
    } finally { $g.Dispose(); $bitmap.Dispose() }
  }
} finally { $font.Dispose(); $small.Dispose() }
Write-Output 'Created 60 product PNGs and 3 invoice PNGs with answers.'
