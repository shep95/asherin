DELETE FROM public.account_activity_log WHERE description = 'Live verification of security device alerts.';
DELETE FROM public.intel_notifications WHERE kind = 'security' AND body = 'Live verification of security device alerts.';
DELETE FROM public.push_subscriptions WHERE endpoint LIKE '%httpbin%';