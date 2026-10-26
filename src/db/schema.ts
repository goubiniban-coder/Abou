import { relations } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { Competence } from "@/domain";

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
