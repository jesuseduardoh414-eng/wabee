UPDATE core.plan_versions SET stripe_price_monthly_id = NULL WHERE stripe_price_monthly_id = '';
UPDATE core.plan_versions SET stripe_price_annual_id = NULL WHERE stripe_price_annual_id = '';
