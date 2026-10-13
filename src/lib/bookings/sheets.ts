import type { PersonRow } from "./people";

/**
 * Printable sheets and the catering sheet for an event: who's coming, when
 * they arrive, and what they need. Pure functions, so they're easy to test.
 */

export interface SheetOption {
  id: string;
  name: string;
  description: string;
  startsAt: string | null;
}

export interface SheetRoom {
  id: string;
  name: string;
  capacity: number | null;
}

export interface SheetPerson extends PersonRow {
  optionName: string;
  roomName: string;
  firstName: string;
  lastName: string;
}

/** "Jo Anne Smith" → first "Jo Anne", last "Smith". */
export function splitName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: fullName.trim(), lastName: "" };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

/** Everyone still booked (not cancelled), with option and room names. */
export function sheetPeople(
  rows: readonly PersonRow[],
  options: readonly SheetOption[],
  rooms: readonly SheetRoom[],
): SheetPerson[] {
  const optionName = new Map(options.map((option) => [option.id, option.name]));
  const roomName = new Map(rooms.map((room) => [room.id, room.name]));
  return rows
    .filter((row) => !row.cancelled)
    .map((row) => ({
      ...row,
      ...splitName(row.fullName),
      optionName:
        optionName.get(row.optionId) ?? (row.isTeam ? "Team" : "No option"),
      roomName: roomName.get(row.roomId) ?? "",
    }));
}

export interface CateringNumbers {
  total: number;
  byOption: {
    id: string | null;
    name: string;
    description: string;
    count: number;
  }[];
  withNeeds: SheetPerson[];
}

/**
 * Numbers for the hotel: how many people on each option (each option says
 * what it includes, such as Friday lunch), and everyone with dietary or
 * health needs.
 */
export function cateringNumbers(
  people: readonly SheetPerson[],
  options: readonly SheetOption[],
): CateringNumbers {
  const byOption: CateringNumbers["byOption"] = options
    .map((option) => ({
      id: option.id,
      name: option.name,
      description: option.description,
      count: people.filter((person) => person.optionId === option.id).length,
    }))
    .filter((option) => option.count > 0);
  const noOption = people.filter((person) => !person.optionId);
  if (noOption.length) {
    byOption.push({
      id: null,
      name: "Team and helpers",
      description: "Free places for the Paper Fox team.",
      count: noOption.length,
    });
  }
  return {
    total: people.length,
    byOption,
    withNeeds: people
      .filter((person) => person.dietaryHealth.trim() !== "")
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "en-GB", { sensitivity: "base" }),
      ),
  };
}

/** People in each room, in room order, with anyone not yet in a room last. */
export function peopleByRoom(
  people: readonly SheetPerson[],
  rooms: readonly SheetRoom[],
): { room: SheetRoom | null; people: SheetPerson[] }[] {
  const groups = rooms.map((room) => ({
    room,
    people: people.filter((person) => person.roomId === room.id),
  }));
  const unplaced = people.filter(
    (person) => !rooms.some((room) => room.id === person.roomId),
  );
  return unplaced.length
    ? [...groups, { room: null, people: unplaced }]
    : groups;
}
