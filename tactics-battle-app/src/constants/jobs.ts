import { JobId } from "@/types/models";
import { CLASS_MASTER } from "./classes";

export type JobOption = {
  id: JobId;
  label: string;
};

export const CLASS_OPTIONS: JobOption[] = CLASS_MASTER.map((classInfo) => ({
  id: classInfo.id,
  label: classInfo.name,
}));
