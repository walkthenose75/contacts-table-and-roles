import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Search, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  useWebRoles, useWebsites, useCreateWebRole, useUpdateWebRole, useDeleteWebRole, type WebRoleInput,
} from "@/hooks/queries"
import type { Mspp_webroles } from "@/generated/models/Mspp_webrolesModel"

type FormState = {
  mspp_name: string
  mspp_websiteid: string
  mspp_description: string
  mspp_authenticatedusersrole: boolean
  mspp_anonymoususersrole: boolean
}

const emptyForm: FormState = {
  mspp_name: "",
  mspp_websiteid: "",
  mspp_description: "",
  mspp_authenticatedusersrole: false,
  mspp_anonymoususersrole: false,
}

function BoolBadge({ value }: { value?: boolean }) {
  return value ? (
    <Badge variant="secondary"><Check className="size-3" /> Yes</Badge>
  ) : (
    <Badge variant="outline"><X className="size-3" /> No</Badge>
  )
}

export default function WebRolesPage() {
  const { data: roles = [], isLoading, isError, error } = useWebRoles()
  const { data: websites = [] } = useWebsites()
  const createRole = useCreateWebRole()
  const updateRole = useUpdateWebRole()
  const deleteRole = useDeleteWebRole()

  const [search, setSearch] = useState("")
  const [websiteFilter, setWebsiteFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Mspp_webroles | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Mspp_webroles | null>(null)

  const websiteMap = useMemo(
    () => new Map(websites.map((w) => [w.mspp_websiteid, w.mspp_name])),
    [websites]
  )
  const websiteName = (id?: string) => (id ? websiteMap.get(id) : undefined)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return roles.filter((r) => {
      if (websiteFilter !== "all" && r._mspp_websiteid_value !== websiteFilter) return false
      if (!q) return true
      return [r.mspp_name, r.mspp_description, websiteName(r._mspp_websiteid_value)]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    })
  }, [roles, search, websiteFilter, websiteMap])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, mspp_websiteid: websites[0]?.mspp_websiteid ?? "" })
    setDialogOpen(true)
  }

  function openEdit(r: Mspp_webroles) {
    setEditing(r)
    setForm({
      mspp_name: r.mspp_name ?? "",
      mspp_websiteid: r._mspp_websiteid_value ?? "",
      mspp_description: r.mspp_description ?? "",
      mspp_authenticatedusersrole: !!r.mspp_authenticatedusersrole,
      mspp_anonymoususersrole: !!r.mspp_anonymoususersrole,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.mspp_name.trim()) {
      toast.error("Role name is required.")
      return
    }
    if (!form.mspp_websiteid) {
      toast.error("Website is required.")
      return
    }
    try {
      if (editing) {
        await updateRole.mutateAsync({
          id: editing.mspp_webroleid,
          mspp_name: form.mspp_name,
          mspp_description: form.mspp_description || undefined,
          mspp_authenticatedusersrole: form.mspp_authenticatedusersrole,
          mspp_anonymoususersrole: form.mspp_anonymoususersrole,
        })
        toast.success("Web role updated.")
      } else {
        const record: WebRoleInput = {
          mspp_name: form.mspp_name,
          mspp_websiteid: form.mspp_websiteid,
          mspp_description: form.mspp_description || undefined,
          mspp_authenticatedusersrole: form.mspp_authenticatedusersrole,
          mspp_anonymoususersrole: form.mspp_anonymoususersrole,
        }
        await createRole.mutateAsync(record)
        toast.success("Web role created.")
      }
      setDialogOpen(false)
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteRole.mutateAsync(deleteTarget.mspp_webroleid)
      toast.success("Web role deleted.")
      setDeleteTarget(null)
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`)
    }
  }

  const saving = createRole.isPending || updateRole.isPending

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Web roles</h1>
          <p className="text-sm text-muted-foreground">Create and manage Power Pages web roles.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> New web role
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search web roles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Filter by website" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All websites</SelectItem>
            {websites.map((w) => (
              <SelectItem key={w.mspp_websiteid} value={w.mspp_websiteid}>{w.mspp_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Authenticated</TableHead>
              <TableHead>Anonymous</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive py-8">
                  Failed to load web roles: {(error as Error)?.message}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No web roles found.</TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.mspp_webroleid}>
                <TableCell className="font-medium">{r.mspp_name}</TableCell>
                <TableCell>{websiteName(r._mspp_websiteid_value) ?? "—"}</TableCell>
                <TableCell className="max-w-[280px] truncate">{r.mspp_description ?? "—"}</TableCell>
                <TableCell><BoolBadge value={r.mspp_authenticatedusersrole} /></TableCell>
                <TableCell><BoolBadge value={r.mspp_anonymoususersrole} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(r)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit web role" : "New web role"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the web role." : "Create a new Power Pages web role."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="rolename">Name *</Label>
              <Input id="rolename" value={form.mspp_name}
                onChange={(e) => setForm({ ...form, mspp_name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website *</Label>
              <Select
                value={form.mspp_websiteid}
                onValueChange={(v) => setForm({ ...form, mspp_websiteid: v })}
                disabled={!!editing}
              >
                <SelectTrigger id="website">
                  <SelectValue placeholder="Select a website" />
                </SelectTrigger>
                <SelectContent>
                  {websites.map((w) => (
                    <SelectItem key={w.mspp_websiteid} value={w.mspp_websiteid}>{w.mspp_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && (
                <p className="text-xs text-muted-foreground">Website can't be changed after a role is created.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.mspp_description}
                onChange={(e) => setForm({ ...form, mspp_description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="auth" checked={form.mspp_authenticatedusersrole}
                onCheckedChange={(v) => setForm({ ...form, mspp_authenticatedusersrole: !!v })} />
              <Label htmlFor="auth">Authenticated users role</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="anon" checked={form.mspp_anonymoususersrole}
                onCheckedChange={(v) => setForm({ ...form, mspp_anonymoususersrole: !!v })} />
              <Label htmlFor="anon">Anonymous users role</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete web role</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.mspp_name}</span>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRole.isPending}>
              {deleteRole.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
