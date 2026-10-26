import { json, problem, withApiKey } from "@/server/api";
import { loadContext } from "@/server/planning";

const kinds = { trainers: "trainers", rooms: "rooms", equipment: "equipment", courses: "courses", sites: "sites", unavailabilities: "unavailabilities" } as const;

/** GET /api/v1/resources/{trainers|rooms|equipment|courses|sites|unavailabilities} */
export const GET = withApiKey(async (_req, { params }: RouteContext<"/api/v1/resources/[kind]">) => {
  const { kind } = await params;
  const key = kinds[kind as keyof typeof kinds];
  if (!key) return problem(404, "Ressource inconnue", { available: Object.keys(kinds) });
  const ctx = await loadContext();
  return json({ data: ctx[key] });
});
