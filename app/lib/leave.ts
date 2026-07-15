// Leave-request domain constants (Phase 2 toy flow → Phase 3 HR module).
// The entity key `hr_absences` is the custom-fields target admins already see
// in Settings → Custom fields, so a field added there flows into this form.

export const LEAVE_TYPES = ["vacation", "sick", "personal", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_CUSTOM_ENTITY = "hr_absences" as const;

/** Approval status a leave request inherits from its linked approvals row. */
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_STATUS_VARIANT: Record<LeaveStatus, "warning" | "success" | "danger" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "outline",
};
