# tools/generate-icon.ps1
# Генератор многослойной иконки приложения (.ico и .png) для Windows и установщика

Add-Type -AssemblyName System.Drawing

$outputIco = Join-Path $PSScriptRoot "..\assets\app-icon.ico"
$outputPng = Join-Path $PSScriptRoot "..\assets\app-icon.png"

$sizes = @(256, 128, 64, 48, 32, 16)
$bitmaps = @()

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $sz, $sz, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Круглая основа (аквариум / капля воды) с глубоким градиентом
    $rect = New-Object System.Drawing.Rectangle 1, 1, ($sz - 3), ($sz - 3)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($rect)

    $brushGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF 0, 0),
        (New-Object System.Drawing.PointF 0, $sz),
        [System.Drawing.Color]::FromArgb(255, 30, 144, 255), # Лазурный верх
        [System.Drawing.Color]::FromArgb(255, 3, 22, 45)      # Глубокий океанический низ
    )
    $g.FillPath($brushGrad, $path)

    # 2. Нежная светящаяся кромка (стекло аквариума)
    $penEdge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 160, 230, 255), [Math]::Max(1.0, $sz * 0.035))
    $g.DrawPath($penEdge, $path)

    # 3. Пузырьки воздуха
    $bubbleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 255, 255, 255))
    $g.FillEllipse($bubbleBrush, ($sz * 0.22), ($sz * 0.28), ($sz * 0.08), ($sz * 0.08))
    $g.FillEllipse($bubbleBrush, ($sz * 0.30), ($sz * 0.18), ($sz * 0.05), ($sz * 0.05))
    $g.FillEllipse($bubbleBrush, ($sz * 0.72), ($sz * 0.32), ($sz * 0.06), ($sz * 0.06))

    # 4. Золотая тропическая рыбка
    # Хвостовой плавник
    $tailPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $tailPath.AddPolygon(@(
        (New-Object System.Drawing.PointF ($sz * 0.35), ($sz * 0.52)),
        (New-Object System.Drawing.PointF ($sz * 0.18), ($sz * 0.36)),
        (New-Object System.Drawing.PointF ($sz * 0.22), ($sz * 0.52)),
        (New-Object System.Drawing.PointF ($sz * 0.18), ($sz * 0.68))
    ))
    $tailBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 140, 0))
    $g.FillPath($tailBrush, $tailPath)

    # Тело рыбки (овал)
    $bodyRect = New-Object System.Drawing.RectangleF ($sz * 0.30), ($sz * 0.38), ($sz * 0.44), ($sz * 0.28)
    $bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF ($sz * 0.3), ($sz * 0.38)),
        (New-Object System.Drawing.PointF ($sz * 0.7), ($sz * 0.66)),
        [System.Drawing.Color]::FromArgb(255, 255, 165, 0),
        [System.Drawing.Color]::FromArgb(255, 255, 80, 0)
    )
    $g.FillEllipse($bodyBrush, $bodyRect)

    # Белая полоска клоуна
    $stripePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 255, 255), [Math]::Max(1.5, $sz * 0.045))
    $g.DrawArc($stripePen, ($sz * 0.44), ($sz * 0.39), ($sz * 0.12), ($sz * 0.26), -75, 150)

    # Глаз рыбки
    $eyeWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $eyeBlack = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
    $g.FillEllipse($eyeWhite, ($sz * 0.62), ($sz * 0.46), ($sz * 0.075), ($sz * 0.075))
    $g.FillEllipse($eyeBlack, ($sz * 0.645), ($sz * 0.48), ($sz * 0.04), ($sz * 0.04))

    # Верхний плавник
    $finPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $finPath.AddPolygon(@(
        (New-Object System.Drawing.PointF ($sz * 0.42), ($sz * 0.39)),
        (New-Object System.Drawing.PointF ($sz * 0.50), ($sz * 0.28)),
        (New-Object System.Drawing.PointF ($sz * 0.58), ($sz * 0.40))
    ))
    $finBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 130, 0))
    $g.FillPath($finBrush, $finPath)

    # Блик света на аквариуме (стеклянная глубина)
    $glarePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glarePath.AddArc(($sz * 0.1), ($sz * 0.08), ($sz * 0.8), ($sz * 0.4), 195, 130)
    $glarePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), [Math]::Max(1.0, $sz * 0.03))
    $g.DrawPath($glarePen, $glarePath)

    $g.Dispose()
    $bitmaps += $bmp

    if ($sz -eq 256) {
        $bmp.Save($outputPng, [System.Drawing.Imaging.ImageFormat]::Png)
    }
}

# Запись бинарного .ICO формата со всеми разрешениями
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms

# ICONDIR Header
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type (1 = ICO)
$bw.Write([uint16]$bitmaps.Count) # Image count

$pngDataList = @()
foreach ($bmp in $bitmaps) {
    $pngStream = New-Object System.IO.MemoryStream
    $bmp.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngDataList += ,$pngStream.ToArray()
}

$offset = 6 + ($bitmaps.Count * 16)

for ($i = 0; $i -lt $bitmaps.Count; $i++) {
    $sz = $sizes[$i]
    $data = $pngDataList[$i]

    $w = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { 0 } else { [byte]$sz }

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)   # Color count
    $bw.Write([byte]0)   # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32) # Bits per pixel
    $bw.Write([uint32]$data.Length)
    $bw.Write([uint32]$offset)

    $offset += $data.Length
}

foreach ($data in $pngDataList) {
    $bw.Write($data)
}

$bw.Flush()
[System.IO.File]::WriteAllBytes($outputIco, $ms.ToArray())
$bw.Close()
$ms.Close()

Write-Host "Icons generated successfully:"
Write-Host "  ICO: $outputIco"
Write-Host "  PNG: $outputPng"
