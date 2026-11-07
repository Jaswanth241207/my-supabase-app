-- BITEQ security + business-rule checks. Run on a LOCAL or TEST database only. It creates test rows and ROLLS BACK.
--   psql "$TEST_DATABASE_URL" -f supabase/tests/rls_checks.sql   (or paste into the SQL editor of a TEST project)
-- Any failure raises an exception. "ALL BITEQ CHECKS PASSED" prints only if everything passed.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'admin@test.local', 'authenticated', 'authenticated');

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b2'; adm uuid := '00000000-0000-0000-0000-0000000000d4';
  cat uuid; f1 uuid; f2 uuid; o1 uuid; o2 uuid; o3 uuid; v_n int; v_total numeric; q1 bigint; q2 bigint; v_pos int; v_status order_status; v_pay payment_status;
begin
  perform promote_admin('admin@test.local');
  insert into categories (name) values ('T-Category') returning id into cat;
  insert into food_items (category_id, name, price, prep_minutes) values (cat, 'T-Dish-One', 100, 10) returning id into f1;
  insert into food_items (category_id, name, price, is_available) values (cat, 'T-Dish-Two', 50, false) returning id into f2;

  -- ===== anonymous role has no access =====
  execute 'set local role anon';
  begin perform count(*) from food_items; raise exception 'FAIL: anon can read menu'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  execute 'reset role';

  -- ===== customer A: cart + checkout =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  begin perform cart_set(f2, 1); raise exception 'FAIL: unavailable item added to cart'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform place_order('cash', '', 'empty-cart'); raise exception 'FAIL: order placed with empty cart'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform cart_set(f1, 2);
  o1 := place_order('cash', 'no onions', 'key-1');
  select total into v_total from orders where id = o1;
  if v_total <> 210 then raise exception 'FAIL: server total wrong (expected 210, got %)', v_total; end if;
  if place_order('cash', 'no onions', 'key-1') <> o1 then raise exception 'FAIL: duplicate checkout created a second order'; end if;
  select count(*) into v_n from orders where user_id = a; if v_n <> 1 then raise exception 'FAIL: idempotency broken'; end if;
  select count(*) into v_n from cart_items where user_id = a; if v_n <> 0 then raise exception 'FAIL: cart not cleared'; end if;
  begin insert into orders (user_id, subtotal, tax_amount, total, payment_method, idempotency_key) values (a, 1, 0, 1, 'cash', 'x'); raise exception 'FAIL: direct order insert allowed';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update orders set status = 'completed' where id = o1; raise exception 'FAIL: customer changed order status directly';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update orders set total = 1 where id = o1; raise exception 'FAIL: customer changed order total';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform admin_stats(); raise exception 'FAIL: customer can call admin_stats'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform admin_set_order_status(o1, 'confirmed'); raise exception 'FAIL: customer confirmed own order'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update profiles set role = 'admin' where id = a; raise exception 'FAIL: privilege escalation'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin insert into food_items (category_id, name, price) values (cat, 'Hack', 1); raise exception 'FAIL: customer wrote to menu'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  execute 'reset role';

  -- ===== customer B cannot see A's data; places second order =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  select count(*) into v_n from orders; if v_n <> 0 then raise exception 'FAIL: B can read A orders'; end if;
  select count(*) into v_n from order_items; if v_n <> 0 then raise exception 'FAIL: B can read A order items'; end if;
  select count(*) into v_n from payments; if v_n <> 0 then raise exception 'FAIL: B can read A payments'; end if;
  begin perform queue_info(o1); raise exception 'FAIL: B read A queue info'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform cart_set(f1, 1);
  o2 := place_order('cash', '', 'key-b1');
  execute 'reset role';

  -- ===== admin workflow =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  begin perform admin_set_order_status(o1, 'ready'); raise exception 'FAIL: skipped workflow steps'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform admin_set_order_status(o1, 'cancelled', ''); raise exception 'FAIL: cancel without reason'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform admin_set_order_status(o1, 'confirmed');
  perform admin_set_order_status(o2, 'confirmed');
  select queue_no into q1 from orders where id = o1; select queue_no into q2 from orders where id = o2;
  if q1 is null or q2 is null or q2 <= q1 then raise exception 'FAIL: FIFO queue numbers wrong (% , %)', q1, q2; end if;
  select queue_position into v_pos from queue_info(o2); if v_pos <> 2 then raise exception 'FAIL: expected queue position 2, got %', v_pos; end if;
  if (select (admin_stats() ->> 'users')::int) < 3 then raise exception 'FAIL: admin_stats users'; end if;
  execute 'reset role';

  -- ===== B cancels (allowed while confirmed); A cannot cancel after preparing =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  perform user_cancel_order(o2);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  perform admin_set_order_status(o1, 'preparing');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  begin perform user_cancel_order(o1); raise exception 'FAIL: cancelled an order that is being prepared'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  execute 'reset role';

  -- ===== complete: payment becomes paid, queue frees up =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  perform admin_set_order_status(o1, 'ready');
  perform admin_set_order_status(o1, 'completed');
  execute 'reset role';
  select status into v_status from orders where id = o1; if v_status <> 'completed' then raise exception 'FAIL: order not completed'; end if;
  select status into v_pay from payments where order_id = o1; if v_pay <> 'paid' then raise exception 'FAIL: payment not marked paid on completion'; end if;
  select status into v_pay from payments where order_id = o2; if v_pay <> 'cancelled' then raise exception 'FAIL: cancelled order payment not cancelled'; end if;

  -- ===== pending orders expire in the database =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  perform cart_set(f1, 1);
  o3 := place_order('cash', '', 'key-3');
  execute 'reset role';
  update orders set expires_at = now() - interval '1 minute' where id = o3;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); execute 'set local role authenticated';
  perform sweep_expired();
  select status into v_status from orders where id = o3; if v_status <> 'cancelled' then raise exception 'FAIL: expired order not cancelled'; end if;
  execute 'reset role';

  raise notice 'ALL BITEQ CHECKS PASSED';
end $$;
rollback;
