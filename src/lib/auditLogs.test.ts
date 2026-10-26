import { describe, expect, it } from "vitest";
import { describeChange, fieldLabel, formatChangeValue } from "./auditLogs";

describe("audit log changes", () => {
  it("shows a user id as the name the API sent, or as a user number without one", () => {
    expect(describeChange("assignedBy", { from: null, to: 19, toName: "Rohit Verma" })).toEqual({
      kind: "set",
      label: "Assigned By",
      to: "Rohit Verma",
    });
    expect(formatChangeValue(42, "resolvedBy")).toBe("User #42");
    expect(formatChangeValue(19, "reviewerId", "Rohit Verma")).toBe("Rohit Verma");
  });

  it("shows timestamps and dates as readable dates, not ISO text", () => {
    expect(formatChangeValue("2026-10-24T16:48:21.727Z", "assignedAt")).not.toContain("T16");
    expect(formatChangeValue("2026-12-31", "applicationDeadline")).not.toBe("2026-12-31");
  });

  it("never shows a secret, only what happened to it", () => {
    expect(describeChange("openaiApiKey", { from: null, to: "***" })).toEqual({
      kind: "secret",
      label: "OpenAI API Key",
      what: "added",
    });
    expect(describeChange("smtpPassword", { from: "***", to: null })).toMatchObject({
      kind: "secret",
      what: "removed",
    });
    expect(formatChangeValue("***", "openaiApiKey")).toBe("Hidden");
  });

  it("writes short words in capitals", () => {
    expect(fieldLabel("smtpHost")).toBe("SMTP Host");
    expect(fieldLabel("attachPdfLetter")).toBe("Attach PDF Letter");
    expect(fieldLabel("campusId")).toBe("Campus");
  });
});
