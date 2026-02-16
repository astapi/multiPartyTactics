import { ClassId } from "@/types/models";
import { CLASS_MASTER } from "./classes";

export type ClassOption = {
  id: ClassId;
  label: string;
};

export const CLASS_OPTIONS: ClassOption[] = CLASS_MASTER.map((classInfo) => ({
  id: classInfo.id,
  label: classInfo.name,
}));
