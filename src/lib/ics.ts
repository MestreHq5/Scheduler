import ICAL from "ical.js";

export interface ParsedIcsEvent {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
}

export function parseIcs(text: string): ParsedIcsEvent[] {
  const jcal = ICAL.parse(text);
  const component = new ICAL.Component(jcal);
  const vevents = component.getAllSubcomponents("vevent");

  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);
    return {
      uid: event.uid,
      title: event.summary || "Untitled",
      startsAt: event.startDate.toJSDate().toISOString(),
      endsAt: event.endDate.toJSDate().toISOString(),
      location: event.location || null,
    };
  });
}
