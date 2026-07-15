import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Check, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  useContact, useWebRoles, useWebsites, useContactRoleIds, useAssignRole, useUnassignRole,
} from "@/hooks/queries"

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: contact, isLoading: loadingContact } = useContact(id)
  const { data: roles = [], isLoading: loadingRoles } = useWebRoles()
  const { data: websites = [] } = useWebsites()
  const { data: assignedIds, isLoading: loadingAssigned } = useContactRoleIds(id)
  const assignRole = useAssignRole()
  const unassignRole = useUnassignRole()

  const websiteName = useMemo(() => {
    const m = new Map(websites.map((w) => [w.mspp_websiteid, w.mspp_name]))
    return (rid?: string) => (rid ? m.get(rid) : undefined)
  }, [websites])

  const assigned = useMemo(
    () => roles.filter((r) => assignedIds?.has(r.mspp_webroleid)),
    [roles, assignedIds]
  )
  const available = useMemo(
    () => roles.filter((r) => !assignedIds?.has(r.mspp_webroleid)),
    [roles, assignedIds]
  )

  async function handleAssign(roleId: string) {
    if (!id) return
    try {
      await assignRole.mutateAsync({ contactId: id, roleId })
      toast.success("Role assigned.")
    } catch (e) {
      toast.error(`Assign failed: ${(e as Error).message}`)
    }
  }

  async function handleUnassign(roleId: string) {
    if (!id) return
    try {
      await unassignRole.mutateAsync({ contactId: id, roleId })
      toast.success("Role removed.")
    } catch (e) {
      toast.error(`Remove failed: ${(e as Error).message}`)
    }
  }

  const busyId = (assignRole.isPending && assignRole.variables?.roleId)
    || (unassignRole.isPending && unassignRole.variables?.roleId)
    || null

  const displayName = contact?.fullname
    || [contact?.firstname, contact?.lastname].filter(Boolean).join(" ")
    || "(no name)"

  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/contacts"><ArrowLeft className="size-4" /> Back to contacts</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{loadingContact ? "Loading…" : displayName}</h1>
        {contact?.emailaddress1 && (
          <p className="text-sm text-muted-foreground">{contact.emailaddress1}</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assigned roles */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned web roles</CardTitle>
            <CardDescription>Roles currently granted to this contact.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loadingRoles || loadingAssigned) && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loadingAssigned && assigned.length === 0 && (
              <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
            )}
            {assigned.map((r) => (
              <div key={r.mspp_webroleid} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {r.mspp_name}
                    {r.mspp_authenticatedusersrole && <Badge variant="secondary" className="text-xs">Auth</Badge>}
                    {r.mspp_anonymoususersrole && <Badge variant="outline" className="text-xs">Anon</Badge>}
                  </div>
                  {websiteName(r._mspp_websiteid_value) && (
                    <div className="text-xs text-muted-foreground truncate">{websiteName(r._mspp_websiteid_value)}</div>
                  )}
                </div>
                <Button
                  variant="outline" size="sm"
                  disabled={busyId === r.mspp_webroleid}
                  onClick={() => handleUnassign(r.mspp_webroleid)}
                >
                  {busyId === r.mspp_webroleid ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Available roles */}
        <Card>
          <CardHeader>
            <CardTitle>Available web roles</CardTitle>
            <CardDescription>Assign additional roles to this contact.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loadingRoles || loadingAssigned) && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loadingRoles && !loadingAssigned && available.length === 0 && (
              <p className="text-sm text-muted-foreground">All roles are assigned.</p>
            )}
            {available.map((r) => (
              <div key={r.mspp_webroleid} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.mspp_name}</div>
                  {websiteName(r._mspp_websiteid_value) && (
                    <div className="text-xs text-muted-foreground truncate">{websiteName(r._mspp_websiteid_value)}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={busyId === r.mspp_webroleid}
                  onClick={() => handleAssign(r.mspp_webroleid)}
                >
                  {busyId === r.mspp_webroleid
                    ? <Loader2 className="size-4 animate-spin" />
                    : <><Plus className="size-4" /> Assign</>}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Check className="size-3" /> Role changes are written directly to Dataverse via the Relate/Unrelate action.
      </p>
    </div>
  )
}
