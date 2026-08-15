const fs=require('fs');
// Rebuild the glyph markup standalone so it can be eyeballed as a real SVG.
const shape=(id,c)=>{
 if(['efootball','fc_mobile','ea_fc'].includes(id))return `<g stroke="${c}" stroke-width="1.6" fill="none"><circle cx="20" cy="20" r="7.5"/><path d="M20 12.5 L23.6 15.2 L22.2 19.4 L17.8 19.4 L16.4 15.2 Z" fill="${c}" stroke="none"/></g>`;
 if(['pubg','cod'].includes(id))return `<g stroke="${c}" stroke-width="1.6" fill="none"><circle cx="20" cy="20" r="6.5"/><line x1="20" y1="10.5" x2="20" y2="14.5"/><line x1="20" y1="25.5" x2="20" y2="29.5"/><line x1="10.5" y1="20" x2="14.5" y2="20"/><line x1="25.5" y1="20" x2="29.5" y2="20"/><circle cx="20" cy="20" r="1.6" fill="${c}" stroke="none"/></g>`;
 return `<g stroke="${c}" stroke-width="1.6" fill="none"><rect x="12" y="15" width="16" height="10" rx="5"/><line x1="16" y1="20" x2="18.5" y2="20"/><line x1="17.25" y1="18.75" x2="17.25" y2="21.25"/><circle cx="23.5" cy="19" r="1.1" fill="${c}" stroke="none"/><circle cx="25.5" cy="21.5" r="1.1" fill="${c}" stroke="none"/></g>`;};
const glyph=(id,n,cap)=>{const r=17,C=2*Math.PI*r,ceil=cap||8,ratio=Math.max(0,Math.min(1,n/ceil));
 const full=cap&&n>=cap,empty=n<=0,c=empty?'#5C6B52':full?'#C9A227':'#00FF42';
 return `<g><circle cx="20" cy="20" r="${r}" fill="none" stroke="#1E3A2A" stroke-width="2.5"/>`+
 (empty?`<circle cx="20" cy="20" r="${r}" fill="none" stroke="#1E3A2A" stroke-width="2.5" stroke-dasharray="2 4"/>`
       :`<circle cx="20" cy="20" r="${r}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${C*ratio} ${C}" transform="rotate(-90 20 20)"/>`)+
 shape(id,c)+`<circle cx="33" cy="33" r="7" fill="${empty?'#16301F':full?'#C9A227':'#00FF42'}"/><text x="33" y="36" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle" fill="${empty?'#5C6B52':'#09150E'}">${n}</text></g>`;};
const cases=[['efootball',0,8,'empty'],['efootball',3,8,'3 of 8'],['efootball',6,8,'6 of 8'],['efootball',8,8,'full'],['cod',1,8,'COD 1'],['pubg',4,12,'PUBG 4'],['other',2,8,'Other 2']];
let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${cases.length*80}" height="120" viewBox="0 0 ${cases.length*80} 120"><rect width="100%" height="100%" fill="#09150E"/>`;
cases.forEach(([id,n,cap,label],i)=>{out+=`<g transform="translate(${i*80+20},25)">${glyph(id,n,cap)}</g><text x="${i*80+40}" y="105" font-size="9" font-family="monospace" text-anchor="middle" fill="#86935C">${label}</text>`;});
out+=`</svg>`;
fs.writeFileSync('/home/user/arena-glyphs.svg',out);
console.log('written');
