/* Exact, authored translations. Text nodes are updated in place, preserving
   controls, listeners, editable inputs and experiment state. */
(() => {
  const records=new WeakMap(),attributes=new WeakMap();
  let language='es',config=null,observer=null;
  const normalize=s=>s.replace(/\s+/g,' ').trim();
  function translate(value){
    const key=normalize(value),entry=config.dictionary[key];
    let replacement=entry ? (typeof entry==='string'?(language==='en'?entry:key):entry[language]) : null;
    if(replacement===null){for(const [es,en] of Object.entries(config.dictionary)){const english=typeof en==='string'?en:en.en;if(key===english){replacement=language==='en'?english:(typeof en==='string'?es:en.es);break;}}}
    if(replacement===null&&config.dynamic)replacement=config.dynamic(key,language);
    if(replacement===null||replacement===undefined)return value;
    return value.slice(0,value.length-value.trimStart().length)+replacement+value.slice(value.trimEnd().length);
  }
  function update(){
    observer?.disconnect();
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){if(node.parentElement?.closest('script,style,textarea,code,pre,[data-language-control],[data-no-translate]'))continue;const previous=records.get(node);const source=previous&&node.nodeValue===previous.last?previous.source:node.nodeValue;const last=translate(source);if(node.nodeValue!==last)node.nodeValue=last;records.set(node,{source,last});}
    for(const el of document.querySelectorAll('[title],[aria-label],[alt],[placeholder]')){if(el.closest('[data-language-control],[data-no-translate]'))continue;let record=attributes.get(el)||{};for(const attr of ['title','aria-label','alt','placeholder']){if(!el.hasAttribute(attr))continue;const current=el.getAttribute(attr),old=record[attr],source=old&&old.last===current?old.source:current,last=translate(source);if(last!==current)el.setAttribute(attr,last);record[attr]={source,last};}attributes.set(el,record);}
    document.documentElement.lang=language;
    if(config.titles)document.title=config.titles[language];
    observer?.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  window.LabLanguage={get value(){return language;},translate,refresh:update,init(c){config=c;const select=document.createElement('select');select.id='language';select.dataset.languageControl='true';select.setAttribute('aria-label','Idioma / Language');select.innerHTML='<option value="es">🇪🇸 Español</option><option value="en">🇬🇧 English</option>';select.style.cssText='font:inherit;font-size:14px;padding:8px;border:1px solid #b8c5c9;border-radius:8px;background:white;color:#18365d;width:auto;max-width:160px;margin-left:auto;flex-shrink:0';document.querySelector('header').append(select);select.addEventListener('change',()=>{language=select.value;config.onChange?.(language);update();});observer=new MutationObserver(update);update();}};
})();
