const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const states = ['pendiente_pago', 'en_espera_confirmacion', 'confirmada', 'pago_recibido', 'recepcion_conforme', 'pagada'];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function handler(bindings) {
  const source = fs.readFileSync('pages/api/proveedor/solicitudes-adjudicadas.js','utf8')
    .replace(/^import .*;\r?\n/gm,'').replace('export default async function','async function');
  return vm.runInNewContext(`${source};handler`, { ESTADOS_ADJUDICACION_SOLICITUD: states, console, ...bindings });
}
function res() { return {code:200, setHeader(){}, status(code){this.code=code;return this;}, json(body){this.body=body;return this;}}; }
test('availability requires a session and validates requests before accessing offers', async () => {
  let calls=0;
  const db={from(){calls++;throw Error('Unexpected access');}};
  const denied=handler({requirePaymentUser:async()=>({ok:false,status:401,error:'Unauthorized'}),supabaseAdmin:db});
  const a=res();await denied({method:'POST',body:{ids:[id(1)]}},a);assert.equal(a.code,401);
  const allowed=handler({requirePaymentUser:async()=>({ok:true}),supabaseAdmin:db});
  for(const ids of [['bad'],Array(201).fill(id(1)),null]) {
    const r=res();await allowed({method:'POST',body:{ids}},r);assert.equal(r.code,400);
  }
  assert.equal(calls,0);
});
test('winning offers of other providers close requests without exposing their data',async()=>{
  const db={from(table){
    assert.equal(table,'ofertas_productos');
    return {select(columns){assert.equal(columns,'id, lista_id');return this;},
      in(column,values){if(column==='estado')assert.deepEqual([...values],states);return this;},
      order(){return this;}, range:async()=>({data:[{id:id(9),lista_id:id(1)},{id:id(10),lista_id:id(1)}]})};
  }};
  const run=handler({requirePaymentUser:async()=>({ok:true}),supabaseAdmin:db});
  const r=res();await run({method:'POST',body:{ids:[id(1),id(2)]}},r);
  assert.equal(r.code,200);assert.equal(JSON.stringify(r.body),JSON.stringify({ids:[id(1)]}));
});
test('database failures are not reported as available requests',async()=>{
  const db={from(){return {select(){return this;},in(){return this;},order(){return this;},range:async()=>({error:{message:'offline'}})};}};
  const r=res();await handler({requirePaymentUser:async()=>({ok:true}),supabaseAdmin:db,console:{error(){}}})({method:'POST',body:{ids:[id(1)]}},r);
  assert.equal(r.code,503);assert.equal(r.body.ids,undefined);
});
function client(fetch) {
  const source=fs.readFileSync('lib/ofertaMensajes.js','utf8')
    .replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\};\r?\n/gm,'').replace(/export /g,'');
  return vm.runInNewContext(`${source};fetchSolicitudesAdjudicadasIds`,{
    ESTADOS_ADJUDICACION_SOLICITUD:states,fetch,
    supabase:{auth:{getSession:async()=>({data:{session:{access_token:'session'}}})}},
  });
}
test('client checks every request in authenticated batches, including requests beyond the first 200',async()=>{
  let calls=0;
  const run=client(async(url,options)=>{
    assert.equal(url,'/api/proveedor/solicitudes-adjudicadas');assert.equal(options.headers.Authorization,'Bearer session');
    const {ids}=JSON.parse(options.body);assert.ok(ids.length<=200);calls++;
    return {ok:true,json:async()=>({ids:ids.filter(x=>[id(1),id(201)].includes(x))})};
  });
  const result=await run(Array.from({length:201},(_,i)=>id(i+1)));
  assert.equal(calls,2);assert.deepEqual([...result],[id(1),id(201)]);
});
test('client propagates unavailable status rather than treating every request as open',async()=>{
  await assert.rejects(client(async()=>({ok:false,json:async()=>({error:'Unavailable'})}))([id(1)]),/Unavailable/);
});
