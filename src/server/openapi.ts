/** Description OpenAPI 3.1 de l'API publique, servie sur /api/openapi. */
const conflict = {
  type: "object",
  properties: {
    code: { type: "string", examples: ["trainer_double_booked"] },
    severity: { type: "string", enum: ["error", "warning"] },
    message: { type: "string" },
    sessionId: { type: "string" },
    otherSessionId: { type: "string" },
    resource: { type: "object", properties: { type: { type: "string", enum: ["trainer", "room", "equipment"] }, id: { type: "string" } } },
    day: { type: "string", format: "date" },
  },
};

const session = {
  type: "object",
  required: ["courseId", "siteId", "slots"],
  properties: {
    id: { type: "string" },
    courseId: { type: "string" },
    siteId: { type: "string" },
    mode: { type: "string", enum: ["inter", "intra"] },
    clientId: { type: "string" },
    roomId: { type: "string" },
    status: { type: "string", enum: ["draft", "confirmed", "cancelled"] },
    slots: {
      type: "array",
      items: { type: "object", required: ["start", "end"], properties: { start: { type: "string", format: "date-time" }, end: { type: "string", format: "date-time" }, kind: { type: "string", enum: ["theory", "practice", "test"] } } },
    },
    assignments: { type: "array", items: { type: "object", properties: { role: { type: "string", enum: ["theory", "practice", "tester"] }, trainerId: { type: "string" } } } },
    equipmentIds: { type: "array", items: { type: "string" } },
    traineeIds: { type: "array", items: { type: "string" } },
  },
};

const ok = (description: string, schema: object = {}) => ({ description, content: { "application/json": { schema } } });
const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
const force = { name: "force", in: "query", schema: { type: "boolean" }, description: "Enregistrer une session confirmée malgré des conflits bloquants" };

export const openapi = {
  openapi: "3.1.0",
  info: { title: "API Abou", version: "1.0.0", description: "Planning opérationnel : sessions, ressources, conflits et recyclages. Authentification : en-tête `Authorization: Bearer <clé>`." },
  servers: [{ url: "/api/v1" }],
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    schemas: { Session: session, Conflict: conflict },
  },
  paths: {
    "/sessions": {
      get: {
        summary: "Lister les sessions et leurs conflits",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: ok("Sessions") },
      },
      post: {
        summary: "Créer une session",
        parameters: [force],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } } },
        responses: { 201: ok("Session créée, avec les conflits éventuels"), 400: ok("Données invalides"), 409: ok("Conflits bloquants") },
      },
    },
    "/sessions/{id}": {
      get: { summary: "Lire une session", parameters: [id], responses: { 200: ok("Session"), 404: ok("Introuvable") } },
      put: {
        summary: "Remplacer une session",
        parameters: [id, force],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } } },
        responses: { 200: ok("Session enregistrée"), 409: ok("Conflits bloquants") },
      },
      delete: { summary: "Supprimer une session", parameters: [id], responses: { 204: { description: "Supprimée" } } },
    },
    "/sessions/{id}/suggestions": {
      get: {
        summary: "Formateurs, salles et matériel compatibles, classés",
        parameters: [id, { name: "role", in: "query", schema: { type: "string", enum: ["theory", "practice", "tester"] } }],
        responses: { 200: ok("Suggestions") },
      },
    },
    "/conflicts": { get: { summary: "Tous les conflits du planning", responses: { 200: ok("Conflits", { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Conflict" } } } }) } } },
    "/resources/{kind}": {
      get: {
        summary: "Référentiels",
        parameters: [{ name: "kind", in: "path", required: true, schema: { type: "string", enum: ["trainers", "rooms", "equipment", "courses", "sites", "unavailabilities"] } }],
        responses: { 200: ok("Liste") },
      },
    },
    "/recyclings": {
      get: { summary: "Certificats arrivant à échéance", parameters: [{ name: "horizon", in: "query", schema: { type: "integer", default: 90 } }], responses: { 200: ok("Recyclages") } },
    },
  },
};
