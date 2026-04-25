$ErrorActionPreference = "Stop"

Write-Host "Starting Backend..."
# Run backend in a new window or as a background job
Start-Process -NoNewWindow -FilePath "uv" -ArgumentList "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000", "--reload"

Write-Host "Starting Frontend..."
Set-Location -Path "frontend"
Start-Process -NoNewWindow -FilePath "npm.cmd" -ArgumentList "run", "dev"

Write-Host "Both servers started. Press Ctrl+C to stop (you may need to kill node/python processes manually if running in background)."
while ($true) { Start-Sleep 1 }
