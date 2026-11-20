# =========================================================
#  Zingify - automatic playlist builder (Windows)
#  Scans the "songs" folder and writes js/my-songs.js
#  Run it by double-clicking update-playlist.bat
# =========================================================

$ErrorActionPreference = 'Stop'

$root     = Split-Path -Parent $PSScriptRoot
$songsDir = Join-Path $root 'songs'
$outFile  = Join-Path $root 'js\my-songs.js'
$exts     = @('.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac', '.opus')

if (-not (Test-Path -LiteralPath $songsDir)) {
    New-Item -ItemType Directory -Path $songsDir | Out-Null
}

$files = @(Get-ChildItem -LiteralPath $songsDir -File |
           Where-Object { $exts -contains $_.Extension.ToLower() } |
           Sort-Object Name)

# --- Read title / artist / album saved inside the files (via Windows) ---
$folder = $null
$cols   = @{}
try {
    $shell  = New-Object -ComObject Shell.Application
    $folder = $shell.Namespace($songsDir)
    for ($i = 0; $i -lt 350; $i++) {
        $name = $folder.GetDetailsOf($null, $i)
        if ($name -and -not $cols.ContainsKey($name)) { $cols[$name] = $i }
    }
} catch { $folder = $null }

function Get-Meta([string]$fileName, [string[]]$columnNames) {
    if (-not $folder) { return '' }
    foreach ($col in $columnNames) {
        if ($cols.ContainsKey($col)) {
            $item = $folder.ParseName($fileName)
            if ($item) {
                $v = [string]$folder.GetDetailsOf($item, $cols[$col])
                $v = ($v -replace '[\u200e\u200f\u202a-\u202e]', '').Trim()
                if ($v) { return $v }
            }
        }
    }
    return ''
}

# --- Build the list ---
$list = New-Object System.Collections.Generic.List[object]
$n = 0
foreach ($f in $files) {
    $title  = Get-Meta $f.Name @('Title')
    $artist = Get-Meta $f.Name @('Contributing artists', 'Artists', 'Album artist', 'Authors')
    $album  = Get-Meta $f.Name @('Album')

    if (-not $title) { $title = [IO.Path]::GetFileNameWithoutExtension($f.Name) }
    if (-not $artist) { $artist = 'Unknown artist' }

    $list.Add([pscustomobject][ordered]@{
        title  = $title
        artist = $artist
        album  = $album
        file   = $f.Name
        source = ''
        hue    = 170 + (($n * 37) % 180)
    })
    $n++
}

if ($list.Count -gt 0) {
    $json = ConvertTo-Json -InputObject @($list.ToArray()) -Depth 3
} else {
    $json = '[]'
}

$content = @"
/* =========================================================
   Zingify - songs found in the "songs" folder
   Created automatically by update-playlist.bat on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
   Don't edit this file by hand: add or remove music files
   in the songs folder and run update-playlist.bat again.
   ========================================================= */

window.AUTO_SONGS = $json;
"@

[IO.File]::WriteAllText($outFile, $content, (New-Object Text.UTF8Encoding $false))

Write-Host ''
Write-Host "  Zingify playlist updated: $($list.Count) song(s) found." -ForegroundColor Green
foreach ($s in $list) { Write-Host "   - $($s.title)  |  $($s.artist)" }
Write-Host ''
Write-Host '  Refresh the player in your browser to see them.'
Write-Host ''
