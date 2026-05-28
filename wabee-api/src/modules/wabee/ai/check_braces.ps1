
$file = "c:\Users\raul\Desktop\Estadia 11\PROYECTO WABEE\WABEE_V7\core-starter\apps\api\src\modules\wabee\ai\ai.orchestrator.service.ts"
$content = Get-Content $file
$open = 0
$lineNum = 1
foreach ($line in $content) {
    $opens = ([regex]::Matches($line, '\{')).Count
    $closes = ([regex]::Matches($line, '\}')).Count
    $open += $opens
    $open -= $closes
    if ($line -match "private|public|async processInbound|async decideAndRespond") {
        Write-Host "$lineNum ($open): $line"
    }
    $lineNum++
}
Write-Host "Final Balance: $open"
