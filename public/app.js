const API_BASE=(window.API_BASE||'').replace(/\/$/,'');
const DEMO_KEY='aae_v2_demo';
let surveyData=null;
let answers={};

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function api(path,opt={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  return fetch(API_BASE+path,{...opt,signal:controller.signal})
    .then(async r=>{
      const text=await r.text();
      let body=text; try{body=JSON.parse(text)}catch{}
      if(!r.ok) throw new Error(body?.error||`Erreur HTTP ${r.status}`);
      return body;
    })
    .finally(()=>clearTimeout(timer));
}
function demoGet(id){try{const d=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}');return d[id]}catch{return null}}
function demoSave(x){const d=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}');d[x.id]=x;localStorage.setItem(DEMO_KEY,JSON.stringify(d));}
function showStatus(message,type='notice'){
  const el=document.getElementById('status');
  el.className=`notice ${type}`;
  el.textContent=message;
}
function clearStatus(){document.getElementById('status').className='notice hidden';}
function questionFallback(){
  return [
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
  ].map((q,i)=>({id:i+1,label:q[0],type:q[1],domain:q[2],position:i+1}));
}
function demoCreate(b){
  const id=(b.id||b.discipline.replace(/\W/g,'').toUpperCase().slice(0,8))+'-'+b.year+'-'+Math.random().toString(36).slice(2,6);
  const qs=questionFallback();
  (b.customQuestions||[]).forEach(x=>qs.push({id:qs.length+1,label:x,type:'rating',domain:'specifique',position:qs.length+1}));
  const c={id,year:b.year,discipline:b.discipline,name:b.name,organizer:b.organizer,questions:qs,responses:[]};
  demoSave(c);return c;
}
function updateProgress(){
  if(!surveyData?.questions?.length)return;
  const done=surveyData.questions.filter(q=>answers[q.id]!==undefined&&String(answers[q.id]).trim()!=='').length;
  document.getElementById('prog').style.width=Math.round(done/surveyData.questions.length*100)+'%';
}
function pick(id,value,el){
  answers[id]=value;
  const parent=el.closest('.answer-group')||el.parentElement;
  parent.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
  el.classList.add('active');
  updateProgress();
}
function renderSurvey(d){
  surveyData=d;answers={};clearStatus();
  const c=d.competition||{};
  document.getElementById('title').textContent=c.name||'Votre avis compte';
  document.getElementById('sub').textContent=`${c.discipline||''} · ${c.year||''} · Votre avis est anonyme`;
  const questions=Array.isArray(d.questions)?d.questions:[];
  if(!questions.length){showStatus('Aucune question n’a été trouvée pour cette compétition.','notice');return;}
  let html='';
  questions.forEach((q,i)=>{
    html+=`<section class="card q"><h3>${i+1}. ${esc(q.label)}</h3>`;
    if(q.type==='rating'||q.type==='rating_na'){
      html+=`<div class="rating answer-group">${[1,2,3,4,5].map(n=>`<button type="button" onclick="pick(${q.id},'${n}',this)">${n}</button>`).join('')}</div>`;
      if(q.type==='rating_na') html+=`<button class="na answer-group" type="button" onclick="pick(${q.id},'non_utilise',this)">Non utilisé</button>`;
      html+=`<div class="muted">1 = très insatisfait · 5 = très satisfait${q.type==='rating_na'?' · ou Non utilisé':''}</div>`;
    }else if(q.type==='overall'){
      html+=`<div class="rating ten answer-group">${Array.from({length:11},(_,n)=>`<button type="button" onclick="pick(${q.id},'${n}',this)">${n}</button>`).join('')}</div><div class="muted">0 = très mauvais · 10 = excellent</div>`;
    }else if(q.type==='yesno'){
      html+=`<div class="yn answer-group"><button type="button" onclick="pick(${q.id},'oui',this)">Oui</button><button type="button" onclick="pick(${q.id},'non',this)">Non</button></div>`;
    }else{
      html+=`<textarea maxlength="1000" placeholder="Votre réponse…" oninput="answers[${q.id}]=this.value;updateProgress()"></textarea>`;
    }
    html+='</section>';
  });
  html+=`<div class="card"><button class="btn" onclick="submitSurvey()">Envoyer mon avis</button><p class="muted">Aucune donnée d’identité ou donnée opérationnelle n’est demandée.</p></div>`;
  document.getElementById('app').innerHTML=html;updateProgress();
}
async function submitSurvey(){
  const missing=surveyData.questions.filter(q=>answers[q.id]===undefined||String(answers[q.id]).trim()==='');
  if(missing.length){
    alert('Merci de répondre à toutes les questions.');
    const index=surveyData.questions.indexOf(missing[0]);
    document.querySelectorAll('.q')[index]?.scrollIntoView({behavior:'smooth',block:'center'});return;
  }
  const payload={competition_id:surveyData.competition.id,answers:Object.entries(answers).map(([question_id,value])=>({question_id:Number(question_id),value}))};
  try{
    await api('/api/response',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  }catch(e){
    const d=demoGet(surveyData.competition.id)||{...surveyData.competition,questions:surveyData.questions,responses:[]};
    d.responses=d.responses||[];d.responses.push({...answers});demoSave(d);
    showStatus('Mode démonstration local : la réponse n’a pas été envoyée au serveur.','notice');
  }
  document.getElementById('app').innerHTML='<div class="card success"><h2>Merci pour votre participation !</h2><p>Votre retour sera intégré au bilan de la compétition.</p></div>';
  document.getElementById('prog').style.width='100%';
}
async function loadSurvey(){
  const qs=new URLSearchParams(location.search);
  const id=qs.get('competition');
  if(!id){showStatus('Lien de questionnaire incomplet : aucun identifiant de compétition n’est présent.','notice');document.getElementById('app').innerHTML='<div class="card"><h2>Questionnaire indisponible</h2><p>Utilisez le QR code ou le lien fourni par l’organisateur.</p></div>';return;}
  try{
    const data=await api('/api/competition?id='+encodeURIComponent(id));
    renderSurvey(data);
  }catch(e){
    const local=demoGet(id);
    if(local){renderSurvey(local);showStatus('Mode démonstration local activé.','notice');return;}
    document.getElementById('app').innerHTML='<div class="card"><h2>Questionnaire indisponible</h2><p id="err">Impossible de charger les questions.</p><button class="btn" onclick="loadSurvey()">Réessayer</button></div>';
    document.getElementById('err').textContent=`Erreur : ${e.message}`;
  }
}

// Administration helpers
async function adminCreate(b,token){
  return api('/api/admin/competition',{method:'POST',headers:{'content-type':'application/json','x-admin-token':token},body:JSON.stringify(b)});
}

if(location.pathname.endsWith('/index.html')||location.pathname==='/'||!location.pathname.includes('.html')) loadSurvey();
