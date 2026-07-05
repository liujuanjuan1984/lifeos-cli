import type { PersonSummary } from "@/services/api/types/common";
import type { Tag } from "@/services/api/tags";
import type {
  NoteHabitActionSummary,
  NoteTimelogSummary,
  TaskSummary,
} from "@/services/api/notes";
import type { UUID } from "./primitive";

export interface Note {
  id: UUID;
  content: string;
  createdAt: Date;
  people?: PersonSummary[];
  tags?: Tag[];
  task?: TaskSummary | null;
  tasks?: TaskSummary[];
  timelogs?: NoteTimelogSummary[];
  habit_actions?: NoteHabitActionSummary[];
}
