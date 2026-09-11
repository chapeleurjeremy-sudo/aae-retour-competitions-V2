const COMMON = [
  ['Organisation générale','rating','organisation'],
  ['Accueil et prise en charge','rating','accueil'],
  ['Informations avant et pendant la compétition','rating','communication'],
  ['Formule sportive','rating','formule'],
  ['Déroulement et respect des horaires','rating','horaires'],
  ['Installations et équipements','rating','installations'],
  ['Hébergement','rating_na','hebergement'],
  ['Restauration','rating_na','restauration'],
  ['Recommanderiez-vous cette compétition ?','yesno','recommandation'],
  ['Note globale de la compétition /10','overall','global'],
  ['Votre principale piste d’amélioration','text','amelioration'],
  ['Une remarque ou suggestion complémentaire ?','text','commentaire']
];

const HEADERS = {
  'cache-control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-admin-token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};
const json = (x, status=200) => new Response(JSON.stringify(x), {status, headers:{...HEADERS,'content-type':'application/json; charset=utf-8'}});
const clean = (x,n=500) => String(x ?? '').trim().slice(0,n);
const ratingOk = x => ['1','2','3','4','5'].includes(String(x));
const ratingNaOk = x => ratingOk(x) || String(x)==='non_utilise';
const overallOk = x => Number.isInteger(Number(x)) && Number(x)>=0 && Number(x)<=10;
function auth(request, env){ return !!env.ADMIN_TOKEN && request.headers.get('x-admin-token') === env.ADMIN_TOKEN; }

async function ensureDb(env){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, year INTEGER NOT NULL, discipline TEXT NOT NULL, name TEXT NOT NULL, organizer TEXT, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, competition_id TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL, domain TEXT, position INTEGER NOT NULL, FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY AUTOINCREMENT, competition_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, response_id INTEGER NOT NULL, question_id INTEGER, value TEXT NOT NULL, FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE, FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitions_year ON competitions(year)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_competitions_discipline ON competitions(discipline)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_responses_competition ON responses(competition_id)`)
  ]);
}

async function report(env,id){
  const competition=await env.DB.prepare('SELECT * FROM competitions WHERE id=?').bind(id).first();
  if(!competition) return null;
  const questions=(await env.DB.prepare('SELECT * FROM questions WHERE competition_id=? ORDER BY position').bind(id).all()).results;
  const rows=(await env.DB.prepare('SELECT a.question_id,a.value FROM answers a JOIN responses r ON r.id=a.response_id WHERE r.competition_id=?').bind(id).all()).results;
  const stats={};
  for(const q of questions) stats[q.id]={...q,sum:0,n:0,vals:[]};
  for(const a of rows){
    if(!stats[a.question_id]) continue;
    const s=stats[a.question_id]; s.vals.push(a.value);
    if(qRating(s.type,a.value)){ s.sum += Number(a.value); s.n++; }
  }
  const domain={};
  for(const s of Object.values(stats)) if(s.domain && s.n){ domain[s.domain] ??= {sum:0,n:0}; domain[s.domain].sum += s.sum; domain[s.domain].n += s.n; }
  const domainAvg=Object.fromEntries(Object.entries(domain).map(([k,v])=>[k,+(v.sum/v.n).toFixed(2)]));
  const recommendation=stats[questions.find(q=>q.domain==='recommandation')?.id];
  const recommendationRate=recommendation?.vals.length ? Math.round(recommendation.vals.filter(v=>v==='oui').length*100/recommendation.vals.length) : 0;
  const global=stats[questions.find(q=>q.domain==='global')?.id];
  const overall10=global?.vals.length ? +(global.vals.reduce((a,v)=>a+Number(v),0)/global.vals.length).toFixed(1) : 0;
  const vals=Object.entries(domainAvg).filter(([k])=>!['recommandation','global'].includes(k));
  const strengths=[...vals].sort((a,b)=>b[1]-a[1]).slice(0,3);
  const improvements=[...vals].sort((a,b)=>a[1]-b[1]).slice(0,3);
  const responseCount=Number((await env.DB.prepare('SELECT COUNT(*) n FROM responses WHERE competition_id=?').bind(id).first()).n || 0);
  return {competition,responseCount,domainAvg,overall10,recommendationRate,strengths,improvements,questions};
}
function qRating(type,value){ return type==='rating' || type==='rating_na' ? ratingOk(value) : false; }

export default {
  async fetch(request, env){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:HEADERS});
    try{
      await ensureDb(env);
      const url=new URL(request.url), path=url.pathname;

      if(path==='/api/competition' && request.method==='GET'){
        const id=clean(url.searchParams.get('id'),40);
        const c=await env.DB.prepare('SELECT * FROM competitions WHERE id=?').bind(id).first();
        if(!c) return json({error:'Compétition introuvable'},404);
        return json({competition:c,questions:(await env.DB.prepare('SELECT id,label,type,domain,position FROM questions WHERE competition_id=? ORDER BY position').bind(id).all()).results});
      }

      if(path==='/api/response' && request.method==='POST'){
        const b=await request.json(), id=clean(b.competition_id,40);
        if(!await env.DB.prepare('SELECT id FROM competitions WHERE id=?').bind(id).first()) return json({error:'Compétition introuvable'},404);
        const answers=Array.isArray(b.answers)?b.answers.slice(0,30):[];
        if(!answers.length) return json({error:'Aucune réponse'},400);
        const inserted=await env.DB.prepare('INSERT INTO responses(competition_id,created_at) VALUES(?,?)').bind(id,new Date().toISOString()).run();
        const rid=inserted.meta.last_row_id;
        for(const item of answers){
          const q=await env.DB.prepare('SELECT type FROM questions WHERE id=? AND competition_id=?').bind(Number(item.question_id),id).first();
          if(!q) continue;
          const value=clean(item.value,1000);
          const valid=q.type==='rating'?ratingOk(value):q.type==='rating_na'?ratingNaOk(value):q.type==='yesno'?['oui','non'].includes(value):q.type==='overall'?overallOk(value):q.type==='text';
          if(valid) await env.DB.prepare('INSERT INTO answers(response_id,question_id,value) VALUES(?,?,?)').bind(rid,Number(item.question_id),value).run();
        }
        return json({success:true},201);
      }

      if(path==='/api/admin/competitions' && request.method==='GET'){
        if(!auth(request,env)) return json({error:'Non autorisé'},401);
        return json({competitions:(await env.DB.prepare('SELECT * FROM competitions ORDER BY year DESC,created_at DESC').all()).results});
      }

      if(path==='/api/admin/competition' && request.method==='POST'){
        if(!auth(request,env)) return json({error:'Non autorisé'},401);
        const b=await request.json(), year=Number(b.year), discipline=clean(b.discipline,80), name=clean(b.name,120), organizer=clean(b.organizer,120);
        if(!Number.isInteger(year)||year<2020||year>2100||!discipline||!name) return json({error:'Champs obligatoires invalides'},400);
        const id=clean(b.id||`${discipline.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)}-${year}-${crypto.randomUUID().slice(0,5)}`,40);
        try{ await env.DB.prepare('INSERT INTO competitions(id,year,discipline,name,organizer,created_at) VALUES(?,?,?,?,?,?)').bind(id,year,discipline,name,organizer,new Date().toISOString()).run(); }
        catch(e){ return json({error:'ID de compétition déjà utilisé'},409); }
        let position=1;
        for(const q of COMMON) await env.DB.prepare('INSERT INTO questions(competition_id,label,type,domain,position) VALUES(?,?,?,?,?)').bind(id,q[0],q[1],q[2],position++).run();
        for(const q of (Array.isArray(b.customQuestions)?b.customQuestions.slice(0,3):[])){ const v=clean(q,180); if(v) await env.DB.prepare('INSERT INTO questions(competition_id,label,type,domain,position) VALUES(?,?,?,?,?)').bind(id,v,'rating','specifique',position++).run(); }
        return json({success:true,id},201);
      }

      if(path==='/api/admin/results' && request.method==='GET'){
        if(!auth(request,env)) return json({error:'Non autorisé'},401);
        const s=await report(env,clean(url.searchParams.get('id'),40)); return s?json(s):json({error:'Compétition introuvable'},404);
      }

      if(path==='/api/admin/national' && request.method==='GET'){
        if(!auth(request,env)) return json({error:'Non autorisé'},401);
        const year=url.searchParams.get('year'), discipline=url.searchParams.get('discipline');
        let sql='SELECT id,year,discipline,name FROM competitions WHERE 1=1',args=[];
        if(year){sql+=' AND year=?';args.push(Number(year));} if(discipline){sql+=' AND discipline=?';args.push(clean(discipline,80));}
        sql+=' ORDER BY year DESC,discipline,name';
        const cs=(await env.DB.prepare(sql).bind(...args).all()).results, out=[];
        for(const c of cs){const s=await report(env,c.id);out.push({id:c.id,year:c.year,discipline:c.discipline,name:c.name,responseCount:s.responseCount,overall10:s.overall10,recommendationRate:s.recommendationRate});}
        return json({competitions:out});
      }

      if(path==='/api/admin/export' && request.method==='GET'){
        if(!auth(request,env)) return json({error:'Non autorisé'},401);
        const id=clean(url.searchParams.get('id'),40), s=await report(env,id); if(!s) return json({error:'Compétition introuvable'},404);
        const rows=(await env.DB.prepare('SELECT q.label,q.domain,a.value FROM answers a JOIN responses r ON r.id=a.response_id JOIN questions q ON q.id=a.question_id WHERE r.competition_id=? ORDER BY a.id').bind(id).all()).results;
        let csv='question;domaine;valeur\n'; for(const x of rows) csv += `"${x.label.replaceAll('"','""')}";"${x.domain||''}";"${String(x.value).replaceAll('"','""')}"\n`;
        return new Response(csv,{headers:{...HEADERS,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${id}.csv"`}});
      }

      if(path.startsWith('/api/')) return json({error:'Route inconnue'},404);
      return env.ASSETS.fetch(request);
    }catch(error){ return json({error:error?.message||'Erreur serveur'},500); }
  }
};
