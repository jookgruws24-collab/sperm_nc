$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$baseUrl = 'https://www.nightcrows.com/en/ranking/growth?rankingType=growth&wmsso_sign=check&regionCode=2010&page='
$classMap = @{
  '11' = 'Sword'
  '12' = 'Twin Sword'
  '13' = 'Spear'
  '14' = 'Wand'
  '15' = 'Dagger'
  '21' = 'Bow'
  '22' = 'Crossbow'
  '23' = 'Staff'
  '31' = 'Two-handed Sword'
  '32' = 'Rapier'
}

$all = New-Object System.Collections.Generic.List[object]

for ($page = 1; $page -le 10; $page++) {
  $url = "$baseUrl$page"
  Write-Host "Fetching page $page..."
  $html = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content
  $match = [regex]::Match(
    $html,
    '<script id="__NEXT_DATA__" type="application/json">(?<json>.*?)</script>',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )

  if (-not $match.Success) {
    throw "Could not find __NEXT_DATA__ on page $page"
  }

  $data = $match.Groups['json'].Value | ConvertFrom-Json

  foreach ($item in $data.props.pageProps.rankingListData.items) {
    $typeKey = [string]$item.pcWeaponType
    $delta = $item.deltaRank
    $flucType = if ($null -eq $delta) { 'new' } elseif ($delta -gt 0) { 'up' } elseif ($delta -lt 0) { 'down' } else { 'same' }
    $flucValue = if ($null -eq $delta) { 'NEW' } elseif ($delta -eq 0) { '-' } else { [math]::Abs([int]$delta).ToString() }

    $all.Add([pscustomobject]@{
      ranking = [int]$item.rank
      fluctuationType = $flucType
      fluctuation = $flucValue
      character = [string]$item.CharacterName
      class = if ($classMap.ContainsKey($typeKey)) { $classMap[$typeKey] } else { "Type $typeKey" }
      classCode = [int]$item.pcWeaponType
      server = "$($item.RealmGroupName)/$($item.RealmName)"
      guild = [string]$item.GuildName
      union = [string]$item.GuildUnionName
      region = [string]$item.RegionName
      sourcePage = $page
      maxRankDate = [string]$item.MaxRankDate
    }) | Out-Null
  }
}

[pscustomobject]@{
  source = 'https://www.nightcrows.com/en/ranking/growth?rankingType=growth&wmsso_sign=check&regionCode=2010&page=1-10'
  fetchedAt = (Get-Date).ToString('o')
  total = $all.Count
  items = $all
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root 'ranking-data.json') -Encoding UTF8

Write-Host "Saved $($all.Count) rows to ranking-data.json"
