(function(root){
'use strict';
const normal=c=>({kind:'piece',color:c});
const special=(type,dir='h')=>({kind:'special',type,dir});
class Game{
 constructor(config={},random=Math.random){this.rows=config.rows||8;this.cols=config.cols||8;this.colors=config.colors||5;this.random=random;this.moves=config.moves??28;this.goals=(config.goals||[{type:'color',color:0,target:25}]).map(g=>({...g,progress:0}));this.board=Array(this.rows*this.cols).fill(null);this.busy=false;this.status='playing';this.events=[];for(const o of config.obstacles||[])this.board[o.index]={kind:'block',hp:o.hp||1,max:o.hp||1};for(const i of config.items||[])this.board[i]={kind:'item'};this.fill();this.shuffle();}
 xy(i){return [Math.floor(i/this.cols),i%this.cols];}
 at(r,c){return r>=0&&r<this.rows&&c>=0&&c<this.cols?r*this.cols+c:-1;}
 neighbors(i){const[r,c]=this.xy(i);return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].map(p=>this.at(...p)).filter(x=>x>=0);}
 rand(){return Math.floor(this.random()*this.colors);}
 fill(){for(let i=0;i<this.board.length;i++)if(!this.board[i])this.board[i]=normal(this.rand());}
 detect(preferred=[]){
 const b=this.board,shapes=[],eq=(i,j)=>i>=0&&j>=0&&b[i]?.kind==='piece'&&b[j]?.kind==='piece'&&b[i].color===b[j].color;
 for(let i=0;i<b.length;i++)if(b[i]?.kind==='piece'){
 const[r,c]=this.xy(i);
 for(const dir of ['h','v']){const prev=this.at(r-(dir==='v'),c-(dir==='h'));if(eq(i,prev))continue;const cells=[];for(let k=0;;k++){const j=this.at(r+k*(dir==='v'),c+k*(dir==='h'));if(!eq(i,j))break;cells.push(j);}if(cells.length>=3)shapes.push({cells,type:cells.length>=5?'light':cells.length===4?'rocket':null,dir});}
 const sq=[i,this.at(r,c+1),this.at(r+1,c),this.at(r+1,c+1)];if(sq.every(j=>eq(i,j)))shapes.push({cells:sq,type:'propeller'});
 }
 const lines=shapes.filter(s=>s.cells.length>=3&&s.dir);for(let a=0;a<lines.length;a++)for(let z=a+1;z<lines.length;z++)if(lines[a].dir!==lines[z].dir&&lines[a].cells.some(i=>lines[z].cells.includes(i)))shapes.push({cells:[...new Set([...lines[a].cells,...lines[z].cells])],type:'tnt'});
 const removed=new Set(shapes.flatMap(s=>s.cells)), creations=[],used=new Set();const rank={light:4,tnt:3,rocket:2,propeller:1};
 for(const s of shapes.filter(s=>s.type).sort((a,b)=>rank[b.type]-rank[a.type])){if(s.cells.some(i=>used.has(i)))continue;const index=[...preferred,...s.cells].find(i=>s.cells.includes(i)&&!creations.some(x=>x.index===i));creations.push({index,piece:special(s.type,s.dir),cells:s.cells});s.cells.forEach(i=>used.add(i));}
 return {removed,creations,shapes};
 }
 progress(type,color){for(const g of this.goals)if(g.type===type&&(type!=='color'||g.color===color))g.progress=Math.min(g.target,g.progress+1);}
 area(i,radius){const[r,c]=this.xy(i),out=[];for(let y=r-radius;y<=r+radius;y++)for(let x=c-radius;x<=c+radius;x++){const j=this.at(y,x);if(j>=0)out.push(j);}return out;}
 line(i,dir,width=0){const[r,c]=this.xy(i);return this.board.map((_,j)=>j).filter(j=>{const[y,x]=this.xy(j);return dir==='h'?Math.abs(y-r)<=width:Math.abs(x-c)<=width;});}
 target(exclude=new Set()){const indices=this.board.map((_,i)=>i).filter(i=>!exclude.has(i)&&this.board[i]);const goal=indices.filter(i=>{const p=this.board[i];return p.kind==='block'||p.kind==='item'||this.goals.some(g=>g.type==='color'&&g.progress<g.target&&p.kind==='piece'&&p.color===g.color);});return (goal.length?goal:indices.filter(i=>this.board[i].kind==='piece'))[0]??indices[0];}
 dominant(){const count=Array(this.colors).fill(0);this.board.forEach(p=>{if(p?.kind==='piece')count[p.color]++;});return count.indexOf(Math.max(...count));}
 effect(i,p,color){if(p.type==='rocket')return this.line(i,p.dir);if(p.type==='tnt')return this.area(i,2);if(p.type==='propeller'){const t=this.target(new Set([i,...this.neighbors(i)]));return [i,...this.neighbors(i),t].filter(j=>j!==undefined);}return [i,...this.board.map((q,j)=>q?.kind==='piece'&&q.color===(color??this.dominant())?j:-1).filter(j=>j>=0)];}
 combo(a,b,p,q){const types=[p.type,q.type].sort().join('+');const hits=new Set([a,b]);const add=x=>x.forEach(i=>hits.add(i));
 if(types==='light+light')add(this.board.map((_,i)=>i));
 else if(types.includes('light')){const other=p.type==='light'?q:p,col=this.dominant();this.board.forEach((v,i)=>{if(v?.kind==='piece'&&v.color===col){const s=special(other.type,other.type==='rocket'?(i%2?'h':'v'):other.dir);this.board[i]=s;}});this.board.forEach((v,i)=>{if(v?.kind==='special'&&i!==a&&i!==b&&v.type===other.type)add(this.effect(i,v));});}
 else if(types==='rocket+rocket'){add(this.line(b,'h'));add(this.line(b,'v'));}
 else if(types==='rocket+tnt'){add(this.line(b,'h',1));add(this.line(b,'v',1));}
 else if(types==='tnt+tnt')add(this.area(b,4));
 else if(types==='propeller+propeller'){const reserved=new Set([a,b]);add([a,...this.neighbors(a),b,...this.neighbors(b)]);for(let k=0;k<3;k++){const t=this.target(reserved);if(t!==undefined){hits.add(t);reserved.add(t);}}}
 else {const other=p.type==='propeller'?q:p;add(this.neighbors(b));const t=this.target(new Set([a,b]));if(t!==undefined)add(this.effect(t,other));}
 this.board[a]=null;this.board[b]=null;return hits;
 }
 blast(initial,protectedCells=new Set(),adjacent=false){const pending=[...initial],seen=new Set(),blocks=new Set();while(pending.length){const i=pending.shift();if(i<0||i>=this.board.length||seen.has(i)||protectedCells.has(i))continue;seen.add(i);const p=this.board[i];if(!p)continue;if(p.kind==='block'){blocks.add(i);continue;}if(p.kind==='special')pending.push(...this.effect(i,p));if(p.kind==='piece')this.progress('color',p.color);if(p.kind==='item')this.progress('item');this.board[i]=null;if(adjacent)for(const n of this.neighbors(i))if(this.board[n]?.kind==='block')blocks.add(n);}
 for(const i of blocks){const p=this.board[i];if(p?.kind==='block'&&--p.hp<=0){this.board[i]=null;this.progress('block');}}this.events.push({type:'clear',cells:[...seen]});return seen;
 }
 gravity(){for(let c=0;c<this.cols;c++){let end=this.rows-1;for(let r=this.rows-1;r>=-1;r--){if(r===-1||this.board[this.at(r,c)]?.kind==='block'){const values=[];for(let y=end;y>r;y--){const p=this.board[this.at(y,c)];if(p)values.push(p);}let k=0;for(let y=end;y>r;y--)this.board[this.at(y,c)]=values[k++]||normal(this.rand());end=r-1;}}}this.events.push({type:'fall'});}
 async resolve(hook=async()=>{},preferred=[]){for(let n=0;n<100;n++){const m=this.detect(preferred);preferred=[];if(!m.removed.size)return;const protect=new Set(m.creations.map(x=>x.index));this.blast(m.removed,protect,true);for(const x of m.creations)this.board[x.index]=x.piece;await hook('clear',this);this.gravity();await hook('fall',this);}this.shuffle();this.events.push({type:'safety'});}
 swap(a,b){[this.board[a],this.board[b]]=[this.board[b],this.board[a]];}
 valid(a,b){if(!this.neighbors(a).includes(b)||!this.board[a]||!this.board[b]||this.board[a].kind==='block'||this.board[b].kind==='block')return false;const p=this.board[a],q=this.board[b];if(p.kind==='special'||q.kind==='special')return !((p.type==='light'&&q.kind==='item')||(q.type==='light'&&p.kind==='item'));this.swap(a,b);const ok=this.detect().removed.size>0;this.swap(a,b);return ok;}
 legal(){const out=[];for(let i=0;i<this.board.length;i++)for(const j of this.neighbors(i))if(j>i&&this.valid(i,j))out.push([i,j]);return out;}
 shuffle(){const positions=this.board.map((p,i)=>p?.kind==='piece'?i:-1).filter(i=>i>=0),values=positions.map(i=>this.board[i]);for(let k=0;k<500;k++){for(let i=values.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}positions.forEach((j,i)=>this.board[j]=values[i]);if(!this.detect().removed.size&&this.legal().length)return;}for(let k=0;k<1000;k++){positions.forEach(i=>this.board[i]=normal(this.rand()));if(!this.detect().removed.size&&this.legal().length)return;}throw Error('盤面設定では有効な交換を生成できません');}
 evaluate(){this.status=this.goals.every(g=>g.progress>=g.target)?'won':this.moves<=0?'lost':'playing';return this.status;}
 async act(a,b=null,hook=async()=>{}){if(this.busy||this.status!=='playing')return false;const p=this.board[a],q=b===null?null:this.board[b];if(!p||(b===null&&p.kind!=='special')||(b!==null&&!this.valid(a,b)))return false;this.busy=true;this.events=[];try{this.moves--;if(b!==null)this.swap(a,b);await hook('swap',this);if(p.kind==='special'&&q?.kind==='special'){this.blast(this.combo(a,b,p,q));await hook('clear',this);this.gravity();await hook('fall',this);}else if(p.kind==='special'||q?.kind==='special'){const s=p.kind==='special'?p:q,index=b===null?a:p.kind==='special'?b:a,other=p.kind==='special'?q:p;this.blast(this.effect(index,s,other?.color));await hook('clear',this);this.gravity();await hook('fall',this);}await this.resolve(hook,b===null?[]:[b,a]);if(!this.legal().length){this.shuffle();await hook('shuffle',this);}this.evaluate();return true;}finally{this.busy=false;}}
}
const api={Game,normal,special};if(typeof module!=='undefined')module.exports=api;root.StarGarden=api;
})(typeof window!=='undefined'?window:globalThis);
