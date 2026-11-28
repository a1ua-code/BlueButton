// Workstream B: host-reported absences, admin attendance review, private user summary.
import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";
import { attendanceIncidents, attendanceSuspensions, db, partyMembers, parties, users } from "../../db";
import { conflict, forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";
import { DAY_MS, registerAttendanceIncident } from "./attendancePolicy";

/** Host may file a no-show for a participant during the 7 days following start.
 * This 7-day report window is an IMPLEMENTATION PROPOSAL, not an SRS requirement.
 */
export async function reportNoShow(partyId: string, host: AuthUser, userId: string) {
  return db.transaction(async (tx) => {
    const [party] = await tx.select({ hostId: parties.hostId, startAt: parties.startAt,
      status: parties.status }).from(parties).where(eq(parties.id, partyId)).for("update");
    if (!party) throw notFound("Party");
    if (party.hostId !== host.id) throw forbidden("Only the current host may report a no-show.");
    const now = new Date();
    if (party.status === "CANCELLED") throw conflict("PARTY_CANCELLED", "No-show reports are disabled for cancelled parties.");
    if (now < party.startAt) throw conflict("PARTY_NOT_STARTED", "No-show reports require the game to start.");
    if (now.getTime() > party.startAt.getTime() + 7 * DAY_MS)
      throw conflict("REPORT_WINDOW_CLOSED", "No-show reports must be submitted within 7 days of the game.");
    if (userId === host.id) throw conflict("CANNOT_REPORT_HOST", "Host cannot report themselves.");
    const [member] = await tx.select({
      role: partyMembers.role, state: partyMembers.state, leftAt: partyMembers.leftAt,
      noShow: partyMembers.noShow,
    }).from(partyMembers).where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)));
    if (!member || member.role === "HOST" ||
        (member.state !== "ACTIVE" && !(member.state === "LEFT" && member.leftAt && member.leftAt > party.startAt)))
      throw conflict("NOT_ELIGIBLE", "Only someone who was still participating at the game start can be marked absent.");
    if (member.noShow) throw conflict("NO_SHOW_ALREADY_RECORDED", "No-show was already recorded.");
    // Serialize across reports from different hosts, and across cancellations for this user.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    await tx.update(partyMembers).set({ noShow: true }).where(and(
      eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)));
    const scored = await registerAttendanceIncident(tx, userId, partyId, "NO_SHOW", party.startAt, party.startAt);
    return { userId, ...scored };
  });
}

/** Private self-service endpoint; profile UI belongs to workstream A. */
export async function myAttendance(userId: string) {
  const now = new Date();
  const [incidents, suspensions] = await Promise.all([
    db.select({ id: attendanceIncidents.id, partyTitle: attendanceIncidents.partyTitle,
      type: attendanceIncidents.type, pointsHalfUnits: attendanceIncidents.pointsHalfUnits,
      occurredAt: attendanceIncidents.occurredAt, appliedSuspensionId: attendanceIncidents.appliedSuspensionId,
      revokedAt: attendanceIncidents.revokedAt })
      .from(attendanceIncidents).where(eq(attendanceIncidents.userId, userId))
      .orderBy(desc(attendanceIncidents.occurredAt)).limit(100),
    db.select().from(attendanceSuspensions).where(eq(attendanceSuspensions.userId, userId))
      .orderBy(desc(attendanceSuspensions.startsAt)).limit(50),
  ]);
  const activePoints = incidents.filter(x=>!x.revokedAt && !x.appliedSuspensionId &&
    x.occurredAt >= new Date(now.getTime() - 30 * DAY_MS))
    .reduce((sum,x)=>sum+x.pointsHalfUnits,0)/2;
  const currentBan = suspensions.find(x=>!x.revokedAt && x.startsAt <= now && x.endsAt > now);
  return { activePoints, threshold: 3, incidents, suspensions, suspendedUntil: currentBan?.endsAt ?? null };
}

/** Admin-only list; workstream A connects it to its dashboard. */
export async function adminAttendanceReports() {
  const incidents = await db.select({ id: attendanceIncidents.id, userId: attendanceIncidents.userId,
    nickname: users.nickname, partyId: attendanceIncidents.partyId,
    partyTitle: attendanceIncidents.partyTitle, partyStartAt: attendanceIncidents.partyStartAt,
    kind: attendanceIncidents.type, pointsHalfUnits: attendanceIncidents.pointsHalfUnits,
    occurredAt: attendanceIncidents.occurredAt, createdAt: attendanceIncidents.createdAt,
    appliedSuspensionId: attendanceIncidents.appliedSuspensionId,
    revokedAt: attendanceIncidents.revokedAt, reviewReason: attendanceIncidents.reviewReason })
    .from(attendanceIncidents).innerJoin(users, eq(users.id, attendanceIncidents.userId))
    .orderBy(desc(attendanceIncidents.createdAt)).limit(100);
  return { incidents };
}

/** Reversing a disputed incident also removes an unsupported suspension. */
export async function reverseIncident(admin: AuthUser, incidentId: string, reason: string) {
  if (admin.role !== "ADMIN") throw forbidden("Admins only.");
  return db.transaction(async (tx) => {
    const [pre] = await tx.select({ userId: attendanceIncidents.userId })
      .from(attendanceIncidents).where(eq(attendanceIncidents.id, incidentId));
    if (!pre) throw notFound("Attendance report");
    await tx.select({ id: users.id }).from(users).where(eq(users.id, pre.userId)).for("update");
    const [incident] = await tx.select().from(attendanceIncidents)
      .where(eq(attendanceIncidents.id, incidentId)).for("update");
    if (incident.revokedAt) throw conflict("ALREADY_REVERSED", "Report already reversed.");
    await tx.update(attendanceIncidents).set({ revokedAt: new Date(), revokedById: admin.id,
      reviewReason: reason }).where(eq(attendanceIncidents.id, incidentId));
    if (incident.type === "NO_SHOW" && incident.partyId) {
      await tx.update(partyMembers).set({ noShow: false }).where(and(
        eq(partyMembers.partyId, incident.partyId), eq(partyMembers.userId, incident.userId)));
      // If this no-show superseded a late cancellation, restore the still-valid
      // 0.5-point late cancellation when the admin reverses the no-show.
      await tx.update(attendanceIncidents).set({
        revokedAt: null, revokedById: null, reviewReason: null,
      }).where(and(eq(attendanceIncidents.userId, incident.userId),
        eq(attendanceIncidents.partyId, incident.partyId),
        eq(attendanceIncidents.type, "LATE_CANCEL"),
        eq(attendanceIncidents.reviewReason, "Automatically superseded by confirmed no-show")));
    }
    let suspensionRevoked = false;
    if (incident.appliedSuspensionId) {
      const remaining = await tx.select({ points: attendanceIncidents.pointsHalfUnits })
        .from(attendanceIncidents)
        .where(and(eq(attendanceIncidents.appliedSuspensionId, incident.appliedSuspensionId),
          isNull(attendanceIncidents.revokedAt)));
      if (remaining.reduce((n,x)=>n+x.points,0) < 6) {
        await tx.update(attendanceSuspensions).set({ revokedAt: new Date(), revokedById: admin.id })
          .where(eq(attendanceSuspensions.id, incident.appliedSuspensionId));
        // Remaining points become eligible again; no penalty is issued until the next incident.
        await tx.update(attendanceIncidents).set({ appliedSuspensionId: null })
          .where(and(eq(attendanceIncidents.appliedSuspensionId, incident.appliedSuspensionId),
            isNull(attendanceIncidents.revokedAt)));
        suspensionRevoked = true;
      }
    }
    return { reversed: true, suspensionRevoked };
  });
}

export async function liftSuspensions(admin: AuthUser, userId: string) {
  if (admin.role !== "ADMIN") throw forbidden("Admins only.");
  const lifted = await db.update(attendanceSuspensions).set({
    revokedAt: new Date(), revokedById: admin.id,
  }).where(and(eq(attendanceSuspensions.userId, userId),
    gte(attendanceSuspensions.endsAt, new Date()), isNull(attendanceSuspensions.revokedAt)))
    .returning({ id: attendanceSuspensions.id });
  return { lifted: lifted.length };
}
