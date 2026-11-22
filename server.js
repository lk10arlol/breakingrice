const express=require('express'),mongoose=require('mongoose'),crypto=require('crypto'),fs=require('fs');
const app=express();app.set('trust proxy',1);app.use(require('compression')());app.use(express.json({limit:'6mb'}));
const {MONGODB_URI,ADMIN_PASSWORD}=process.env;
if(!MONGODB_URI||!ADMIN_PASSWORD){console.error('MONGODB_URI et ADMIN_PASSWORD requis');process.exit(1)}
const Item=mongoose.model('Item',new mongoose.Schema({name:String,category:String,description:String,price:Number,photo:String,allergens:String,tag:String,available:{type:Boolean,default:true},order:{type:Number,default:0}}));
const SC='11:30-15:00 / 18:00-01:00';
const DEF={categories:['Offres du labo','Menus','Riz Crousty Original','Riz Crousty Gratiné','Burgers','Extras','Desserts','Boissons'],uberUrl:'https://www.ubereats.com/fr/store/breaking-rice-poulet-crousty-merignac/i6V0LUxyV96WUOl3v3YT_g',about:'Chez Breaking Rice, on cuisine le poulet crousty avec une pureté de 99,1 %. Riz parfumé, poulet croustillant, sauces maison : une formule qui ne laisse aucune trace… sauf dans votre mémoire.',address:'32 Avenue John Fitzgerald Kennedy, 33700 Mérignac',phone:'05 54 69 93 61',google:{url:'https://maps.app.goo.gl/pcJ7JVmTiLGJTAAKA',placeId:'',rating:4.8,count:114,reviews:[{name:'Ingrid',rating:5,text:'Super expérience ! L\'accueil était vraiment chaleureux, l\'équipe est adorable et …',date:'Visité en août',show:true},{name:'Rémi Barbedette',rating:5,text:'Excellent service, super accueillant avec des offres top est une cuisine de très bonnes qualités très bon rapport qualité prix.',date:'Visité en septembre',show:true}]},schedule:[SC,SC,SC,SC,SC,SC,'18:00-23:30'],lat:null,lng:null,pages:[{title:'Mentions légales',slug:'mentions-legales',show:true,text:'Breaking Rice — 32 Avenue John Fitzgerald Kennedy, 33700 Mérignac.\nÉditeur, SIRET, contact : à compléter dans l\'administration.\nHébergeur : Render Services, Inc.'},{title:'Allergènes',slug:'allergenes',show:true,text:'Nos produits peuvent contenir des allergènes (gluten, lait, œuf, soja, moutarde, sésame…). Demandez la liste détaillée à l\'équipe avant de commander.'}],socials:{instagram:'',tiktok:'',snapchat:'',facebook:''},faq:[{q:'Comment commander ?',a:'Cliquez sur « Commander » : vous serez redirigé vers notre page Uber Eats pour choisir vos plats et passer commande.'},{q:'Avez-vous des options végétariennes ?',a:'Oui : le Riz Crousty Végé (falafels, oignons crispy, sauce blanche maison et sauce aigre douce).'},{q:'Quels sont vos horaires ?',a:'Les horaires détaillés sont dans la section « Nous trouver », en bas de page.'},{q:'Où êtes-vous situés ?',a:'À Mérignac : l\'adresse, la carte et l\'itinéraire sont dans la section « Nous trouver ».'},{q:'Et pour les allergènes ?',a:'Demandez la liste détaillée à l\'équipe avant de commander : voir la page « Allergènes » en bas de page.'}],popup:{enabled:false,title:'',text:'',image:''},banner:{enabled:false,text:''}};
const Settings=mongoose.model('Settings',new mongoose.Schema({_id:String,data:Object},{minimize:false}));
const getS=async()=>{const d=(await Settings.findById('main'))?.data||{};return{...DEF,...d,phone:d.phone||DEF.phone,google:{...DEF.google,...(d.google||{})}}};
let GC={t:0,d:null};
const live=async()=>{const{GOOGLE_API_KEY:k,GOOGLE_PLACE_ID:p}=process.env;if(!k||!p)return null;if(Date.now()-GC.t<432e5)return GC.d;GC.t=Date.now();
 try{const j=await(await fetch('https://places.googleapis.com/v1/places/'+p+'?languageCode=fr',{headers:{'X-Goog-Api-Key':k,'X-Goog-FieldMask':'rating,userRatingCount,reviews'}})).json();
  if(j.rating)GC.d={rating:j.rating,count:j.userRatingCount,placeId:p,reviews:(j.reviews||[]).map(x=>({name:x.authorAttribution?.displayName,rating:x.rating,text:x.text?.text||x.originalText?.text,date:x.relativePublishTimeDescription,show:true}))}}catch{}return GC.d};
const sign=e=>{const p=String(e);return p+'.'+crypto.createHmac('sha256',ADMIN_PASSWORD).update(p).digest('hex')};
const auth=(q,r,n)=>{const t=(q.headers.authorization||'').replace('Bearer ','');const [e,s]=t.split('.');if(s&&t===sign(e)&&+e>Date.now())return n();r.status(401).json({error:'Non autorisé'})};
const tries={};
app.post('/api/login',(q,r)=>{const ip=q.ip,t=tries[ip]=(tries[ip]||[]).filter(x=>Date.now()-x<9e5);if(t.length>=8)return r.status(429).json({error:'Trop d\'essais, réessayez plus tard'});
 const a=Buffer.from(String(q.body.password||'')),b=Buffer.from(ADMIN_PASSWORD);
 if(a.length===b.length&&crypto.timingSafeEqual(a,b))return r.json({token:sign(Date.now()+864e5)});t.push(Date.now());r.status(401).json({error:'Mot de passe incorrect'})});
app.get('/api/menu',async(q,r)=>{const st=await getS(),g=await live();if(g)st.google={...st.google,...g,live:true,reviews:g.reviews.length?g.reviews:st.google.reviews};r.json({items:await Item.find({available:true}).sort({order:1,_id:1}),settings:st})});
app.get('/api/admin/items',auth,async(q,r)=>r.json(await Item.find().sort({order:1,_id:1})));
app.post('/api/admin/items',auth,async(q,r)=>r.json(await Item.create(q.body)));
app.put('/api/admin/items/:id',auth,async(q,r)=>r.json(await Item.findByIdAndUpdate(q.params.id,q.body,{new:true})));
app.delete('/api/admin/items/:id',auth,async(q,r)=>{await Item.findByIdAndDelete(q.params.id);r.json({ok:true})});
app.get('/api/admin/settings',auth,async(q,r)=>r.json(await getS()));
app.put('/api/admin/settings',auth,async(q,r)=>{await Settings.findByIdAndUpdate('main',{data:q.body},{upsert:true});r.json(await getS())});
const Stat=mongoose.model('Stat',new mongoose.Schema({_id:String,views:{type:Number,default:0},orders:{type:Number,default:0}}));
const hits={};
app.post('/api/track',async(q,r)=>{const k=q.ip,h=hits[k]=(hits[k]||[]).filter(x=>Date.now()-x<36e5);if(h.length>=60)return r.sendStatus(204);h.push(Date.now());
 const t=q.body?.t==='order'?'orders':q.body?.t==='view'?'views':null;try{if(t)await Stat.findByIdAndUpdate(new Date().toISOString().slice(0,10),{$inc:{[t]:1}},{upsert:true})}catch{}r.sendStatus(204)});
app.get('/api/admin/stats',auth,async(q,r)=>{const days=[...Array(14)].map((_,i)=>new Date(Date.now()-(13-i)*864e5).toISOString().slice(0,10));
 const m=Object.fromEntries((await Stat.find({_id:{$in:days}})).map(x=>[x._id,x]));r.json(days.map(d=>({day:d,views:m[d]?.views||0,orders:m[d]?.orders||0})))});
app.post('/api/admin/reorder',auth,async(q,r)=>{await Item.bulkWrite((q.body.ids||[]).map((id,i)=>({updateOne:{filter:{_id:id},update:{order:i}}})));r.json({ok:true})});
const IDX=fs.readFileSync(__dirname+'/public/index.html','utf8');
app.get(['/','/index.html'],(q,r)=>r.set('Cache-Control','no-cache').type('html').send(IDX.replace(/__HOST__/g,q.get('host'))));
app.get('/robots.txt',(q,r)=>r.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: https://'+q.get('host')+'/sitemap.xml\n'));
app.get('/sitemap.xml',(q,r)=>r.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://'+q.get('host')+'/</loc></url></urlset>'));
app.use((q,r,n)=>{r.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});n()});
app.use(express.static('public',{maxAge:'7d',setHeaders:(r,p)=>{if(/\.(html|json|xml|txt|css)$/.test(p))r.setHeader('Cache-Control','no-cache')}}));
const AP='/admin';
app.get(AP+'/',(q,r)=>r.redirect(AP));
app.get(AP,(q,r)=>{r.set('X-Robots-Tag','noindex');r.sendFile(__dirname+'/private/gestion.html')});
app.use((q,r)=>r.status(404).sendFile(__dirname+'/public/404.html'));
mongoose.connect(MONGODB_URI).then(async()=>{
 const old=['Crousty Classique','Méga Crousty','Tenders x6','Frites','Soda 33cl','Brownie'],n=await Item.countDocuments();
 if(n===0||(n===6&&await Item.countDocuments({name:{$in:old}})===6)){await Item.deleteMany({});
  const B='Servis avec une boisson. Riz thaï, poulet crousty, oignons crispy, sauce blanche maison et sauce thaï.',G=x=>'Riz crousty gratiné '+x+'.';
  await Item.insertMany([
  ['Menus','Menu Riz Poulet Crousty + Boisson',13.5,B,'Best-seller'],['Menus','Menu Riz Crousty Gratiné',14.9,B,''],['Menus','Menu Burger Poulet Crousty + Frites',11.5,'Servis avec des frites. Burger brioché au choix.',''],
  ['Riz Crousty Original','Riz Crousty Original (L)',11.9,'',''],['Riz Crousty Original','Riz Crousty Deal (L)',14.9,'',''],
  ['Riz Crousty Original','Riz Crousty Végé (L)',11.9,'Riz thaï, falafels, oignons crispy, sauce blanche maison et sauce aigre douce.','Végé'],
  ['Riz Crousty Original','Riz Poulet HEALTHY (L)',13.9,'Poulet mariné, fait maison et cuit sur la plancha, taille L.','Healthy'],
  ['Riz Crousty Gratiné','Riz Crousty Gratiné Cheddar Deal',15.5,G('Cheddar'),''],['Riz Crousty Gratiné','Riz Crousty Gratiné Cheddar',13.9,G('Cheddar'),''],
  ['Riz Crousty Gratiné','Riz Crousty Gratiné Mozzarella',13.9,G('Mozzarella'),''],['Riz Crousty Gratiné','Riz Crousty Gratiné Raclette',13.9,G('raclette'),''],['Riz Crousty Gratiné','Riz Crousty Gratiné Emmental',13.9,G('Emmental'),''],
  ['Burgers','Jesse Burger',8.9,'Bun brioché, poulet pané, Cheddar fondant, salade verte, chou rouge, cornichons et sauce à l\'ail.',''],
  ['Burgers','Breaking BBQ Burger',8.9,'Bun brioché, poulet pané, sauce barbecue, Cheddar, salade, chou rouge, tomates et cornichons.',''],
  ['Burgers','Walter Burger',8.9,'Bun brioché, poulet pané, mayonnaise, Cheddar, salade et cornichons.',''],
  ['Extras','Frites',3.5,'Frites nature - sauces accompagnement au choix.',''],['Extras','Tenders de Poulet',8.9,'2 pièces.',''],
  ['Desserts','Tiramisu',3.5,'Tiramisu spéculoos.',''],
  ['Boissons','Coca-Cola',3,'Coca-Cola original.',''],['Boissons','Coca-Cola Zéro',3,'Coca-Cola zéro.',''],['Boissons','Ice Tea',3,'Ice tea pêche.',''],['Boissons','Fanta',3,'Fanta orange.',''],
  ['Boissons','Red Bull',3,'Red Bull original.',''],['Boissons','Oasis Tropical',3,'Oasis tropical.',''],['Boissons','Eau',3,'Eau plate.','']
  ].map(([category,name,price,description,tag],i)=>({category,name,price,description,tag,order:i})))}
 if(!await Settings.findById('seed2')){const P='/img/',C='Offres du labo';
  await Item.insertMany([
  ['Box Los Pollos Hermanos',10,'Riz crousty, burger, frites et boisson.','box.jpg','Best-seller'],['Chicken burger',6.9,'Menu : burger, frites et boisson.','chicken-burger.jpg',''],
  ['Crousty gratiné',10,'Plusieurs variantes disponibles.','gratine.jpg',''],['Gratiné 16',16,'','gratine.jpg',''],
  ['Crousty healthy',10,'Plusieurs variantes disponibles.','crousty-healthy.jpg','Healthy'],['Healthy',8,'','crousty-healthy.jpg','Healthy'],['Healthy + smoothie',10,'Offre Crousty Healthy avec smoothie.','healthy-smoothie.jpg','Offre'],
  ['Crousty original',8.5,'Plusieurs variantes disponibles.','original.jpg',''],['Crousty végé',8.5,'','vege.jpg','Végé'],
  ['Menu enfant',6.9,'Burger, frites et petite boisson.','menu-enfant.jpg',''],['Tenders x3',5,'','frites-tenders.jpg',''],['Frites',2.5,'','frites-tenders.jpg',''],
  ['Riz au lait',5,'Kinder Bueno, Oreo ou M&M\'s.','riz-au-lait.jpg',''],['Smoothie',3,'','smoothie.jpg',''],['Soda',2.5,'','Soda.jpg',''],['Eau 50cl',1.5,'','eau%20.jpg','']
  ].map(([name,price,description,ph,tag],i)=>({category:C,name,price,description,photo:ph?P+ph:'',tag,order:100+i})));
  await Settings.create({_id:'seed2',data:{}});
  const st=await Settings.findById('main');if(st?.data?.categories&&!st.data.categories.includes(C)){st.data.categories.unshift(C);st.markModified('data');await st.save()}}
 for(const[n,f]of[['Smoothie','smoothie.jpg'],['Soda','Soda.jpg'],['Eau 50cl','eau%20.jpg']])await Item.updateMany({category:'Offres du labo',name:n,$or:[{photo:''},{photo:null},{photo:{$exists:false}}]},{photo:'/img/'+f});
 app.listen(process.env.PORT||3000,()=>console.log('OK admin:'+AP))}).catch(e=>{console.error(e);process.exit(1)});
