import type { Tag } from "./tags";
import type { PersonSummary } from "./types/common";
import { ENDPOINTS } from "./endpoints";
import { http } from "./client";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface Anniversary {
  id: UUID;
  person_id: UUID;
  name: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface AnniversaryCreate {
  name: string;
  date: string;
}

export interface AnniversaryUpdate {
  name?: string;
  date?: string;
}

interface AnniversaryListMeta {
  person_id?: UUID | null;
}

export type AnniversaryListResponse = ListResponse<
  Anniversary,
  AnniversaryListMeta
>;

export interface Person extends PersonSummary {
  name?: string | null;
  nicknames?: string[] | null;
  birth_date?: string | null;
  location?: string | null;
  is_soft_deleted: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  anniversaries: Anniversary[];
  display_name: string;
  primary_nickname: string;
}

export interface PersonCreate {
  name?: string;
  description?: string;
  nicknames?: string[];
  birth_date?: string;
  location?: string;
  tag_ids?: UUID[];
}

export interface PersonUpdate {
  name?: string;
  description?: string;
  nicknames?: string[];
  birth_date?: string;
  location?: string;
  tag_ids?: UUID[];
}

interface PersonListMeta {
  search?: string | null;
  tag_filter?: string | null;
  tag_id?: UUID | null;
}

export interface PersonActivityItem {
  id: UUID;
  type: "vision" | "task" | "planned_event" | "timelog" | "note";
  title: string;
  description?: string | null;
  date: string;
  status?: string | null;
}

export type PersonActivityType = PersonActivityItem["type"];

interface PersonActivitiesMeta {
  person_id: UUID;
  person_name: string;
  activity_type?: PersonActivityType | null;
}

export type PersonListResponse = ListResponse<PersonSummary, PersonListMeta>;
export type PersonDetailListResponse = ListResponse<Person, PersonListMeta>;
export type PersonActivitiesResponse = ListResponse<
  PersonActivityItem,
  PersonActivitiesMeta
>;

const unsupported = () =>
  Promise.reject(new Error("This person sub-feature is not supported by LifeOS Web UI yet."));

export const personsApi = {
  getAll: async (
    page: number = 1,
    size: number = 100,
    search?: string,
    tagFilter?: string,
    tagId?: UUID,
  ): Promise<PersonListResponse> =>
    http.get<PersonListResponse>(ENDPOINTS.PERSONS.BASE, {
      page,
      size,
      search,
      tag_filter: tagFilter,
      tag_id: tagId,
    }),
  getById: (id: UUID): Promise<Person> =>
    http.get<Person>(ENDPOINTS.PERSONS.BY_ID(id)),
  create: (person: PersonCreate): Promise<Person> =>
    http.post<Person>(ENDPOINTS.PERSONS.BASE, person),
  update: (id: UUID, person: PersonUpdate): Promise<Person> =>
    http.patch<Person>(ENDPOINTS.PERSONS.BY_ID(id), person),
  delete: (id: UUID): Promise<void> =>
    http.delete<void>(ENDPOINTS.PERSONS.BY_ID(id)),
  getActivities: (
    id: UUID,
    page: number = 1,
    size: number = 50,
    activityType?: PersonActivityType,
  ): Promise<PersonActivitiesResponse> =>
    http.get<PersonActivitiesResponse>(ENDPOINTS.PERSONS.ACTIVITIES(id), {
      page,
      size,
      activity_type: activityType,
    }),
  createAnniversary: (
    _personId: UUID,
    _anniversary: AnniversaryCreate,
  ): Promise<Anniversary> => unsupported(),
  getAnniversaries: (personId: UUID): Promise<AnniversaryListResponse> =>
    http.get<AnniversaryListResponse>(ENDPOINTS.PERSONS.ANNIVERSARIES(personId)),
  deleteAnniversary: (
    _personId: UUID,
    _anniversaryId: UUID,
  ): Promise<void> => unsupported(),
  updateAnniversary: (
    _personId: UUID,
    _anniversaryId: UUID,
    _payload: AnniversaryUpdate,
  ): Promise<Anniversary> => unsupported(),
  addTag: (_personId: UUID, _tagId: UUID): Promise<Person> => unsupported(),
  removeTag: (_personId: UUID, _tagId: UUID): Promise<Person> => unsupported(),
  searchByTag: async (
    tagName: string,
    page: number = 1,
    size: number = 50,
  ): Promise<PersonDetailListResponse> =>
    http.get<PersonDetailListResponse>(ENDPOINTS.PERSONS.SEARCH_BY_TAG, {
      tag_name: tagName,
      page,
      size,
    }),
};
