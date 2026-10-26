// Modèle métier du planning. Les dates sont des chaînes ISO 8601 ;
// un intervalle [start, end) inclut son début et exclut sa fin.

export type Id = string;

export interface Interval {
  start: string;
  end: string;
}

export interface Site {
  id: Id;
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface Room {
  id: Id;
  name: string;
  siteId: Id;
  capacity: number;
  equipment?: string[];
}

/** Compétence ou habilitation d'un formateur, avec une date de fin de validité facultative. */
export interface Competence {
  code: string;
  validUntil?: string;
}

export interface Trainer {
  id: Id;
  firstName: string;
  lastName: string;
  email?: string;
  external: boolean;
  siteId?: Id;
  competences: Competence[];
  /** Testeur CACES : nombre maximal d'unités de test qu'il peut faire passer par jour. */
  testUnitsPerDay?: number;
}

export interface Equipment {
  id: Id;
  name: string;
  /** Type d'engin ou de matériel, par exemple « R489-3 » pour un chariot élévateur catégorie 3. */
  kind: string;
  siteId?: Id;
}

export interface Course {
  id: Id;
  code: string;
  title: string;
  durationHalfDays: number;
  maxTrainees: number;
  /** Compétences que tout formateur de la session doit détenir. */
  requiredCompetences: string[];
  /** Types de matériel nécessaires (un engin par type). */
  requiredEquipmentKinds?: string[];
  /** Formations réglementées (CACES, habilitations…) : unités de test par stagiaire. */
  testUnitsPerTrainee?: number;
  /** Durée de validité du certificat obtenu, en mois. */
  validityMonths?: number;
  color?: string;
  /** Prix par stagiaire hors taxes, en euros. */
  pricePerTrainee?: number;
}

export type SlotKind = "theory" | "practice" | "test";

export interface Slot extends Interval {
  kind: SlotKind;
}

export type AssignmentRole = "theory" | "practice" | "tester";

export interface Assignment {
  role: AssignmentRole;
  trainerId: Id;
}

export interface Session {
  id: Id;
  courseId: Id;
  siteId: Id;
  /** inter : dans nos locaux ; intra : chez le client, sans salle à réserver. */
  mode: "inter" | "intra";
  clientId?: Id;
  slots: Slot[];
  roomId?: Id;
  assignments: Assignment[];
  equipmentIds: Id[];
  traineeIds: Id[];
  status: "draft" | "confirmed" | "cancelled";
}

export type ResourceType = "trainer" | "room" | "equipment";

export interface Unavailability extends Interval {
  id: Id;
  resourceType: ResourceType;
  resourceId: Id;
  reason?: string;
}

export interface Trainee {
  id: Id;
  firstName: string;
  lastName: string;
  clientId?: Id;
}

/** Certificat obtenu par un stagiaire (CACES, habilitation…). */
export interface Certification {
  id: Id;
  traineeId: Id;
  courseId: Id;
  obtainedOn: string;
  validUntil: string;
}

/** Tout ce que le moteur de règles doit connaître pour juger une session. */
export interface PlanningContext {
  sites: Site[];
  rooms: Room[];
  trainers: Trainer[];
  equipment: Equipment[];
  courses: Course[];
  sessions: Session[];
  unavailabilities: Unavailability[];
}
