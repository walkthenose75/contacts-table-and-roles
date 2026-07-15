import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContactsService } from "@/generated/services/ContactsService";
import { Mspp_webrolesService } from "@/generated/services/Mspp_webrolesService";
import { Mspp_websitesService } from "@/generated/services/Mspp_websitesService";
import { Powerpagecomponent_mspp_webrole_contactsetService } from "@/generated/services/Powerpagecomponent_mspp_webrole_contactsetService";
import { PowerpagecomponentsService } from "@/generated/services/PowerpagecomponentsService";
import { MicrosoftDataverseService } from "@/generated/services/MicrosoftDataverseService";
import type { ContactsBase } from "@/generated/models/ContactsModel";
import type { Mspp_webrolesBase } from "@/generated/models/Mspp_webrolesModel";
import { WEBROLE_RELATIONSHIP, powerPageComponentRef } from "@/lib/dataverse";

// ---------- Contacts ----------

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await ContactsService.getAll({
        select: ["contactid", "firstname", "lastname", "fullname", "emailaddress1", "telephone1", "jobtitle"],
        orderBy: ["lastname asc", "firstname asc"],
        top: 500,
      });
      return res.data ?? [];
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ["contact", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await ContactsService.get(id as string, {
        select: ["contactid", "firstname", "lastname", "fullname", "emailaddress1", "telephone1", "jobtitle"],
      });
      return res.data ?? null;
    },
  });
}

export type ContactInput = Partial<Omit<ContactsBase, "address1_addressid">> & { lastname: string };

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: ContactInput) => {
      const res = await ContactsService.create(record as Omit<ContactsBase, "address1_addressid">);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<Omit<ContactsBase, "address1_addressid">> }) => {
      const res = await ContactsService.update(id, changes);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact", vars.id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await ContactsService.delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

// ---------- Websites (lookup) ----------

export function useWebsites() {
  return useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const res = await Mspp_websitesService.getAll({
        select: ["mspp_websiteid", "mspp_name"],
        orderBy: ["mspp_name asc"],
        top: 200,
      });
      return res.data ?? [];
    },
  });
}

// ---------- Web Roles ----------

export function useWebRoles() {
  return useQuery({
    queryKey: ["webroles"],
    queryFn: async () => {
      const res = await Mspp_webrolesService.getAll({
        select: [
          "mspp_webroleid",
          "mspp_name",
          "mspp_description",
          "mspp_authenticatedusersrole",
          "mspp_anonymoususersrole",
          "_mspp_websiteid_value",
        ],
        orderBy: ["mspp_name asc"],
        top: 500,
      });
      return res.data ?? [];
    },
  });
}

export type WebRoleInput = {
  mspp_name: string;
  mspp_websiteid: string;
  mspp_description?: string;
  mspp_authenticatedusersrole?: boolean;
  mspp_anonymoususersrole?: boolean;
};

export function useCreateWebRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WebRoleInput) => {
      const record: Partial<Mspp_webrolesBase> = {
        mspp_name: input.mspp_name,
        "mspp_websiteid@odata.bind": `/mspp_websites(${input.mspp_websiteid})`,
        mspp_description: input.mspp_description,
        mspp_authenticatedusersrole: input.mspp_authenticatedusersrole ?? false,
        mspp_anonymoususersrole: input.mspp_anonymoususersrole ?? false,
        statecode: 0,
      };
      const res = await Mspp_webrolesService.create(record as Omit<Mspp_webrolesBase, "mspp_webroleid">);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webroles"] }),
  });
}

export type WebRoleUpdate = {
  id: string;
  mspp_name: string;
  mspp_description?: string;
  mspp_authenticatedusersrole?: boolean;
  mspp_anonymoususersrole?: boolean;
};

// In the enhanced Power Pages model a web role is a `powerpagecomponent` (type 11).
// `mspp_webrole` records CANNOT be updated (a platform plugin throws), so edits are
// written to the underlying powerpagecomponent: the role name maps to `name` and the
// flags/description live in the `content` JSON blob.
export function useUpdateWebRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WebRoleUpdate) => {
      const cur = await PowerpagecomponentsService.get(input.id, { select: ["content", "name"] });
      let content: Record<string, unknown> = {};
      try {
        if (cur.data?.content) content = JSON.parse(cur.data.content) as Record<string, unknown>;
      } catch {
        content = {};
      }
      content.authenticatedusersrole = input.mspp_authenticatedusersrole ?? false;
      content.anonymoususersrole = input.mspp_anonymoususersrole ?? false;
      content.description = input.mspp_description ?? "";
      const res = await PowerpagecomponentsService.update(input.id, {
        name: input.mspp_name,
        content: JSON.stringify(content),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webroles"] }),
  });
}

export function useDeleteWebRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await Mspp_webrolesService.delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webroles"] }),
  });
}

// ---------- Role assignments (N:N) ----------

// Returns the set of web-role ids (== powerpagecomponentid) assigned to a contact.
export function useContactRoleIds(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact-roles", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const res = await Powerpagecomponent_mspp_webrole_contactsetService.getAll({
        select: ["powerpagecomponentid", "contactid"],
        filter: `contactid eq ${contactId}`,
        top: 500,
      });
      return new Set((res.data ?? []).map((r) => r.powerpagecomponentid));
    },
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, roleId }: { contactId: string; roleId: string }) => {
      await MicrosoftDataverseService.AssociateEntities("contacts", contactId, WEBROLE_RELATIONSHIP, {
        "@odata.id": powerPageComponentRef(roleId),
      });
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["contact-roles", vars.contactId] }),
  });
}

export function useUnassignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, roleId }: { contactId: string; roleId: string }) => {
      await MicrosoftDataverseService.DisassociateEntities("contacts", contactId, WEBROLE_RELATIONSHIP, roleId);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["contact-roles", vars.contactId] }),
  });
}
