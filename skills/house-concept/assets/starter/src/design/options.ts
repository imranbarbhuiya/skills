/**
 * Earlier options, kept as they were so the family can compare (shown on the "Earlier options" tab).
 * When a new working plan replaces the current one, move the old builder call here instead of deleting it.
 */
import type { Design } from "../types";
import { courtyardHouse } from "./house";

export const OPTIONS: Design[] = [courtyardHouse({ court: false })];
