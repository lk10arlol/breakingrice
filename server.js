const express=require('express'),mongoose=require('mongoose'),crypto=require('crypto');
const app=express();app.use(express.json({limit:'6mb'}));
const {MONGODB_URI,ADMIN_PASSWORD}=process.env;
if(!MONGODB_URI||!ADMIN_PASSWORD){console.error('MONGODB_URI et ADMIN_PASSWORD requis');process.exit(1)}
const Item=mongoose.model('Item',new mongoose.Schema({name:String,category:String,description:String,price:Number,photo:String,allergens:String,tag:String,available:{type:Boolean,default:true},order:{type:Number,default:0}}));
const SC='11:30-15:00 / 18:00-01:00';
const DEF={categories:['Offres du labo','Menus','Riz Crousty Original','Riz Crousty Gratiné','Burgers','Extras','Desserts','Boissons'],uberUrl:'https://www.ubereats.com/fr/store/breaking-rice-poulet-crousty-merignac/i6V0LUxyV96WUOl3v3YT_g',about:'Chez Breaking Rice, on cuisine le poulet crousty avec une pureté de 99,1 %. Riz parfumé, poulet croustillant, sauces maison : une formule qui ne laisse aucune trace… sauf dans votre mémoire.',address:'32 Avenue John Fitzgerald Kennedy, 33700 Mérignac',phone:'',schedule:[SC,SC,SC,SC,SC,SC,'18:00-23:30'],lat:null,lng:null,pages:[{title:'Mentions légales',slug:'mentions-legales',show:true,text:'Breaking Rice — 32 Avenue John Fitzgerald Kennedy, 33700 Mérignac.\nÉditeur, SIRET, contact : à compléter dans l\'administration.\nHébergeur : Render Services, Inc.'},{title:'Allergènes',slug:'allergenes',show:true,text:'Nos produits peuvent contenir des allergènes (gluten, lait, œuf, soja, moutarde, sésame…). Demandez la liste détaillée à l\'équipe avant de commander.'}],popup:{enabled:false,title:'',text:'',image:''},banner:{enabled:false,text:''}};
const Settings=mongoose.model('Settings',new mongoose.Schema({_id:String,data:Object},{minimize:false}));
let geoT=0;
async function geo(s){if(s.lat&&s.lng||Date.now()-geoT<36e5)return s;geoT=Date.now();
 for(const q of [s.address,'Avenue du Président John Fitzgerald Kennedy, Mérignac','Avenue John Fitzgerald Kennedy, Mérignac']){try{const j=await(await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q='+encodeURIComponent(q),{headers:{'User-Agent':'breaking-rice-site/1.0'},signal:AbortSignal.timeout(4000)})).json();
  if(j[0]){s={...s,lat:+j[0].lat,lng:+j[0].lon};await Settings.findByIdAndUpdate('main',{data:s},{upsert:true});break}}catch{}}return s}
const getS=async()=>({...DEF,...((await Settings.findById('main'))?.data||{})});
const sign=e=>{const p=String(e);return p+'.'+crypto.createHmac('sha256',ADMIN_PASSWORD).update(p).digest('hex')};
const auth=(q,r,n)=>{const t=(q.headers.authorization||'').replace('Bearer ','');const [e,s]=t.split('.');if(s&&t===sign(e)&&+e>Date.now())return n();r.status(401).json({error:'Non autorisé'})};
const tries={};
app.post('/api/login',(q,r)=>{const ip=q.ip,t=tries[ip]=(tries[ip]||[]).filter(x=>Date.now()-x<9e5);if(t.length>=8)return r.status(429).json({error:'Trop d\'essais, réessayez plus tard'});
 const a=Buffer.from(String(q.body.password||'')),b=Buffer.from(ADMIN_PASSWORD);
 if(a.length===b.length&&crypto.timingSafeEqual(a,b))return r.json({token:sign(Date.now()+864e5)});t.push(Date.now());r.status(401).json({error:'Mot de passe incorrect'})});
app.get('/api/menu',async(q,r)=>{r.json({items:await Item.find({available:true}).sort({order:1,_id:1}),settings:await geo(await getS())})});
app.get('/api/admin/items',auth,async(q,r)=>r.json(await Item.find().sort({order:1,_id:1})));
app.post('/api/admin/items',auth,async(q,r)=>r.json(await Item.create(q.body)));
app.put('/api/admin/items/:id',auth,async(q,r)=>r.json(await Item.findByIdAndUpdate(q.params.id,q.body,{new:true})));
app.delete('/api/admin/items/:id',auth,async(q,r)=>{await Item.findByIdAndDelete(q.params.id);r.json({ok:true})});
app.get('/api/admin/settings',auth,async(q,r)=>r.json(await getS()));
app.put('/api/admin/settings',auth,async(q,r)=>{await Settings.findByIdAndUpdate('main',{data:q.body},{upsert:true});r.json(await getS())});
app.use(express.static('public'));
const AP='/'+(process.env.ADMIN_PATH||'labo-br35-ri15').replace(/^\/+/,'');
app.get(AP,(q,r)=>{r.set('X-Robots-Tag','noindex');r.sendFile(__dirname+'/private/gestion.html')});
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
  ['Riz au lait',5,'Kinder Bueno, Oreo ou M&M\'s.','riz-au-lait.jpg',''],['Smoothie',3,'','',''],['Soda',2.5,'','',''],['Eau 50cl',1.5,'','','']
  ].map(([name,price,description,ph,tag],i)=>({category:C,name,price,description,photo:ph?P+ph:'',tag,order:100+i})));
  await Settings.create({_id:'seed2',data:{}});
  const st=await Settings.findById('main');if(st?.data?.categories&&!st.data.categories.includes(C)){st.data.categories.unshift(C);st.markModified('data');await st.save()}}
 app.listen(process.env.PORT||3000,()=>console.log('OK admin:'+AP))}).catch(e=>{console.error(e);process.exit(1)});
