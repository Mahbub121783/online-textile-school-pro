-- db/29 already contained this fix but it was never actually applied to the
-- live database (confirmed live: order_items_item_type_check still only
-- allowed 'course'/'ebook'/'tokens', missing 'practice_credits'). Root cause
-- of "practice credit purchase still not working" and the raw
-- "Failed to save order items: undefined" error every practice-credit
-- checkout hit (the "undefined" part was a separate bug in rest.js's error
-- response shape, fixed in the same deploy as this migration).
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_item_type_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_item_type_check
  CHECK (item_type = ANY (ARRAY['course'::text, 'ebook'::text, 'tokens'::text, 'practice_credits'::text]));
