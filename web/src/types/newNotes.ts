import type { PersonSummary } from "@/services/api/types/common";
import type { Tag } from "@/services/api/tags";
import type { NoteTimelogSummary, TaskSummary } from "@/services/api/notes";
import type { UUID } from "./primitive";

export interface Note {
  id: UUID;
  content: string;
  createdAt: Date;
  persons?: PersonSummary[];
  tags?: Tag[];
  task?: TaskSummary;
  timelogs?: NoteTimelogSummary[];
}
