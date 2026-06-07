# start-demo.ps1
# Blitz Finale World Cup 2026 Edition - One-click Demo Launcher (Windows)

Write-Host ""
Write-Host "Blitz Finale - World Cup 2026 Edition" -ForegroundColor Cyan
Write-Host "Product Demo Launcher" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
try {
    docker --version | Out-Null
} catch {
    Write-Host "ERROR: Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# Check if Docker daemon is running
try {
    docker info | Out-Null
} catch {
    Write-Host "ERROR: Docker Desktop is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop and wait until it says 'Engine is running'." -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker is running. Good." -ForegroundColor Green

# Ensure .env exists
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env -Force
        Write-Host "Created .env from .env.example" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: No .env file found. Using defaults." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Starting all services (this may take 3-8 minutes on first run)..." -ForegroundColor Yellow
Write-Host ""

docker compose down --remove-orphans 2>$null
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to start services." -ForegroundColor Red
    Write-Host "Check logs with: docker compose logs -f" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Services are starting..." -ForegroundColor Green
Write-Host "Waiting 25 seconds for initialization (database migration + seed)..." -ForegroundColor Yellow

Start-Sleep -Seconds 25

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Demo is ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open your browser and visit:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Main Demo Page:     http://localhost:8081" -ForegroundColor White
Write-Host ""
Write-Host "  Direct Game:        http://localhost:8081/stitch_blitz_finale_world_cup_edition/blitz_finale_world_cup_2026_edition/code.html" -ForegroundColor Gray
Write-Host ""
Write-Host "  Admin Dashboard:    http://localhost:8081/admin" -ForegroundColor White
Write-Host "  Admin Login:        super_admin / Admin@2026!" -ForegroundColor Gray
Write-Host ""
Write-Host "Tips:" -ForegroundColor Yellow
Write-Host "  - First load may take 30-60 seconds" -ForegroundColor Gray
Write-Host "  - The game uses demo auto-login (no wallet needed)" -ForegroundColor Gray
Write-Host "  - Check logs anytime: docker compose logs -f api" -ForegroundColor Gray
Write-Host "  - Stop everything: docker compose down" -ForegroundColor Gray
Write-Host ""
Write-Host "Enjoy the demo!" -ForegroundColor Green
Write-Host ""
