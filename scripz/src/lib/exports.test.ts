import { describe, expect, it } from "vitest";
import { buildSrt } from "./exports";

describe("subtitle export durations", () => {
  it("merges same-second cues without losing any words", () => {
    expect(buildSrt("", "[0:00] Hello\n[0:00] there.\n[0:02] Next sentence."))
      .toBe("1\n00:00:00,000 --> 00:00:02,000\nHello there.\n\n2\n00:00:02,000 --> 00:00:05,000\nNext sentence.\n");
  });
  it("does not emit negative durations for regressing model timestamps", () => {
    const srt = buildSrt("", "[0:05] One\n[0:04] two\n[0:07] three");
    expect(srt).toContain("00:00:05,000 --> 00:00:07,000\nOne two");
  });
  it("preserves timestamps after an hour", () => {
    const srt = buildSrt("", "[1:31:00] Last question?\n[1:31:02] No.");
    expect(srt).toContain("01:31:00,000 --> 01:31:02,000");
    expect(srt).toContain("01:31:02,000 --> 01:31:05,000");
  });
  it("keeps the plain-text fallback working", () => {
    expect(buildSrt("One. Two.")).toContain("00:00:00,000 --> 00:00:04,000\nOne.");
    expect(buildSrt("")).toBe("");
  });
});
