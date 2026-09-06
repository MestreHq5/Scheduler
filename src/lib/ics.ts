import ICAL from "ical.js";

export interface ParsedIcsEvent {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  /** The event's CATEGORIES value — becomes the tag it's imported under. */
  tagLabel: string;
}

export function parseIcs(text: string): ParsedIcsEvent[] {
  const jcal = ICAL.parse(text);
  const component = new ICAL.Component(jcal);
  const vevents = component.getAllSubcomponents("vevent");

  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);
    const categories = vevent.getFirstPropertyValue("categories");
    const tagLabel = typeof categories === "string" ? categories.trim() : "";
    if (!tagLabel) {
      throw new Error(
        `"${event.summary || event.uid}" has no CATEGORIES — every event needs one so it knows which tag to import under.`,
      );
    }
    return {
      uid: event.uid,
      title: event.summary || "Untitled",
      startsAt: event.startDate.toJSDate().toISOString(),
      endsAt: event.endDate.toJSDate().toISOString(),
      location: event.location || null,
      tagLabel,
    };
  });
}
