import { describe, expect, it } from "vitest";
import { dedupeBoundary, stitchSegments } from "./stitch";

describe("dedupeBoundary", () => {
  it("removes a genuine repeated overlap at the boundary", () => {
    const prev = "so what we did next was open the second box carefully";
    const next = "open the second box carefully and then we found the invoice";
    expect(dedupeBoundary(prev, next)).toBe("and then we found the invoice");
  });

  it("ignores punctuation and casing when matching overlap", () => {
    const prev = "we shipped it on friday, finally.";
    const next = "On Friday — finally! the rest arrived monday";
    expect(dedupeBoundary(prev, next)).toBe("the rest arrived monday");
  });

  it("does not trim when there is no real overlap", () => {
    const prev = "the first part ends here with these words";
    const next = "a completely different sentence begins the next part";
    expect(dedupeBoundary(prev, next)).toBe(next);
  });

  it("does not trim short accidental matches", () => {
    const prev = "we talked about it and";
    const next = "and the meeting ended";
    expect(dedupeBoundary(prev, next)).toBe("and the meeting ended");
  });
});

describe("stitchSegments", () => {
  it("stitches ordered segments and reports completion", () => {
    const out = stitchSegments(
      [
        { index: 1, text: "second part text" },
        { index: 0, text: "first part text" },
      ],
      2,
    );
    expect(out.transcript).toBe("first part text\n\nsecond part text");
    expect(out.complete).toBe(true);
    expect(out.segmentsCompleted).toBe(2);
    expect(out.firstMissingIndex).toBeNull();
    expect(out.error).toBeNull();
  });

  it("never reports complete when a suffix segment is missing", () => {
    const out = stitchSegments(
      [
        { index: 0, text: "first part text" },
        { index: 1, text: null, error: "AI gateway rate limit" },
      ],
      2,
    );
    expect(out.complete).toBe(false);
    expect(out.segmentsCompleted).toBe(1);
    expect(out.firstMissingIndex).toBe(1);
    expect(out.error).toBe("AI gateway rate limit");
  });

  it("reports the first gap when a middle segment fails", () => {
    const out = stitchSegments(
      [
        { index: 0, text: "a a a a a" },
        { index: 2, text: "c c c c c" },
      ],
      3,
    );
    expect(out.complete).toBe(false);
    expect(out.firstMissingIndex).toBe(1);
    expect(out.segmentsCompleted).toBe(2);
  });

  it("drops no-speech placeholders but still counts them as completed", () => {
    const out = stitchSegments(
      [
        { index: 0, text: "hello there everyone" },
        { index: 1, text: "[No speech detected]" },
      ],
      2,
    );
    expect(out.transcript).toBe("hello there everyone");
    expect(out.complete).toBe(true);
    expect(out.segmentsCompleted).toBe(2);
  });

  it("deduplicates overlap across stitched segments", () => {
    const out = stitchSegments(
      [
        { index: 0, text: "and then the engine finally started running smoothly" },
        { index: 1, text: "the engine finally started running smoothly before it stalled again" },
      ],
      2,
    );
    expect(out.transcript).toBe(
      "and then the engine finally started running smoothly\n\nbefore it stalled again",
    );
  });

  it("treats an empty plan as not complete", () => {
    const out = stitchSegments([], 0);
    expect(out.complete).toBe(false);
    expect(out.error).toContain("0 of 0");
  });
});
