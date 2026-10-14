"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { formatUkTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { checkInAction } from "./actions";

export interface CheckInPerson {
  bookingId: string;
  fullName: string;
  isTeam: boolean;
  start: string;
  roomName: string;
  dietaryHealth: string;
  /** Only for people who may see money. */
  owedPence: number | null;
  checkedInAt: string | null;
}

/**
 * Checking people in on a phone: find someone, tap Arrived. The list updates
 * every 30 seconds, so several people can check in at once.
 */
export function CheckInList({ people }: { people: CheckInPerson[] }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Fresh figures from the server replace this phone's own changes.
  const [shownPeople, setShownPeople] = useState(people);
  if (shownPeople !== people) {
    setShownPeople(people);
    setOverrides({});
  }
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const arrivedAt = (person: CheckInPerson) =>
    person.bookingId in overrides
      ? overrides[person.bookingId]
      : person.checkedInAt;
  const arrivedCount = people.filter((person) => arrivedAt(person)).length;

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    return people.filter((person) => {
      const here =
        person.bookingId in overrides
          ? overrides[person.bookingId]
          : person.checkedInAt;
      if (onlyMissing && here) return false;
      return !words || person.fullName.toLowerCase().includes(words);
    });
  }, [people, overrides, query, onlyMissing]);

  async function mark(person: CheckInPerson, arrived: boolean) {
    setBusy(person.bookingId);
    const result = await checkInAction(person.bookingId, arrived);
    setBusy(null);
    if (result.ok) {
      setOverrides((current) => ({
        ...current,
        [person.bookingId]: result.checkedInAt,
      }));
      setAnnouncement(
        arrived
          ? `${person.fullName} is here.`
          : `${person.fullName} is no longer marked as here.`,
      );
    } else {
      setAnnouncement(`Couldn't update ${person.fullName}: ${result.error}`);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-3xl font-bold" aria-live="polite">
        {arrivedCount} of {people.length} here
      </p>
      <div className="space-y-3 rounded-2xl border border-cream bg-white p-4">
        <div>
          <label htmlFor="find-arrival" className="block font-bold">
            Find someone
          </label>
          <Input
            id="find-arrival"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Start typing their name"
            autoComplete="off"
          />
        </div>
        <Checkbox
          id="only-missing"
          label="Only people not here yet"
          checked={onlyMissing}
          onChange={(event) => setOnlyMissing(event.currentTarget.checked)}
        />
      </div>
      <p role="status" className="min-h-6 font-bold">
        {announcement}
      </p>
      <ul className="space-y-2">
        {visible.map((person) => {
          const here = arrivedAt(person);
          return (
            <li
              key={person.bookingId}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 bg-white p-3",
                here ? "border-teal-deep" : "border-cream",
              )}
            >
              <div className="min-w-0">
                <p className="text-xl font-bold">
                  {person.fullName}
                  {person.isTeam ? (
                    <span className="font-normal"> (team)</span>
                  ) : null}
                </p>
                <p className="text-stone">
                  {[person.start, person.roomName].filter(Boolean).join(" · ")}
                </p>
                {person.dietaryHealth ? <p>{person.dietaryHealth}</p> : null}
                {person.owedPence ? (
                  <p className="font-bold text-danger">
                    To pay: {formatPrice(person.owedPence)}
                  </p>
                ) : null}
              </div>
              {here ? (
                <div className="flex items-center gap-3">
                  <span className="font-bold text-teal-deep">
                    Here {formatUkTime(here)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    disabled={busy === person.bookingId}
                    onClick={() => void mark(person, false)}
                    aria-label={`Undo arrival for ${person.fullName}`}
                  >
                    Undo
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="large"
                  disabled={busy === person.bookingId}
                  onClick={() => void mark(person, true)}
                  aria-label={`Arrived: ${person.fullName}`}
                >
                  Arrived
                </Button>
              )}
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="rounded-2xl bg-white p-4">
            {people.length === 0 ? "Nobody is booked yet." : "Nobody matches."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
