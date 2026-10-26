import { relations } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { Competence, DateOption } from "@/domain";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

export const sites = pgTable("sites", {
  id: id(),
  name: text("name").notNull(),
  city: text("city"),
});

export const rooms = pgTable("rooms", {
  id: id(),
  name: text("name").notNull(),
  siteId: text("site_id").notNull().references(() => sites.id),
  capacity: integer("capacity").notNull(),
  equipment: jsonb("equipment").$type<string[]>().notNull().default([]),
});

export const trainers = pgTable("trainers", {
  id: id(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  external: boolean("external").notNull().default(false),
  siteId: text("site_id").references(() => sites.id),
  competences: jsonb("competences").$type<Competence[]>().notNull().default([]),
  testUnitsPerDay: integer("test_units_per_day"),
  /** Jeton secret du lien d'abonnement iCal. */
  calendarToken: text("calendar_token").notNull().$defaultFn(() => crypto.randomUUID()),
});

export const equipment = pgTable("equipment", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  siteId: text("site_id").references(() => sites.id),
});

export const courses = pgTable("courses", {
  id: id(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  durationHalfDays: integer("duration_half_days").notNull(),
  maxTrainees: integer("max_trainees").notNull(),
  requiredCompetences: jsonb("required_competences").$type<string[]>().notNull().default([]),
  requiredEquipmentKinds: jsonb("required_equipment_kinds").$type<string[]>().notNull().default([]),
  testUnitsPerTrainee: integer("test_units_per_trainee"),
  validityMonths: integer("validity_months"),
  color: text("color"),
  /** Prix par stagiaire, hors taxes, en euros ; repris sur les devis. */
  pricePerTrainee: integer("price_per_trainee"),
});

export const clients = pgTable("clients", {
  id: id(),
  name: text("name").notNull(),
  city: text("city"),
});

export const trainees = pgTable("trainees", {
  id: id(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  clientId: text("client_id").references(() => clients.id),
});

export const sessionMode = pgEnum("session_mode", ["inter", "intra"]);
export const sessionStatus = pgEnum("session_status", ["draft", "confirmed", "cancelled"]);
export const slotKind = pgEnum("slot_kind", ["theory", "practice", "test"]);
export const assignmentRole = pgEnum("assignment_role", ["theory", "practice", "tester"]);
export const resourceType = pgEnum("resource_type", ["trainer", "room", "equipment"]);

export const sessions = pgTable("sessions", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id),
  siteId: text("site_id").notNull().references(() => sites.id),
  mode: sessionMode("mode").notNull().default("inter"),
  clientId: text("client_id").references(() => clients.id),
  roomId: text("room_id").references(() => rooms.id),
  status: sessionStatus("status").notNull().default("draft"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const slots = pgTable(
  "slots",
  {
    id: id(),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    start: ts("start").notNull(),
    end: ts("end").notNull(),
    kind: slotKind("kind").notNull().default("theory"),
  },
  (t) => [index("slots_session_idx").on(t.sessionId), index("slots_start_idx").on(t.start)],
);

export const assignments = pgTable(
  "assignments",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    trainerId: text("trainer_id").notNull().references(() => trainers.id),
    role: assignmentRole("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.trainerId, t.role] })],
);

export const sessionEquipment = pgTable(
  "session_equipment",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    equipmentId: text("equipment_id").notNull().references(() => equipment.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.equipmentId] })],
);

export const enrollments = pgTable(
  "enrollments",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    traineeId: text("trainee_id").notNull().references(() => trainees.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.traineeId] })],
);

export const unavailabilities = pgTable("unavailabilities", {
  id: id(),
  resourceType: resourceType("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  start: ts("start").notNull(),
  end: ts("end").notNull(),
  reason: text("reason"),
});

export const certifications = pgTable("certifications", {
  id: id(),
  traineeId: text("trainee_id").notNull().references(() => trainees.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull().references(() => courses.id),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
  obtainedOn: date("obtained_on", { mode: "string" }).notNull(),
  validUntil: date("valid_until", { mode: "string" }).notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: id(),
  name: text("name").notNull(),
  /** Empreinte SHA-256 de la clé ; la clé elle-même n'est montrée qu'une fois. */
  hash: text("hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastUsedAt: ts("last_used_at"),
});

/** Une ligne par stagiaire et par créneau : signé présent ou déclaré absent. */
export const presence = pgEnum("presence", ["present", "absent"]);
export const attendance = pgTable(
  "attendance",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    /** Début du créneau : les créneaux sont recréés à chaque enregistrement de la session. */
    slotStart: ts("slot_start").notNull(),
    traineeId: text("trainee_id").notNull().references(() => trainees.id, { onDelete: "cascade" }),
    presence: presence("presence").notNull(),
    /** Tracé SVG de la signature (commandes M et L). */
    signature: text("signature"),
    recordedBy: text("recorded_by").references(() => trainers.id, { onDelete: "set null" }),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.slotStart, t.traineeId] })],
);

export const trainerSignatures = pgTable(
  "trainer_signatures",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    slotStart: ts("slot_start").notNull(),
    trainerId: text("trainer_id").notNull().references(() => trainers.id, { onDelete: "cascade" }),
    signature: text("signature").notNull(),
    signedAt: ts("signed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.slotStart, t.trainerId] })],
);

export const outcome = pgEnum("outcome", ["passed", "failed"]);
export const testResults = pgTable(
  "test_results",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    traineeId: text("trainee_id").notNull().references(() => trainees.id, { onDelete: "cascade" }),
    theory: outcome("theory"),
    theoryScore: integer("theory_score"),
    practice: outcome("practice"),
    categories: text("categories"),
    comment: text("comment"),
    testerId: text("tester_id").references(() => trainers.id, { onDelete: "set null" }),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.traineeId] })],
);

/** Identité de l'organisme, reprise sur les documents. Une seule ligne, d'identifiant « main ». */
export const organization = pgTable("organization", {
  id: text("id").primaryKey().default("main"),
  name: text("name").notNull(),
  address: text("address"),
  siret: text("siret"),
  /** Numéro de déclaration d'activité. */
  nda: text("nda"),
  phone: text("phone"),
  email: text("email"),
  /** Responsable qui signe les attestations. */
  signatory: text("signatory"),
  /** Taux de TVA des devis, en % ; 0 pour un organisme exonéré (article 261-4-4° du CGI). */
  vatRate: integer("vat_rate").notNull().default(20),
});

export const proposalStatus = pgEnum("proposal_status", ["open", "accepted", "declined"]);

/** Dates proposées à un client pour recycler ses stagiaires ; il en choisit une depuis un lien personnel. */
export const proposals = pgTable("proposals", {
  id: id(),
  /** Jeton secret du lien envoyé au client. */
  token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  /** Numéro de devis, attribué à la création. */
  number: text("number").notNull().unique(),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  courseId: text("course_id").notNull().references(() => courses.id),
  siteId: text("site_id").notNull().references(() => sites.id),
  traineeIds: jsonb("trainee_ids").$type<string[]>().notNull(),
  options: jsonb("options").$type<DateOption[]>().notNull(),
  pricePerTrainee: integer("price_per_trainee"),
  status: proposalStatus("status").notNull().default("open"),
  chosenOption: integer("chosen_option"),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
  /** Nom saisi par le client au moment d'accepter. */
  acceptedBy: text("accepted_by"),
  acceptedAt: ts("accepted_at"),
  expiresOn: date("expires_on", { mode: "string" }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ many }) => ({
  slots: many(slots),
  assignments: many(assignments),
  equipment: many(sessionEquipment),
  enrollments: many(enrollments),
}));
export const slotsRelations = relations(slots, ({ one }) => ({ session: one(sessions, { fields: [slots.sessionId], references: [sessions.id] }) }));
export const assignmentsRelations = relations(assignments, ({ one }) => ({ session: one(sessions, { fields: [assignments.sessionId], references: [sessions.id] }) }));
export const sessionEquipmentRelations = relations(sessionEquipment, ({ one }) => ({ session: one(sessions, { fields: [sessionEquipment.sessionId], references: [sessions.id] }) }));
export const enrollmentsRelations = relations(enrollments, ({ one }) => ({ session: one(sessions, { fields: [enrollments.sessionId], references: [sessions.id] }) }));
