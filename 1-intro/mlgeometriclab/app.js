const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let seed=4,model='linreg',points=[],fitted=null,labelNoise=.0,showLabelErrors=true;
let params={iterations:50,k:5,kernel:'linear',C:1,gamma:1,clusters:3};
const plot=$('#plot'),ctx=plot.getContext('2d');

function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function gauss(){return Math.sqrt(-2*Math.log(Math.max(rnd(),1e-9)))*Math.cos(2*Math.PI*rnd())}
function sig(z){return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))}
function seededRandom(s){return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}

function stratifiedSplit(){
  const byClass={};
  points.forEach((p,i)=>(byClass[p.trueC]??=[]).push(i));
  Object.values(byClass).forEach(ids=>{
    for(let i=ids.length-1;i>0;i--){let j=Math.floor(rnd()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
    const nTrain=Math.round(ids.length*.7);
    ids.forEach((idx,j)=>points[idx].train=j<nTrain);
  });
}

function applyLabelNoise(){
  points.forEach(p=>{p.c=p.trueC;p.corrupted=false});
  if(labelNoise<=0){fit();updateLabel();resetMetrics();return}
  const candidates=points.filter(p=>p.train).sort((a,b)=>a.noiseRank-b.noiseRank);
  const n=Math.round(candidates.length*labelNoise);
  candidates.slice(0,n).forEach(p=>{p.corrupted=true;p.c=p.trueC<2?1-p.trueC:(p.trueC+1)%3});
  fit();updateLabel();resetMetrics();
}

function makeData(){
  const type=$('#dataset').value,n=120;points=[];
  for(let i=0;i<n;i++){
    let x,y,c;
    if(type==='linear'){c=i<n/2?0:1;x=gauss()*.65+(c?1.05:-1.05);y=gauss()*.65+(c?.75:-.75)}
    else if(type==='moons'){c=i%2;const t=rnd()*Math.PI;if(!c){x=Math.cos(t);y=Math.sin(t)}else{x=1-Math.cos(t);y=.45-Math.sin(t)}}
    else if(type==='circles'){c=i%2;const a=rnd()*Math.PI*2,r=c?.55:1.25;x=Math.cos(a)*r;y=Math.sin(a)*r}
    else{c=i%3;const q=[[-1,-.7],[1,-.55],[0,1]][c];x=q[0]+gauss()*.35;y=q[1]+gauss()*.35}
    points.push({x,y,trueC:c,c,train:false,corrupted:false,noiseRank:rnd()});
  }
  stratifiedSplit();applyLabelNoise();
}
const train=()=>points.filter(p=>p.train&&p.c<2);

function linearFit(kind){
  let w=[0,0],b=0,a=train();const lr=kind==='perceptron'?.1:.06,epochs=kind==='perceptron'?params.iterations:350,lambda=kind==='logreg'?1:0;
  for(let e=0;e<epochs;e++)for(const p of a){const z=w[0]*p.x+w[1]*p.y+b;if(kind==='perceptron'){const err=p.c-(z>=0?1:0);w[0]+=lr*err*p.x;w[1]+=lr*err*p.y;b+=lr*err}else{const pred=kind==='logreg'?sig(z):z,err=pred-p.c;w[0]-=lr*(err*p.x+lambda*w[0]/a.length);w[1]-=lr*(err*p.y+lambda*w[1]/a.length);b-=lr*err}}
  return{x:(x,y)=>{const z=w[0]*x+w[1]*y+b;return kind==='linreg'?(z>=.5?1:0):(z>=0?1:0)},score:(x,y)=>w[0]*x+w[1]*y+b};
}
function knnFit(){const a=train(),k=params.k;return{x:(x,y)=>{const q=a.map(p=>[p,(p.x-x)**2+(p.y-y)**2]).sort((u,v)=>u[1]-v[1]).slice(0,k);return q.reduce((s,v)=>s+v[0].c,0)>=k/2?1:0}}}
function svmFit(){
  const a=train(),rbf=params.kernel==='rbf',C=params.C,g=params.gamma;
  if(!rbf){let w=[0,0],b=0,lr=.025,lam=1/Math.max(.1,C);for(let e=0;e<280;e++)for(const p of a){const y=p.c?1:-1,z=y*(w[0]*p.x+w[1]*p.y+b);w[0]*=(1-lr*lam);w[1]*=(1-lr*lam);if(z<1){w[0]+=lr*C*y*p.x;w[1]+=lr*C*y*p.y;b+=lr*C*y}}return{x:(x,y)=>w[0]*x+w[1]*y+b>=0?1:0}}
  const alpha=new Array(a.length).fill(0),bias=0;for(let e=0;e<35;e++)for(let i=0;i<a.length;i++){let s=bias;for(let j=0;j<a.length;j++)if(alpha[j])s+=alpha[j]*(a[j].c?1:-1)*Math.exp(-g*((a[j].x-a[i].x)**2+(a[j].y-a[i].y)**2));const y=a[i].c?1:-1;if(y*s<1)alpha[i]=Math.min(C,alpha[i]+.12)}
  return{x:(x,y)=>{let s=bias;for(let j=0;j<a.length;j++)if(alpha[j])s+=alpha[j]*(a[j].c?1:-1)*Math.exp(-g*((a[j].x-x)**2+(a[j].y-y)**2));return s>=0?1:0}};
}
function kmeansFit(){const k=params.clusters,a=points.filter(p=>p.train),centers=[],r=seededRandom((seed+2000+k)>>>0);for(let i=0;i<k;i++){const p=a[Math.floor(r()*a.length)];centers.push([p.x,p.y])}let labels=[];for(let it=0;it<35;it++){labels=a.map(p=>centers.reduce((best,c,j)=>{const d=(p.x-c[0])**2+(p.y-c[1])**2;return d<best.d?{j,d}:best},{j:0,d:Infinity}).j);for(let j=0;j<k;j++){const q=a.filter((p,i)=>labels[i]===j);if(q.length)centers[j]=[q.reduce((s,p)=>s+p.x,0)/q.length,q.reduce((s,p)=>s+p.y,0)/q.length]}}const assign=(x,y)=>centers.reduce((best,c,j)=>{const d=(x-c[0])**2+(y-c[1])**2;return d<best.d?{j,d}:best},{j:0,d:Infinity}).j;return{centers,assign,labels}}
function fit(){if(model==='linreg'||model==='logreg'||model==='perceptron')fitted=linearFit(model);else if(model==='knn')fitted=knnFit();else if(model==='svm')fitted=svmFit();else fitted=kmeansFit();draw();updateInsight()}
function mapX(x){return(x+2.4)/4.8*plot.width}function mapY(y){return plot.height-(y+2.1)/4.2*plot.height}
function draw(){ctx.clearRect(0,0,plot.width,plot.height);if(fitted&&model!=='kmeans')for(let py=0;py<plot.height;py+=8)for(let px=0;px<plot.width;px+=8){const x=px/plot.width*4.8-2.4,y=(plot.height-py)/plot.height*4.2-2.1;ctx.fillStyle=fitted.x(x,y)?'rgba(232,127,68,.075)':'rgba(34,91,154,.065)';ctx.fillRect(px,py,8,8)}ctx.strokeStyle='#dfe4df';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,mapY(0));ctx.lineTo(plot.width,mapY(0));ctx.moveTo(mapX(0),0);ctx.lineTo(mapX(0),plot.height);ctx.stroke();const palette=['#225b9a','#e87f44','#118b85','#8d5aa8','#b99a2e'];points.forEach(p=>{const px=mapX(p.x),py=mapY(p.y),r=p.train?5:6;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);const colorIndex=model==='kmeans'&&fitted?fitted.assign(p.x,p.y):p.c;ctx.fillStyle=palette[colorIndex%palette.length];ctx.globalAlpha=p.train?1:.55;ctx.fill();ctx.globalAlpha=1;if(!p.train){ctx.strokeStyle='#657180';ctx.lineWidth=1;ctx.stroke()}if(showLabelErrors&&p.corrupted){ctx.beginPath();ctx.arc(px,py,r+3,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=2.2;ctx.stroke()}});if(model==='kmeans'&&fitted)fitted.centers.forEach((c,j)=>{ctx.strokeStyle=palette[j%palette.length];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(mapX(c[0])-8,mapY(c[1])-8);ctx.lineTo(mapX(c[0])+8,mapY(c[1])+8);ctx.moveTo(mapX(c[0])+8,mapY(c[1])-8);ctx.lineTo(mapX(c[0])-8,mapY(c[1])+8);ctx.stroke()})}
const configs={linreg:['Regresión lineal','Modelo de referencia sin hiperparámetros en este laboratorio. Se ajusta a 0/1 y usa un umbral fijo de 0,5 solo para visualizar una clasificación.'],logreg:['Regresión logística','Clasificador lineal probabilístico. En este laboratorio mantenemos C=1 para usarlo como referencia estable.'],perceptron:['Perceptrón','Clasificador lineal que actualiza sus pesos cuando comete errores.'],knn:['kNN','Clasifica según los k vecinos más próximos del conjunto de entrenamiento.'],svm:['SVM','Busca una frontera de margen amplio; con RBF puede producir fronteras no lineales.'],kmeans:['k-Means','Agrupa los datos sin usar etiquetas y actualiza centroides iterativamente.']};
function help(text){return '<p class="param-help">'+text+'</p>'}function choice(id,label,values,current,formatter=v=>v){return '<div class="control"><label>'+label+'</label><div class="choice-row" id="'+id+'">'+values.map(v=>'<button data-value="'+v+'" class="'+(String(v)===String(current)?'active':'')+'">'+formatter(v)+'</button>').join('')+'</div></div>'}
function controls(){let h='';if(model==='linreg')h='<div class="tip compact"><b>Sin hiperparámetros</b><p>Referencia sencilla: el umbral 0,5 es fijo.</p></div>';if(model==='logreg')h='<div class="tip compact"><b>Sin controles</b><p>Usamos C=1 fijo para comparar una frontera lineal estable con modelos más flexibles.</p></div>';if(model==='perceptron')h=choice('iterationsChoice','Máximo de iteraciones',[10,50,100],params.iterations)+help('<b>Controla:</b> cuántas pasadas sobre los datos puede realizar. <b>Observa:</b> más iteraciones no convierten una frontera lineal en no lineal.');if(model==='knn')h=choice('kChoice','k · número de vecinos',[1,5,25],params.k)+help('<b>Controla:</b> cuántos vecinos votan. <b>Observa:</b> k pequeño → frontera local; k grande → frontera más suave.');if(model==='svm'){h=choice('kernelChoice','Kernel',['linear','rbf'],params.kernel,v=>v==='linear'?'Lineal':'RBF')+help('<b>Controla:</b> la forma de medir similitud. <b>Observa:</b> RBF permite fronteras no lineales.')+choice('cChoice','C · penalización de errores',[.1,1,10],params.C,v=>String(v).replace('.',','))+help('<b>Controla:</b> cuánto se penalizan los errores. <b>Observa:</b> C pequeño → más regularización; C grande → mayor ajuste.')+'<div id="gammaBox" '+(params.kernel==='rbf'?'':'hidden')+'>'+choice('gammaChoice','γ · localidad RBF',[.1,1,4],params.gamma,v=>String(v).replace('.',','))+help('<b>Controla:</b> cuán local es la similitud. <b>Observa:</b> γ pequeño → efecto global; γ grande → efecto local.')+'</div>'}if(model==='kmeans')h=choice('clustersChoice','k · número de grupos',[2,3,5],params.clusters)+help('<b>Controla:</b> cuántos grupos debe buscar k-Means. <b>Observa:</b> pocos grupos fusionan; demasiados pueden fragmentar.');$('#dynamicControls').innerHTML=h;bindChoice('iterationsChoice','iterations',Number);bindChoice('kChoice','k',Number);bindChoice('kernelChoice','kernel',String,()=>controls());bindChoice('cChoice','C',Number);bindChoice('gammaChoice','gamma',Number);bindChoice('clustersChoice','clusters',Number)}
function bindChoice(id,key,cast,after){const box=$('#'+id);if(!box)return;box.querySelectorAll('button').forEach(b=>b.onclick=()=>{params[key]=cast(b.dataset.value);box.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));if(after)after();fit();resetMetrics()})}
function updateInsight(){
  let text='';
  if(model==='linreg')text='Empieza simple: úsala como referencia y observa qué gana realmente un clasificador más adecuado.';
  if(model==='logreg')text='Referencia lineal estable. Compárala con kNN y SVM cuando la geometría deje de ser lineal.';
  if(model==='perceptron')text=params.iterations===10?'Entrenamiento corto: ¿la frontera ya se ha estabilizado?':params.iterations===50?'Valor de referencia: si los datos son separables, debería converger pronto.':'Más iteraciones no aumentan la capacidad: una frontera lineal sigue siendo lineal.';
  if(model==='knn')text=params.k===1?'k=1: frontera muy local y flexible; observa si persigue etiquetas incorrectas.':params.k===5?'k=5: equilibrio razonable entre detalle local y estabilidad.':'k=25: frontera suave; comprueba si desaparecen estructuras útiles.';
  if(model==='svm'){
    let cMsg;
    if(labelNoise>0){
      cMsg=params.C===.1?'C bajo: SVM tolera mejor discrepancias en las etiquetas de entrenamiento. Puede ignorar parte del ruido y conservar una frontera más estable.':params.C===10?'C alto: SVM intenta ajustarse con más fuerza a las etiquetas de entrenamiento, incluidas las incorrectas. Esto puede empeorar su rendimiento respecto a la clase real.':'C=1: compromiso entre margen y ajuste a las etiquetas de entrenamiento, algunas de las cuales son incorrectas.';
    }else{
      cMsg=params.C===.1?'C bajo: más regularización y más errores tolerados.':params.C===10?'C alto: penaliza más los errores de entrenamiento y busca un ajuste más estricto.':'C=1: compromiso entre margen y ajuste.';
    }
    const gMsg=params.kernel==='rbf'?(params.gamma===.1?' γ bajo: similitud global y frontera suave.':params.gamma===4?' γ alto: similitud local y frontera flexible.':' γ=1: localidad intermedia.'):' Kernel lineal: la frontera seguirá siendo recta.';
    const evalMsg=labelNoise>0?' El modelo aprende con las etiquetas mostradas; F1, precisión y recall se calculan respecto a la clase real.':'';
    text=cMsg+gMsg+evalMsg;
  }
  if(model==='kmeans')text=params.clusters===2?'k=2: ¿estamos fusionando grupos diferentes?':params.clusters===3?'k=3: compara los grupos encontrados con la estructura geométrica.':'k=5: la inercia puede bajar aunque estemos fragmentando grupos; mira Silhouette.';
  $('#insight').textContent=text;
}
function setLegend(){const legend=$('.legend');if(!legend)return;const noiseKey=' <span class="noise-ring" aria-hidden="true"></span> Borde negro: etiqueta modificada';legend.innerHTML=model==='kmeans'?'Colores = grupos de k-Means'+noiseKey:'<span class="dot a"></span> clase 0 (negativa) <span class="dot b"></span> clase 1 (positiva)'+noiseKey}
function setModel(m){model=m;$$('#modelTabs button').forEach(b=>b.classList.toggle('active',b.dataset.model===m));const c=configs[m];$('#modelTitle').textContent=c[0];$('#modelDesc').textContent=c[1];controls();fit();setLegend();resetMetrics()}
function silhouette(){const a=points.filter(p=>p.train),lab=a.map(p=>fitted.assign(p.x,p.y));let sum=0;for(let i=0;i<a.length;i++){let same=[],other={};for(let j=0;j<a.length;j++)if(i!==j){const d=Math.hypot(a[i].x-a[j].x,a[i].y-a[j].y),l=lab[j];if(l===lab[i])same.push(d);else(other[l]??=[]).push(d)}const av=same.length?same.reduce((s,v)=>s+v,0)/same.length:0,b=Math.min(...Object.values(other).map(q=>q.reduce((s,v)=>s+v,0)/q.length));sum+=(b-av)/Math.max(av,b)}return sum/a.length}
function classificationMetrics(a,target='c'){let tp=0,fp=0,fn=0;a.forEach(p=>{const q=fitted.x(p.x,p.y),y=p[target];if(q===1&&y===1)tp++;else if(q===1&&y===0)fp++;else if(q===0&&y===1)fn++});const precision=tp/(tp+fp)||0,recall=tp/(tp+fn)||0,f1=2*precision*recall/(precision+recall)||0;return{precision,recall,f1}}
function setMetricLabels(a,b,c){$('#metric1Label').textContent=a;$('#metric2Label').textContent=b;$('#metric3Label').textContent=c}
function evaluate(){
  if(model==='kmeans'){const a=points.filter(p=>p.train),inertia=a.reduce((s,p)=>{const c=fitted.centers[fitted.assign(p.x,p.y)];return s+(p.x-c[0])**2+(p.y-c[1])**2},0),sil=silhouette();setMetricLabels('Inercia','Silhouette','');$('#metric1').textContent=inertia.toFixed(1);$('#metric2').textContent=sil.toFixed(2);$('#metric3').textContent='';$('#generalization').textContent='k-Means ignora las etiquetas. Comprueba si el clustering cambia aunque algunas etiquetas estén modificadas.';return}
  const tr=points.filter(p=>p.train&&p.trueC<2),te=points.filter(p=>!p.train&&p.trueC<2),M=classificationMetrics(te,'trueC'),MT=classificationMetrics(tr,'trueC');setMetricLabels('F1','Precisión','Recall (exhaustividad)');$('#metric1').textContent=M.f1.toFixed(2);$('#metric2').textContent=M.precision.toFixed(2);$('#metric3').textContent=M.recall.toFixed(2);const gap=MT.f1-M.f1;const comparison='F1 entrenamiento (clase real): '+MT.f1.toFixed(2)+' · F1 prueba: '+M.f1.toFixed(2)+(gap>.1?' → posible sobreajuste.':' → generalización razonable.')+(M.precision===1?' Precisión 1,00 significa que no hay falsos positivos en prueba; aún puede haber falsos negativos.':'')+(M.recall===1?' Exhaustividad 1,00 significa que se han detectado todos los ejemplos reales de la clase 1; también puede haber clase 1 en ambas zonas.':'');const noiseNote=labelNoise>0?' '+Math.round(labelNoise*100)+'% de las etiquetas de entrenamiento están modificadas: el modelo se entrena con ellas, pero estas métricas se calculan respecto a la clase real.':'';$('#generalization').textContent=comparison+noiseNote;
}
function resetMetrics(){if(model==='kmeans')setMetricLabels('Inercia','Silhouette','');else setMetricLabels('F1','Precisión','Recall (exhaustividad)');$('#metric1').textContent=$('#metric2').textContent=$('#metric3').textContent='—';if(model==='kmeans')$('#metric3').textContent='';$('#generalization').textContent=model==='kmeans'?'Ejecuta k-Means para calcular inercia y Silhouette.':'Ejecuta el modelo para calcular F1, precisión y recall sobre el conjunto de prueba.'}
function updateLabel(){const n=points.filter(p=>p.corrupted).length;$('#datasetLabel').textContent=$('#dataset').selectedOptions[0].text+' · 70/30'+(labelNoise>0?' · '+n+' etiquetas modificadas':'');$('#noiseCount').textContent=labelNoise>0?n+' etiquetas de entrenamiento modificadas':'Sin etiquetas modificadas';setLegend()}
function setLabelNoise(v){labelNoise=v;$$('#labelNoiseChoices button').forEach(b=>b.classList.toggle('active',Number(b.dataset.value)===v));applyLabelNoise()}
$$('#modelTabs button').forEach(b=>b.onclick=()=>setModel(b.dataset.model));$('#dataset').onchange=()=>{seed=4;makeData()};$('#newData').onclick=()=>{seed=Math.floor(Math.random()*1e6);makeData()};$('#run').onclick=evaluate;$$('#labelNoiseChoices button').forEach(b=>b.onclick=()=>setLabelNoise(Number(b.dataset.value)));$('#toggleNoise').onclick=()=>{showLabelErrors=!showLabelErrors;$('#toggleNoise').textContent=showLabelErrors?'Ocultar errores':'Mostrar errores';draw();setLegend()};
const tooltip=$('#pointTooltip');plot.addEventListener('mousemove',e=>{if(!showLabelErrors){tooltip.hidden=true;return}const r=plot.getBoundingClientRect(),sx=plot.width/r.width,sy=plot.height/r.height,x=(e.clientX-r.left)*sx,y=(e.clientY-r.top)*sy;const p=points.find(p=>p.corrupted&&Math.hypot(mapX(p.x)-x,mapY(p.y)-y)<10);if(!p){tooltip.hidden=true;return}tooltip.hidden=false;tooltip.style.left=(e.clientX+12)+'px';tooltip.style.top=(e.clientY+12)+'px';tooltip.innerHTML='<b>Etiqueta modificada</b><br>Clase original: '+p.trueC+' → etiqueta usada: '+p.c});plot.addEventListener('mouseleave',()=>tooltip.hidden=true);
function hero(){const c=$('#heroCanvas'),x=c.getContext('2d');for(let i=0;i<55;i++){const a=Math.random()*7,r=40+Math.random()*120;x.beginPath();x.arc(215+Math.cos(a)*r,180+Math.sin(a)*r,4,0,Math.PI*2);x.fillStyle=i%2?'#e87f44':'#225b9a';x.fill()}x.strokeStyle='#18365d';x.lineWidth=3;x.beginPath();x.moveTo(85,290);x.bezierCurveTo(180,80,250,320,350,70);x.stroke()}
function loadChallenge(n){
  if(n===4&&typeof loadSvmReferencePreset==='function'){loadSvmReferencePreset();return}
  const config={1:['linear',0,'linreg'],2:['moons',.1,'knn'],3:['circles',0,'linreg'],5:['clusters',0,'kmeans']}[n];
  if(!config)return;
  $('#dataset').value=config[0];seed=4;labelNoise=config[1];params.k=n===2?5:params.k;params.clusters=n===5?3:params.clusters;
  $$('[data-value]').forEach(b=>{if(b.closest('#labelNoiseChoices'))b.classList.toggle('active',Number(b.dataset.value)===labelNoise)});
  makeData();setModel(config[2]);
}
$$('#challengeButtons button').forEach(b=>b.onclick=()=>loadChallenge(Number(b.dataset.challenge)));
hero();makeData();setModel('linreg');
