// Splitting a shared cost (SRS FR-111). OWNER: D
//
// Everyone pays floor(total / n). The requester pays the leftover won, so the shares
// always add up exactly to the total. Example: 10,000 KRW among 3 -> 3,333 + 3,333 + 3,334.
//
// TODO (D): settlement routes (create, mark Paid/Confirmed, cancel) - FR-109 to FR-122.

export type Share = { userId: string; amountKrw: number };

export function splitEvenly(totalKrw: number, memberIds: string[], requesterId: string): Share[] {
  if (!Number.isInteger(totalKrw) || totalKrw <= 0)
    throw new Error("Total must be a positive whole number.");
  if (memberIds.length === 0) throw new Error("Choose at least one member.");

  const base = Math.floor(totalKrw / memberIds.length);
  const remainder = totalKrw - base * memberIds.length;
  const requesterIncluded = memberIds.includes(requesterId);

  return memberIds.map((userId, i) => {
    // The requester takes the remainder; if they are not included, the first member does.
    const takesRemainder = requesterIncluded ? userId === requesterId : i === 0;
    return { userId, amountKrw: base + (takesRemainder ? remainder : 0) };
  });
}
