import { describe, expect, it } from "vitest";
import type { PersonRow } from "./people";
import {
  cateringNumbers,
  peopleByRoom,
  sheetPeople,
  splitName,
} from "./sheets";

function row(partial: Partial<PersonRow>): PersonRow {
  return {
    bookingId: Math.random().toString(36),
    reference: "PF-2027-0001",
    customerId: "c",
    fullName: "Someone",
    email: "",
    phone: "",
    emergencyContact: "",
    dietaryHealth: "",
    isTeam: false,
    optionId: "",
    roomId: "",
    pricePence: 0,
    depositPence: null,
    priceNote: "",
    notes: "",
    paymentNotes: "",
    cancelled: false,
    paidPence: 0,
    checkedInAt: null,
    lastEmail: null,
    ...partial,
  };
}

const options = [
  {
    id: "weekend",
    name: "Weekend (4pm start)",
    description: "Friday 4pm to Sunday 5pm.",
    startsAt: null,
  },
  {
    id: "kick",
    name: "Friday Kick Starter (9am start)",
    description: "Adds Friday lunch.",
    startsAt: null,
  },
];
const rooms = [
  { id: "main", name: "Main room", capacity: 78 },
  { id: "welsh", name: "Welsh", capacity: 10 },
];

describe("splitName", () => {
  it("splits first names from the surname", () => {
    expect(splitName("Jo Anne Smith")).toEqual({
      firstName: "Jo Anne",
      lastName: "Smith",
    });
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});

describe("sheetPeople", () => {
  it("leaves out cancelled bookings and adds option and room names", () => {
    const people = sheetPeople(
      [
        row({ fullName: "Ada Lovelace", optionId: "kick", roomId: "welsh" }),
        row({ fullName: "Gone Away", cancelled: true }),
        row({ fullName: "Team Helper", isTeam: true }),
      ],
      options,
      rooms,
    );
    expect(
      people.map((person) => [
        person.fullName,
        person.optionName,
        person.roomName,
      ]),
    ).toEqual([
      ["Ada Lovelace", "Friday Kick Starter (9am start)", "Welsh"],
      ["Team Helper", "Team", ""],
    ]);
  });
});

describe("cateringNumbers", () => {
  it("counts each option and the team, and lists dietary needs by name", () => {
    const people = sheetPeople(
      [
        row({ fullName: "Zoe", optionId: "kick", dietaryHealth: "Vegan" }),
        row({
          fullName: "Amy",
          optionId: "weekend",
          dietaryHealth: " Gluten free",
        }),
        row({ fullName: "Bea", optionId: "weekend" }),
        row({ fullName: "Tess", isTeam: true }),
      ],
      options,
      rooms,
    );
    const numbers = cateringNumbers(people, options);
    expect(numbers.total).toBe(4);
    expect(
      numbers.byOption.map((option) => [option.name, option.count]),
    ).toEqual([
      ["Weekend (4pm start)", 2],
      ["Friday Kick Starter (9am start)", 1],
      ["Team and helpers", 1],
    ]);
    expect(numbers.withNeeds.map((person) => person.fullName)).toEqual([
      "Amy",
      "Zoe",
    ]);
  });
});

describe("peopleByRoom", () => {
  it("groups people by room, with anyone unplaced last", () => {
    const people = sheetPeople(
      [
        row({ fullName: "A", roomId: "main" }),
        row({ fullName: "B", roomId: "welsh" }),
        row({ fullName: "C" }),
      ],
      options,
      rooms,
    );
    expect(
      peopleByRoom(people, rooms).map((group) => [
        group.room?.name ?? "No room",
        group.people.map((person) => person.fullName),
      ]),
    ).toEqual([
      ["Main room", ["A"]],
      ["Welsh", ["B"]],
      ["No room", ["C"]],
    ]);
  });
});
