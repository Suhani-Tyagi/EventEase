import assert from "node:assert/strict";
import {
  escapeIcsText,
  foldIcsLine,
  generateCopySummary,
  generateCsvContent,
  generateIcsContent,
  getByteLength,
  getNextDayIcs,
  sanitizeCsvCell,
} from "../static/js/exports.js";

const plan = {
  intake: {
    event_type: "wedding",
    date: "2028-02-29",
    city: "Napa Valley",
    guest_count: 80,
    currency: "USD",
    theme: "Spring garden",
  },
  budget: {
    currency: "USD",
    total_budget: 12000,
    cost_per_guest: 150,
    items: [
      { category: "Contingency Fund", percentage: 8, amount: 960, description: "Reserve" },
      { category: "=HYPERLINK(\"x\")", percentage: 92, amount: 11040, description: "Venue, food" },
    ],
  },
  timeline: {
    days_remaining: 120,
    milestones: [
      {
        period_label: "4 Months Before",
        target_date: "2027-10-31",
        description: "Confirm vendors",
        tasks: ["Venue", "Catering"],
      },
    ],
  },
  checklist: {
    tasks: [
      {
        id: "venue",
        category: "Venue",
        vendor_type: "Reception Hall",
        status: "to-do",
        questions_to_ask: ["Availability"],
      },
    ],
  },
  ideas: { themes: ["Spring garden"], budget_saving_tips: ["Book early"] },
};

const state = {
  activePlanName: "",
  budgetAllocations: [],
  completedMilestones: new Set(),
  checklistStatusMap: {},
  vendorContacts: {},
  vendorNotes: {},
  vendorQuotes: [],
};

assert.equal(sanitizeCsvCell("=1+1"), "'=1+1");
assert.equal(sanitizeCsvCell("  @SUM(A1:A2)"), "'  @SUM(A1:A2)");
assert.equal(sanitizeCsvCell("-10%"), "'-10%");
assert.equal(sanitizeCsvCell(-10), "-10");
assert.equal(sanitizeCsvCell('Venue, "North"'), '"Venue, ""North"""');
assert.equal(getNextDayIcs("2028-02-28"), "20280229");
assert.equal(getNextDayIcs("2028-12-31"), "20290101");
assert.equal(escapeIcsText("A,B;C\\D\r\nNext"), "A\\,B\\;C\\\\D\\nNext");

const longLine = `SUMMARY:${"婚礼 celebration ".repeat(12)}`;
const foldedLines = foldIcsLine(longLine).split("\r\n");
assert.ok(foldedLines.every((line) => getByteLength(line) <= 75));
assert.ok(foldedLines.slice(1).every((line) => line.startsWith(" ")));

const summary = generateCopySummary(plan, state, (amount, currency) => `${currency} ${amount}`);
assert.match(summary, /EVENTEASE CELEBRATION MASTER PLAN/);
assert.match(summary, /Emergency Contingency: USD 960 \(8\.0% safety buffer\)/);
assert.doesNotMatch(summary, /undefined|NaN/);

const csv = generateCsvContent(plan, state);
assert.match(csv, /'=HYPERLINK/);
assert.ok(csv.includes('"Venue, food"'));
assert.match(csv, /PRIVATE NOTES & CONTACTS/);

const calendar = generateIcsContent(plan, {
  activePlanId: "sample-plan",
  completedMilestones: new Set(["milestone-0"]),
  now: new Date("2027-01-02T03:04:05Z"),
});
assert.match(calendar, /UID:eventease-sample-plan-milestone-0@eventease\.app/);
assert.match(calendar, /DTEND;VALUE=DATE:20271101/);
assert.match(calendar, /STATUS:COMPLETED/);
assert.match(calendar, /DTEND;VALUE=DATE:20280301/);
assert.ok(calendar.split("\r\n").every((line) => getByteLength(line) <= 75));

console.log("Export unit tests passed");
