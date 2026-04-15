-- Migration: 00035_account_deletion_request.sql
--
-- Purpose: Add account_deletion_requests table for GDPR soft-delete flow.
-- Users request deletion; super_admin reviews, approves (hard-delete), or rejects.

CREATE TABLE public.account_deletion_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Only one pending request per user at a time (idempotency guard)
CREATE UNIQUE INDEX idx_account_deletion_requests_one_pending_per_user
  ON public.account_deletion_requests(user_id)
  WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Owner can submit a deletion request
CREATE POLICY "owner_insert_deletion_request"
  ON public.account_deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- super_admin can read all deletion requests
CREATE POLICY "super_admin_read_deletion_requests"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'super_admin');

-- Owner can read their own request (to confirm submission / check status)
CREATE POLICY "owner_select_own_deletion_request"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- super_admin can update status (approve / reject)
CREATE POLICY "super_admin_update_deletion_requests"
  ON public.account_deletion_requests FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');
