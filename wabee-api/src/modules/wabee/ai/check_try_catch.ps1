
$file = "c:\Users\raul\Desktop\Estadia 11\PROYECTO WABEE\WABEE_V7\core-starter\apps\api\src\modules\wabee\ai\ai.orchestrator.service.ts"
$content = Get-Content $file
$lineNum = 1
$openTries = 0
foreach ($line in $content) {
    if ($line -match "try\s*\{") {
        $openTries++
        Write-Host "Line $lineNum: Open Try (Total: $openTries)"
    }
    if ($line -match "\}\s*catch|finally\s*\{") {
        $openTries--
        Write-Host "Line $lineNum: Close Try (Total: $openTries)"
    }
    $lineNum++
}
Write-Host "Final Try Balance: $openTries"
