import { JobId } from "@/types/models";

export type JobOption = {
  id: JobId;
  label: string;
};

export const JOB_OPTIONS: JobOption[] = [
  { id: "GUARDIAN", label: "Guardian" },
  { id: "CLERIC", label: "Cleric" },
  { id: "BLADE", label: "Blade" },
  { id: "ARCANE", label: "Arcane" },
];
