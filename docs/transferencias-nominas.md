# Transferencias a Kyntü y nóminas

Aplicar `supabase/migrations/20260909100000_transferencias_nominas.sql` antes de desplegar el código. Requiere las migraciones anteriores de checkout, payment_orders y provider_payouts. Las funciones nuevas son exclusivas de service_role; las APIs validan al comprador o al master.

- El comprador confirma su carrito y obtiene una referencia y el total para transferir a BancoEstado, Chequera Electrónica 90270587550, Sociedad De Asesorias E Inversiones Telos Spa, RUT 77.407.228-4.
- `/checkout/transferencia` permite recuperar sus órdenes iniciadas. Una selección idéntica reutiliza la orden; una selección superpuesta se bloquea.
- En `/master/transferencias`, el operador verifica el abono real, ingresa el monto exacto y la referencia bancaria. Se actualizan compra y fondos retenidos en una sola transacción. La misma referencia bancaria no puede acreditar dos órdenes.
- Corte provisional: abonos **confirmados** hasta el miércoles a las 23:59:59, zona America/Santiago. Lo confirmado el jueves entra al jueves siguiente. No hay ajustes automáticos por feriados.
- Cada jueves, el operador prepara la nómina desde `/master/liquidaciones`. Se reservan las liquidaciones vencidas sin nómina previa y se guardan los datos bancarios utilizados. Se bloquea la preparación si faltan datos bancarios.
- El CSV agrupa por proveedor y cuenta. Es un resumen operativo, no una plantilla certificada de importación bancaria. Para carga masiva directa se necesita el formato del convenio bancario de la empresa.
- Tras transferir en el banco, el operador registra la referencia por proveedor. Todas sus liquidaciones de esa nómina se marcan pagadas en una transacción. Descargar de nuevo conserva la nómina original, incluidos pagos registrados.

No se inician pagos nuevos con Transbank ni demo. Los callbacks históricos se conservan para transacciones que ya estaban en curso. Las órdenes antiguas pendientes que se superpongan requieren conciliación antes de intentar otra transferencia.

Validación local: `node --test scripts/test-transfer-payments.cjs` y `npm run build`. Antes de producción, probar en Supabase de ensayo la migración, confirmación duplicada, referencia reutilizada, monto incorrecto, concurrencia, corte del jueves, datos bancarios incompletos y reintentos de nómina. Las pruebas de JavaScript usan dobles de la base de datos; no ejecutan PostgreSQL.
