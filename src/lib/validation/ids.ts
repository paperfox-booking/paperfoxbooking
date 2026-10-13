import { z } from "zod";

const uuid = z.uuid();

/** True for a well-formed id, so a mistyped address shows "not found". */
export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}
