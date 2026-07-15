import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Search, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact, type ContactInput,
} from "@/hooks/queries"
import type { Contacts } from "@/generated/models/ContactsModel"

type FormState = {
  firstname: string
  lastname: string
  emailaddress1: string
  telephone1: string
  jobtitle: string
}

const emptyForm: FormState = { firstname: "", lastname: "", emailaddress1: "", telephone1: "", jobtitle: "" }

export default function ContactsPage() {
  const { data: contacts = [], isLoading, isError, error } = useContacts()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Contacts | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Contacts | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      [c.fullname, c.firstname, c.lastname, c.emailaddress1, c.jobtitle]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    )
  }, [contacts, search])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(c: Contacts) {
    setEditing(c)
    setForm({
      firstname: c.firstname ?? "",
      lastname: c.lastname ?? "",
      emailaddress1: c.emailaddress1 ?? "",
      telephone1: c.telephone1 ?? "",
      jobtitle: c.jobtitle ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.lastname.trim()) {
      toast.error("Last name is required.")
      return
    }
    try {
      if (editing) {
        await updateContact.mutateAsync({
          id: editing.contactid,
          changes: {
            firstname: form.firstname || undefined,
            lastname: form.lastname,
            emailaddress1: form.emailaddress1 || undefined,
            telephone1: form.telephone1 || undefined,
            jobtitle: form.jobtitle || undefined,
          },
        })
        toast.success("Contact updated.")
      } else {
        const record: ContactInput = {
          lastname: form.lastname,
          firstname: form.firstname || undefined,
          emailaddress1: form.emailaddress1 || undefined,
          telephone1: form.telephone1 || undefined,
          jobtitle: form.jobtitle || undefined,
        }
        await createContact.mutateAsync(record)
        toast.success("Contact created.")
      }
      setDialogOpen(false)
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteContact.mutateAsync(deleteTarget.contactid)
      toast.success("Contact deleted.")
      setDeleteTarget(null)
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`)
    }
  }

  const saving = createContact.isPending || updateContact.isPending

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage contacts and their web roles.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> New contact
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive py-8">
                  Failed to load contacts: {(error as Error)?.message}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No contacts found.</TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.contactid}>
                <TableCell className="font-medium">
                  {c.fullname || [c.firstname, c.lastname].filter(Boolean).join(" ") || "(no name)"}
                </TableCell>
                <TableCell>{c.emailaddress1 ?? "—"}</TableCell>
                <TableCell>{c.jobtitle ?? "—"}</TableCell>
                <TableCell>{c.telephone1 ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" title="Manage roles">
                      <Link to={`/contacts/${c.contactid}`}><ExternalLink className="size-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(c)}>
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
            <DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the contact's details." : "Create a new contact in Dataverse."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">First name</Label>
                <Input id="firstname" value={form.firstname}
                  onChange={(e) => setForm({ ...form, firstname: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">Last name *</Label>
                <Input id="lastname" value={form.lastname}
                  onChange={(e) => setForm({ ...form, lastname: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.emailaddress1}
                onChange={(e) => setForm({ ...form, emailaddress1: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.telephone1}
                  onChange={(e) => setForm({ ...form, telephone1: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobtitle">Job title</Label>
                <Input id="jobtitle" value={form.jobtitle}
                  onChange={(e) => setForm({ ...form, jobtitle: e.target.value })} />
              </div>
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
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.fullname || deleteTarget?.lastname}
              </span>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteContact.isPending}>
              {deleteContact.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
