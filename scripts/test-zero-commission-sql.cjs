// Run with KYNTU_SQL_TEST_MODULE pointing to a temporary @electric-sql/pglite installation.
const { PGlite } = require(process.env.KYNTU_SQL_TEST_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const test = require('node:test');
const migration = fs.readFileSync('supabase/migrations/20260916000000_comision_cero_global.sql', 'utf8');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('global migration fixes pending purchases, preserves settled money, and creates future purchases at zero commission', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${uuid(999)}'::uuid $$;
      CREATE TABLE listas (id uuid PRIMARY KEY, usuario_id uuid);
      CREATE TABLE listas_compras (id uuid PRIMARY KEY, lista_id uuid, usuario_id uuid, cantidad bigint);
      CREATE TABLE ofertas_productos (id uuid PRIMARY KEY, lista_id uuid, proveedor_id uuid,
        estado text, precio_ofertado numeric, producto text, formato text, marca text);
      CREATE TABLE ordenes_checkout (id uuid PRIMARY KEY, comprador_auth_id uuid, estado text,
        total_ofertas numeric, total_comision numeric, total_pagar numeric, idempotency_key text,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE ordenes_checkout_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orden_id uuid,
        oferta_id uuid, proveedor_id uuid, lista_compras_id uuid, producto_snapshot text,
        formato_snapshot text, marca_snapshot text, cantidad_snapshot bigint, monto_oferta numeric,
        comision_kyntu numeric, impuesto_snapshot numeric, total_item numeric, estado_item text,
        created_at timestamptz DEFAULT now());
      CREATE TABLE pagos (id bigserial PRIMARY KEY, oferta_id uuid, proveedor_id uuid, orden_id uuid,
        monto_oferta numeric, comision_kyntu numeric, total_pagado numeric, estado_pago text,
        fecha_pago timestamptz, mercadopago_preference_id text, mercadopago_payment_id text,
        fintoc_payment_id text, fintoc_checkout_id text);
      CREATE TABLE payment_orders (id uuid PRIMARY KEY, checkout_order_id uuid, provider text, status text,
        paid_at timestamptz, provider_payment_id text, external_id text, provider_payload jsonb,
        subtotal bigint, commission bigint, total bigint, updated_at timestamptz DEFAULT now());
      CREATE TABLE payment_order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid,
        offer_id uuid, amount bigint, commission bigint, total bigint, provider_net bigint);
      CREATE TABLE provider_payouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_order_id uuid);
      CREATE TABLE adjudicacion_eventos (oferta_id uuid,evento text,actor_auth_id uuid,metadata jsonb);
      CREATE FUNCTION es_dueno_lista_compras(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    `);

    // 1 open; 2 confirmed; 3 pending transfer; 4 paid; 5 gateway processing;
    // 6 referenced transfer; 7 payout exists; 8 mixed paid/unpaid group; 9 direct transfer.
    for (let n = 1; n <= 9; n++) {
      await db.exec(`
        INSERT INTO listas_compras VALUES ('${uuid(n)}',NULL,'${uuid(n + 900)}',5);
        INSERT INTO ofertas_productos VALUES ('${uuid(n)}','${uuid(n)}','${uuid(800)}','pendiente_pago',5500,'Producto','1L','Marca');
        INSERT INTO ordenes_checkout VALUES ('${uuid(n)}','${uuid(n + 900)}','${n === 1 ? 'abierta' : 'confirmada'}',5500,52,5552,'${n}');
        INSERT INTO ordenes_checkout_items(orden_id,oferta_id,monto_oferta,comision_kyntu,total_item,estado_item)
          VALUES ('${uuid(n)}','${uuid(n)}',5500,52,5552,'${n === 1 ? 'incluido' : 'confirmado'}');
        INSERT INTO pagos(oferta_id,orden_id,monto_oferta,comision_kyntu,total_pagado,estado_pago)
          VALUES ('${uuid(n)}','${uuid(n)}',5500,52,5552,'${n === 4 ? 'pagado' : 'pendiente'}');
      `);
      if (n >= 3) await db.exec(`
        INSERT INTO payment_orders(id,checkout_order_id,provider,status,subtotal,commission,total,provider_payment_id)
          VALUES ('${uuid(n)}',${n === 9 ? 'NULL' : `'${uuid(n)}'`},'${n === 5 ? 'mercadopago' : 'transferencia'}',
            '${n === 4 ? 'approved' : n === 5 ? 'processing' : 'pending'}',5500,52,5552,${n === 6 ? "'BANK-REF'" : 'NULL'});
        INSERT INTO payment_order_items(order_id,offer_id,amount,commission,total,provider_net)
          VALUES ('${uuid(n)}','${uuid(n)}',5500,52,5552,5448);
      `);
    }
    await db.exec(`
      INSERT INTO provider_payouts(payment_order_id) VALUES ('${uuid(7)}');
      INSERT INTO payment_order_items(order_id,offer_id,amount,commission,total,provider_net)
        VALUES ('${uuid(8)}','${uuid(4)}',5500,52,5552,5448);
    `);
    const rows = async sql => (await db.query(sql)).rows;
    const protectedBefore = await rows(`SELECT to_jsonb(o) AS row FROM ordenes_checkout o WHERE id BETWEEN '${uuid(4)}' AND '${uuid(8)}' ORDER BY id`);
    await db.exec(migration);
    for (const n of [1,2,3,9]) {
      assert.deepEqual(await rows(`SELECT total_ofertas,total_comision,total_pagar FROM ordenes_checkout WHERE id='${uuid(n)}'`),
        [{total_ofertas:'5500',total_comision:'0',total_pagar:'5500'}]);
      assert.equal((await rows(`SELECT total_pagado FROM pagos WHERE oferta_id='${uuid(n)}'`))[0].total_pagado,'5500');
    }
    for (const n of [3,9]) {
      const [p] = await rows(`SELECT commission,total FROM payment_orders WHERE id='${uuid(n)}'`);
      assert.equal(Number(p.commission),0); assert.equal(Number(p.total),5500);
      const [i] = await rows(`SELECT provider_net FROM payment_order_items WHERE order_id='${uuid(n)}'`);
      assert.equal(Number(i.provider_net),5500);
    }
    assert.deepEqual(await rows(`SELECT to_jsonb(o) AS row FROM ordenes_checkout o WHERE id BETWEEN '${uuid(4)}' AND '${uuid(8)}' ORDER BY id`),protectedBefore);
    assert.equal(Number((await rows(`SELECT total FROM payment_orders WHERE id='${uuid(4)}'`))[0].total),5552);
    const auditBefore = await rows('SELECT * FROM ajustes_comision_mvp_auditoria ORDER BY tabla,registro_id');
    await db.exec(migration);
    assert.deepEqual(await rows('SELECT * FROM ajustes_comision_mvp_auditoria ORDER BY tabla,registro_id'),auditBefore);

    // Real function execution: multiple products, ownership, duplicate checkout and legacy entry point.
    for (const n of [20,21,22]) await db.exec(`
      INSERT INTO listas_compras VALUES ('${uuid(n)}',NULL,'${uuid(999)}',5);
      INSERT INTO ofertas_productos VALUES ('${uuid(n)}','${uuid(n)}','${uuid(800)}','pendiente_pago',${n===21?4800:5500},'Producto','1L','Marca');
    `);
    const [created] = await rows(`SELECT * FROM crear_orden_checkout(ARRAY['${uuid(20)}','${uuid(21)}']::uuid[])`);
    assert.equal(Number(created.total_comision),0); assert.equal(Number(created.total_pagar),10300);
    const [reused] = await rows(`SELECT * FROM crear_orden_checkout(ARRAY['${uuid(21)}','${uuid(20)}']::uuid[])`);
    assert.equal(reused.orden_id,created.orden_id); assert.equal(reused.fue_idempotente,true);
    const [legacy] = await rows(`SELECT * FROM obtener_o_crear_pago_pendiente('${uuid(22)}')`);
    assert.equal(Number(legacy.comision_kyntu),0); assert.equal(Number(legacy.total_pagado),5500);
    // An already awarded product cannot be used to create another checkout after confirmation.
    await db.exec(`UPDATE ordenes_checkout SET estado='confirmada' WHERE id='${created.orden_id}';
      UPDATE ordenes_checkout_items SET estado_item='confirmado' WHERE orden_id='${created.orden_id}';`);
    await assert.rejects(rows(`SELECT * FROM crear_orden_checkout(ARRAY['${uuid(20)}']::uuid[])`),/preparada para pago/);
  } finally { await db.close(); }
});
