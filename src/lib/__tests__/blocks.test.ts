import { describe, expect, it } from "vitest"
import { blockCovers, blockMinutesOn, blockSpansFor, blocksOnDay } from "../blocks"
import type { VenueBlock } from "@/api/blocks"

const block = (over: Partial<VenueBlock>): VenueBlock => ({
  id: "k1", venueId: "v1", pitchId: null, startsAt: "2026-10-10T18:00", endsAt: "2026-10-10T22:00",
  reason: "Maintenance", createdAt: "2026-10-01T00:00:00Z", ...over,
})

describe("blockCovers", () => {
  it("a whole-venue block covers every pitch; a pitch block only its own", () => {
    expect(blockCovers(block({}), "p1")).toBe(true)
    expect(blockCovers(block({ pitchId: "p1" }), "p1")).toBe(true)
    expect(blockCovers(block({ pitchId: "p1" }), "p2")).toBe(false)
  })
})

describe("blockMinutesOn", () => {
  it("places a same-day block on the lane axis", () => {
    expect(blockMinutesOn(block({}), "2026-10-10")).toEqual({ from: 18 * 60, to: 22 * 60 })
  })
  it("clips a multi-day block to the day, and runs past midnight for a late window", () => {
    const eid = block({ startsAt: "2026-10-09T12:00", endsAt: "2026-10-12T00:00" })
    expect(blockMinutesOn(eid, "2026-10-10")).toEqual({ from: 0, to: 48 * 60 })
    expect(blockMinutesOn(eid, "2026-10-11")).toEqual({ from: 0, to: 24 * 60 })
  })
  it("does not touch a day it ends at the start of (the end is exclusive)", () => {
    expect(blockMinutesOn(block({ startsAt: "2026-10-09T20:00", endsAt: "2026-10-10T00:00" }), "2026-10-10")).toBeNull()
  })
  it("accepts the date with a time part, as bookings carry it", () => {
    expect(blockMinutesOn(block({}), "2026-10-10T00:00:00")).toEqual({ from: 1080, to: 1320 })
  })
})

describe("blockSpansFor / blocksOnDay", () => {
  const blocks = [
    block({ id: "late", pitchId: "p1", startsAt: "2026-10-10T20:00", endsAt: "2026-10-10T21:00" }),
    block({ id: "early", startsAt: "2026-10-10T09:00", endsAt: "2026-10-10T10:00" }),
    block({ id: "other", pitchId: "p2" }),
    block({ id: "tomorrow", startsAt: "2026-10-11T09:00", endsAt: "2026-10-11T10:00" }),
  ]
  it("returns this pitch's spans for the day, earliest first", () => {
    const spans = blockSpansFor(blocks, "p1", "2026-10-10")
    expect(spans.map((s) => s.block.id)).toEqual(["early", "late", "tomorrow"])
    // Next morning stays on this day's axis past 24:00, where a late window would reach it;
    // the lanes clip it to the visible frame.
    expect(spans[2].from).toBe(24 * 60 + 9 * 60)
  })
  it("lists what touches the calendar day", () => {
    expect(blocksOnDay(blocks, "2026-10-11").map((b) => b.id)).toEqual(["tomorrow"])
  })
})
