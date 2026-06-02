import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export type InvitationStatus = "pending" | "registered" | "revoked" | "expired";

export type Invitation = {
  id: UUID;
  code: string;
  target_email: string;
  status: InvitationStatus;
  creator_user_id: UUID;
  target_user_id?: UUID | null;
  memo?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  registered_at?: string | null;
  revoked_at?: string | null;
};

export type InvitationWithCreator = Invitation & {
  creator_email?: string | null;
  creator_name?: string | null;
};

export type InvitationListMeta = {
  scope?: "created" | "invited" | null;
  creator_user_id?: UUID | null;
  target_email?: string | null;
};

export type InvitationListResponse = ListResponse<
  Invitation,
  InvitationListMeta
>;

export type InvitationWithCreatorListResponse = ListResponse<
  InvitationWithCreator,
  InvitationListMeta
>;

export type InvitationCreateRequest = {
  email: string;
  memo?: string | null;
};

export type InvitationLookupResponse = {
  code: string;
  target_email: string;
  status: InvitationStatus;
  creator_email?: string | null;
  creator_name?: string | null;
  memo?: string | null;
};

export const invitationsApi = {
  createInvitation: async (payload: InvitationCreateRequest) => {
    return http.post<Invitation>(ENDPOINTS.INVITATIONS.BASE, payload);
  },
  getMyInvitations: async (page: number = 1, size: number = 100) => {
    return http.get<InvitationListResponse>(ENDPOINTS.INVITATIONS.MINE, {
      page,
      size,
    });
  },
  getInvitedMe: async (page: number = 1, size: number = 100) => {
    return http.get<InvitationWithCreatorListResponse>(
      ENDPOINTS.INVITATIONS.INVITED_ME,
      {
        page,
        size,
      },
    );
  },
  revokeInvitation: async (id: UUID) => {
    return http.delete<void>(ENDPOINTS.INVITATIONS.BY_ID(id));
  },
  restoreInvitation: async (id: UUID) => {
    return http.post<Invitation>(ENDPOINTS.INVITATIONS.RESTORE(id));
  },
  lookupInvitation: async (code: string) => {
    return http.get<InvitationLookupResponse>(
      ENDPOINTS.INVITATIONS.LOOKUP(code),
    );
  },
};
