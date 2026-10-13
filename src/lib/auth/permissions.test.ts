import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, isStaffRole } from "./permissions";

describe("can", () => {
  it("lets owners do everything", () => {
    for (const permission of PERMISSIONS) {
      expect(can("owner", permission)).toBe(true);
    }
  });

  it("stops admins changing settings or the team", () => {
    expect(can("admin", "settings.manage")).toBe(false);
    expect(can("admin", "team.manage")).toBe(false);
  });

  it("lets admins run events, bookings and payments", () => {
    expect(can("admin", "events.manage")).toBe(true);
    expect(can("admin", "bookings.manage")).toBe(true);
    expect(can("admin", "payments.record")).toBe(true);
    expect(can("admin", "attendees.message")).toBe(true);
  });

  it("only lets door staff look up bookings and check people in", () => {
    const allowed = PERMISSIONS.filter((permission) => can("door", permission));
    expect(allowed).toEqual(["bookings.view", "checkin.use"]);
  });

  it("never lets door staff see payments", () => {
    expect(can("door", "payments.view")).toBe(false);
  });

  it("gives customers (no role) nothing", () => {
    for (const permission of PERMISSIONS) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
    }
  });
});

describe("isStaffRole", () => {
  it("accepts the three roles only", () => {
    expect(isStaffRole("owner")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("door")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});
