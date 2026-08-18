const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const {Quests}=require('./src/components/Quests.tsx');
(async()=>{
  const h=document.createElement('div');document.body.appendChild(h);
  const r=createRoot(h);
  await act(async()=>{r.render(React.createElement(Quests,{quests:[],participants:[{id:'a',displayName:'Kimani',locationName:'Nairobi',contribution:{accepted:96,rejected:610,settledPoints:34800}}],boardMode:'earners',setBoardMode:()=>{},handleSubmitQuest:()=>{},setActiveTab:()=>{},setArenaSection:()=>{}}));});
  const t=(h.textContent||'').replace(/\s+/g,' ');
  console.log("HAS 'Ranked by settled points':", t.includes('Ranked by settled points'));
  console.log("HAS Kimani:", t.includes('Kimani'));
  console.log("HAS pool text:", t.includes('No reward pool is funded'));
  console.log(t.slice(0,400));
})();
