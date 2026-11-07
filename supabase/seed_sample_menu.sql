-- OPTIONAL sample data so the menu is not empty on first run. These are examples only:
-- edit or delete them from Admin > Foods / Categories. Prices are placeholders.
insert into public.categories (name, description, sort_order) values
  ('Meals', 'Full meals and combos', 1), ('Snacks', 'Quick bites', 2), ('Beverages', 'Hot and cold drinks', 3), ('Desserts', 'Sweet treats', 4)
on conflict (name) do nothing;
insert into public.food_items (category_id, name, description, price, is_veg, prep_minutes, is_featured, available_pieces)
select c.id, v.name, v.descr, v.price, v.veg, v.prep, v.feat, v.pcs from (values
  ('Meals', 'Veg Thali', 'Rice, dal, two sabzis, roti and salad', 90, true, 12, true, 20),
  ('Meals', 'Chicken Biryani', 'Fragrant rice with chicken and raita', 130, false, 15, true, 15),
  ('Snacks', 'Samosa (2 pcs)', 'Crisp potato-filled samosas', 25, true, 5, false, 35),
  ('Snacks', 'Veg Sandwich', 'Grilled with chutney', 45, true, 7, false, 25),
  ('Beverages', 'Masala Chai', 'Hot spiced tea', 15, true, 4, false, 50),
  ('Beverages', 'Cold Coffee', 'Chilled and creamy', 50, true, 5, true, 30),
  ('Desserts', 'Gulab Jamun (2 pcs)', 'Warm syrup-soaked sweets', 30, true, 3, false, 20)
) as v(cat, name, descr, price, veg, prep, feat, pcs) join public.categories c on c.name = v.cat
on conflict do nothing;
