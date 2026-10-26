import { detectAllConflicts } from "@/domain";
import { json, withApiKey } from "@/server/api";
import { loadContext } from "@/server/planning";

export const GET = withApiKey(async () => json({ data: detectAllConflicts(await loadContext()) }));
