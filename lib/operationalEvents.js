// Deliberately closed schema: never serialize Error, request, URL, form or session.
const events=new Set(['source_unavailable','request_error','database_failure','slow_response','api_failure','client_error','contact_failure']);
const sources=new Set(['works','issues','indicators','figures','companies','professionals','universities','medical_centers','sections','places','settings','rankings','debates','contentPages','statSections','statIndicators','database','network','page','api','contact','client','prices']);
const routes=['/api/admin/rankings/refresh','/api/admin/editors','/api/admin/debates','/api/admin/figures','/api/admin/inline','/api/admin/pages','/api/admin/rankings','/api/admin/tasks','/api/contact','/api/account','/api/debates','/api/rankings','/api/telemetry','/sitemap.xml','/yemen-in-numbers/timeline','/yemen-in-numbers','/yemeni-products','/yemen-ranking','/yemen-map/figures','/yemen-map','/professionals','/forgot-password','/update-password','/contribute','/magazine','/debates/speakers','/debates','/register','/account','/search','/works','/login','/admin','/'];
export function operationalRoute(value){
 const pathname=String(value||'').split(/[?#]/,1)[0];
 return routes.find(route=>pathname===route)||routes.filter(route=>route!=='/'&&pathname.startsWith(route+'/')).map(route=>route+'/[record]')[0]||'unknown';
}
export function operationalEvent(event,fields={}){
 if(!events.has(event))return null;
 const output={event,time:new Date().toISOString()};
 if(sources.has(fields.source))output.source=fields.source;
 if(fields.route)output.route=operationalRoute(fields.route);
 if(Number.isInteger(fields.status)&&fields.status>=100&&fields.status<=599)output.status=fields.status;
 if(Number.isFinite(fields.durationMs))output.durationMs=Math.round(Math.min(3600000,Math.max(0,fields.durationMs)));
 if(['error','unhandledrejection'].includes(fields.kind))output.kind=fields.kind;
 if(['search','sitemap'].includes(fields.area))output.area=fields.area;
 return output;
}
export function recordOperationalEvent(event,fields={},sink=console.warn){
 const entry=operationalEvent(event,fields);if(entry)sink(JSON.stringify(entry));return entry;
}
