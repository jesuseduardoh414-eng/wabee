-- Add soft delete support to PlanTemplate
ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ(6);

-- Optionally, you can add an index if you perform heavy filtering by deleted_at
CREATE INDEX IF NOT EXISTS idx_plan_templates_deleted_at ON core.plan_templates(deleted_at);
