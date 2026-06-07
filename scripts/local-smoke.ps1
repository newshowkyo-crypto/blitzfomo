param(
  [string]$BaseUrl = "http://localhost:8081",
  [int]$Amount = 25
)

$ErrorActionPreference = "Stop"

function Invoke-Json($Method, $Url, $Body = $null, $Token = $null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $params = @{ Method = $Method; Uri = $Url; Headers = $headers }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
  Invoke-RestMethod @params
}

$address = "0x" + (-join ((1..40) | ForEach-Object { "{0:x}" -f (Get-Random -Minimum 0 -Maximum 16) }))

Write-Host "Smoke target: $BaseUrl"

$nonce = Invoke-Json GET "$BaseUrl/api/auth/nonce?address=$address"
$login = Invoke-Json POST "$BaseUrl/api/auth/verify" @{
  address = $address
  nonce = $nonce.nonce
  signature = "0xsmoke-signature-2026"
}
if (-not $login.token) { throw "Login failed" }

$order = Invoke-Json POST "$BaseUrl/api/payment/create" @{ amountUsdt = $Amount } $login.token
if (-not $order.orderId) { throw "Payment create failed" }

Write-Host "Created order: $($order.orderId) via $($order.gateway)"

Start-Sleep -Seconds 5

$status = Invoke-Json GET "$BaseUrl/api/payment/$($order.orderId)" $null $login.token
Write-Host "Order status: $($status.status)"

if ($order.gateway -eq "mock" -and $status.status -ne "PAID") {
  throw "Mock payment did not become PAID"
}

Write-Host "Smoke OK"
