# Google Cloud Setup Helper
# Run this script to open the necessary Google Cloud Console pages

$project = "pon-app-final"

Write-Host "=== Google Cloud Vertex AI Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening browser tabs to enable APIs and set permissions..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Step 1: Enable Vertex AI API" -ForegroundColor Green
Start-Process "https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=$project"
Start-Sleep -Seconds 2

Write-Host "Step 2: Enable Generative Language API" -ForegroundColor Green
Start-Process "https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=$project"
Start-Sleep -Seconds 2

Write-Host "Step 3: Configure IAM Permissions" -ForegroundColor Green
Start-Process "https://console.cloud.google.com/iam-admin/iam?project=$project"
Start-Sleep -Seconds 2

Write-Host "" 
Write-Host "✅ Browser tabs opened!" -ForegroundColor Cyan
Write-Host ""
Write-Host "For each tab:" -ForegroundColor Yellow
Write-Host "  1. Click the ENABLE button (for API pages)"
Write-Host "  2. For IAM page: Find your service account → Edit → Add role 'Vertex AI User'"
Write-Host ""
Write-Host "After enabling, wait 1-2 minutes, then run:" -ForegroundColor Cyan
Write-Host "  node test-vertex-ai.cjs" -ForegroundColor White
Write-Host ""
