$ErrorActionPreference = 'Stop'
$org = if ($env:DATAVERSE_ORG_URL) { $env:DATAVERSE_ORG_URL } else { 'https://YOUR_ORG.crm.dynamics.com' }
$base = "$org/api/data/v9.2"
$token = az account get-access-token --resource $org --query accessToken -o tsv
$H = @{ Authorization = "Bearer $token"; 'OData-MaxVersion'='4.0'; 'OData-Version'='4.0'; Accept='application/json' }
$Hw = $H + @{ 'Content-Type'='application/json'; Prefer='return=representation' }

$results = New-Object System.Collections.ArrayList
function Rec($area,$op,$ok,$detail){
  $status = if($ok){'PASS'}else{'FAIL'}
  [void]$results.Add([pscustomobject]@{Area=$area;Op=$op;Result=$status;Detail=$detail})
  Write-Host ("[{0}] {1} / {2} - {3}" -f $status,$area,$op,$detail)
}

$contactId = $null; $roleId = $null

try {
  # ============ WEBSITE (lookup source) ============
  $sitesUrl = "$base/mspp_websites?`$select=mspp_websiteid,mspp_name&`$top=1"
  $site = (Invoke-RestMethod -Uri $sitesUrl -Headers $H).value | Select-Object -First 1
  if($site){ Rec 'Website' 'READ' $true "using '$($site.mspp_name)' ($($site.mspp_websiteid))" }
  else { Rec 'Website' 'READ' $false 'no websites found'; throw 'no website' }
  $wid = $site.mspp_websiteid

  # ============ CONTACT CRUD (mirrors ContactsService) ============
  $cbody = @{ lastname='CRUDTest'; firstname='Alpha'; emailaddress1='alpha.crudtest@example.com'; telephone1='555-0100'; jobtitle='QA Bot' } | ConvertTo-Json
  $c = Invoke-RestMethod -Uri "$base/contacts" -Method Post -Headers $Hw -Body $cbody
  $contactId = $c.contactid
  Rec 'Contact' 'CREATE' ([bool]$contactId) "id=$contactId fullname='$($c.fullname)'"

  $cget = Invoke-RestMethod -Uri "$base/contacts($contactId)?`$select=contactid,firstname,lastname,fullname,emailaddress1,telephone1,jobtitle" -Headers $H
  Rec 'Contact' 'READ (get)' ($cget.emailaddress1 -eq 'alpha.crudtest@example.com') "email=$($cget.emailaddress1) job=$($cget.jobtitle)"

  $clist = (Invoke-RestMethod -Uri "$base/contacts?`$select=contactid,fullname&`$filter=contactid eq $contactId" -Headers $H).value
  Rec 'Contact' 'READ (list/filter)' ($clist.Count -eq 1) "returned $($clist.Count) row(s)"

  $ubody = @{ firstname='Beta'; jobtitle='QA Lead'; telephone1='555-0199' } | ConvertTo-Json
  $cu = Invoke-RestMethod -Uri "$base/contacts($contactId)" -Method Patch -Headers $Hw -Body $ubody
  Rec 'Contact' 'UPDATE' ($cu.firstname -eq 'Beta' -and $cu.jobtitle -eq 'QA Lead') "firstname=$($cu.firstname) job=$($cu.jobtitle)"

  # ============ WEB ROLE CRUD (mirrors Mspp_webrolesService + app payload incl statecode:0) ============
  $rbody = @{
    mspp_name = 'CRUDTest Role'
    'mspp_websiteid@odata.bind' = "/mspp_websites($wid)"
    mspp_description = 'created by CRUD test'
    mspp_authenticatedusersrole = $true
    mspp_anonymoususersrole = $false
    statecode = 0
  } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri "$base/mspp_webroles" -Method Post -Headers $Hw -Body $rbody
    $roleId = $r.mspp_webroleid
    Rec 'WebRole' 'CREATE (app payload w/ statecode:0)' ([bool]$roleId) "id=$roleId name='$($r.mspp_name)' auth=$($r.mspp_authenticatedusersrole)"
  } catch {
    Rec 'WebRole' 'CREATE (app payload w/ statecode:0)' $false ($_.ErrorDetails.Message)
    # retry WITHOUT statecode to see if that is the culprit
    $rbody2 = @{ mspp_name='CRUDTest Role'; 'mspp_websiteid@odata.bind'="/mspp_websites($wid)"; mspp_description='created by CRUD test'; mspp_authenticatedusersrole=$true; mspp_anonymoususersrole=$false } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$base/mspp_webroles" -Method Post -Headers $Hw -Body $rbody2
    $roleId = $r.mspp_webroleid
    Rec 'WebRole' 'CREATE (retry WITHOUT statecode)' ([bool]$roleId) "id=$roleId - statecode:0 is the bug"
  }

  $rget = Invoke-RestMethod -Uri "$base/mspp_webroles($roleId)?`$select=mspp_webroleid,mspp_name,mspp_description,mspp_authenticatedusersrole,mspp_anonymoususersrole,_mspp_websiteid_value" -Headers $H
  Rec 'WebRole' 'READ (get, no formatted name)' ($rget._mspp_websiteid_value -eq $wid) "website=$($rget._mspp_websiteid_value) desc='$($rget.mspp_description)'"

  # list with the EXACT select the app uses
  $rlist = (Invoke-RestMethod -Uri "$base/mspp_webroles?`$select=mspp_webroleid,mspp_name,mspp_description,mspp_authenticatedusersrole,mspp_anonymoususersrole,_mspp_websiteid_value&`$filter=mspp_webroleid eq $roleId" -Headers $H).value
  Rec 'WebRole' 'READ (list, app select)' ($rlist.Count -eq 1) "returned $($rlist.Count) row(s)"

  # website filter parity (client filters by _mspp_websiteid_value)
  $rfilter = (Invoke-RestMethod -Uri "$base/mspp_webroles?`$select=mspp_webroleid&`$filter=_mspp_websiteid_value eq $wid" -Headers $H).value
  Rec 'WebRole' 'FILTER by website' ($rfilter.Count -ge 1) "$($rfilter.Count) role(s) on this website"

  # UPDATE via powerpagecomponent (mirrors the app's fixed update path)
  try {
    $ppcCur = Invoke-RestMethod -Uri "$base/powerpagecomponents($roleId)?`$select=content,name" -Headers $H
    $cobj = @{}
    if($ppcCur.content){ try { $cobj = $ppcCur.content | ConvertFrom-Json -AsHashtable } catch { $cobj = @{} } }
    $cobj['authenticatedusersrole'] = $false
    $cobj['anonymoususersrole'] = $true
    $cobj['description'] = 'updated by CRUD test'
    $rubody = @{ name='CRUDTest Role EDITED'; content=($cobj | ConvertTo-Json -Compress) } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/powerpagecomponents($roleId)" -Method Patch -Headers $Hw -Body $rubody | Out-Null
    Start-Sleep -Seconds 1
    $ru = Invoke-RestMethod -Uri "$base/mspp_webroles($roleId)?`$select=mspp_name,mspp_anonymoususersrole,mspp_authenticatedusersrole,mspp_description" -Headers $H
    $ok = ($ru.mspp_name -eq 'CRUDTest Role EDITED' -and $ru.mspp_anonymoususersrole -eq $true -and $ru.mspp_authenticatedusersrole -eq $false)
    Rec 'WebRole' 'UPDATE (via powerpagecomponent)' $ok "name='$($ru.mspp_name)' anon=$($ru.mspp_anonymoususersrole) auth=$($ru.mspp_authenticatedusersrole) desc='$($ru.mspp_description)'"
  } catch { Rec 'WebRole' 'UPDATE (via powerpagecomponent)' $false ($_.ErrorDetails.Message) }

  # ============ N:N ASSIGNMENT (mirrors connector Associate/Disassociate) ============
  # confirm the web role has a matching powerpagecomponent (shared GUID)
  try { $ppc = Invoke-RestMethod -Uri "$base/powerpagecomponents($roleId)?`$select=powerpagecomponentid" -Headers $H
        Rec 'Assign' 'powerpagecomponent exists for new role' ($ppc.powerpagecomponentid -eq $roleId) "ppc id=$($ppc.powerpagecomponentid)" }
  catch { Rec 'Assign' 'powerpagecomponent exists for new role' $false ($_.ErrorDetails.Message) }

  # ASSOCIATE (Relate rows): POST $ref on contact's nav property
  try {
    $assocBody = @{ '@odata.id' = "$base/powerpagecomponents($roleId)" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/contacts($contactId)/powerpagecomponent_mspp_webrole_contact/`$ref" -Method Post -Headers $Hw -Body $assocBody | Out-Null
    Rec 'Assign' 'ASSOCIATE (relate)' $true 'POST $ref returned success'
  } catch { Rec 'Assign' 'ASSOCIATE (relate)' $false ($_.ErrorDetails.Message) }

  # READ intersect (mirrors Powerpagecomponent_mspp_webrole_contactsetService.getAll filter contactid)
  try {
    $inter = (Invoke-RestMethod -Uri "$base/powerpagecomponent_mspp_webrole_contactset?`$select=powerpagecomponentid,contactid&`$filter=contactid eq $contactId" -Headers $H).value
    $found = $inter | Where-Object { $_.powerpagecomponentid -eq $roleId }
    Rec 'Assign' 'READ intersect (contact roles)' ([bool]$found) "intersect rows=$($inter.Count), contains role=$([bool]$found)"
  } catch { Rec 'Assign' 'READ intersect (contact roles)' $false ($_.ErrorDetails.Message) }

  # DISASSOCIATE (Unrelate rows)
  try {
    Invoke-RestMethod -Uri "$base/contacts($contactId)/powerpagecomponent_mspp_webrole_contact($roleId)/`$ref" -Method Delete -Headers $H | Out-Null
    Rec 'Assign' 'DISASSOCIATE (unrelate)' $true 'DELETE $ref returned success'
  } catch { Rec 'Assign' 'DISASSOCIATE (unrelate)' $false ($_.ErrorDetails.Message) }

  try {
    $inter2 = (Invoke-RestMethod -Uri "$base/powerpagecomponent_mspp_webrole_contactset?`$select=powerpagecomponentid&`$filter=contactid eq $contactId" -Headers $H).value
    $still = $inter2 | Where-Object { $_.powerpagecomponentid -eq $roleId }
    Rec 'Assign' 'VERIFY unassigned' (-not $still) "role still present=$([bool]$still)"
  } catch { Rec 'Assign' 'VERIFY unassigned' $false ($_.ErrorDetails.Message) }
}
finally {
  # ============ CLEANUP / DELETE ============
  if($roleId){
    try { Invoke-RestMethod -Uri "$base/mspp_webroles($roleId)" -Method Delete -Headers $H | Out-Null
          $gone = $false; try { Invoke-RestMethod -Uri "$base/mspp_webroles($roleId)" -Headers $H | Out-Null } catch { $gone = $true }
          Rec 'WebRole' 'DELETE' $gone "deleted id=$roleId verified-gone=$gone" }
    catch { Rec 'WebRole' 'DELETE' $false ($_.ErrorDetails.Message) }
  }
  if($contactId){
    try { Invoke-RestMethod -Uri "$base/contacts($contactId)" -Method Delete -Headers $H | Out-Null
          $gone = $false; try { Invoke-RestMethod -Uri "$base/contacts($contactId)" -Headers $H | Out-Null } catch { $gone = $true }
          Rec 'Contact' 'DELETE' $gone "deleted id=$contactId verified-gone=$gone" }
    catch { Rec 'Contact' 'DELETE' $false ($_.ErrorDetails.Message) }
  }

  Write-Host "`n================ RESULTS ================"
  $results | Format-Table -AutoSize
  $fail = ($results | Where-Object Result -eq 'FAIL').Count
  $pass = ($results | Where-Object Result -eq 'PASS').Count
  Write-Host ("TOTAL: {0} PASS, {1} FAIL" -f $pass,$fail)
  $results | ConvertTo-Json | Set-Content -Path "$PSScriptRoot\crud-test-results.json"
}
