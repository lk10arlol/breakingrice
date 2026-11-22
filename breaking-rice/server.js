const express=require('express'),mongoose=require('mongoose'),crypto=require('crypto');
const app=express();app.use(express.json({limit:'6mb'}));
const {MONGODB_URI,ADMIN_PASSWORD}=process.env;
if(!MONGODB_URI||!ADMIN_PASSWORD){console.error('MONGODB_URI et ADMIN_PASSWORD requis');process.exit(1)}
const Item=mongoose.model('Item',new mongoose.Schema({name:String,category:String,description:String,price:Number,photo:String,allergens:String,tag:String,available:{type:Boolean,default:true},order:{type:Number,default:0}}));
const DEF={categories:['Crousty','Sandwichs','Tenders & Wings','Menus','Accompagnements','Sauces','Boissons','Desserts'],uberUrl:'https://www.ubereats.com/fr/store/breaking-rice-poulet-crousty-merignac/i6V0LUxyV96WUOl3v3YT_g',about:'Chez Breaking Rice, on cuisine le poulet crousty avec une pureté de 99,1 %. Riz parfumé, poulet croustillant, sauces maison : une formule qui ne laisse aucune trace… sauf dans votre mémoire.',hours:'Lun–Dim : 11h30 – 23h00',address:'Mérignac (33700)',phone:'',popup:{enabled:false,title:'',text:'',image:''},banner:{enabled:false,text:''}};
const Settings=mongoose.model('Settings',new mongoose.Schema({_id:String,data:Object},{minimize:false}));
const getS=async()=>({...DEF,...((await Settings.findById('main'))?.data||{})});
const sign=e=>{const p=String(e);return p+'.'+crypto.createHmac('sha256',ADMIN_PASSWORD).update(p).digest('hex')};
const auth=(q,r,n)=>{const t=(q.headers.authorization||'').replace('Bearer ','');const [e,s]=t.split('.');if(s&&t===sign(e)&&+e>Date.now())return n();r.status(401).json({error:'Non autorisé'})};
const tries={};
app.post('/api/login',(q,r)=>{const ip=q.ip,t=tries[ip]=(tries[ip]||[]).filter(x=>Date.now()-x<9e5);if(t.length>=8)return r.status(429).json({error:'Trop d\'essais, réessayez plus tard'});
 const a=Buffer.from(String(q.body.password||'')),b=Buffer.from(ADMIN_PASSWORD);
 if(a.length===b.length&&crypto.timingSafeEqual(a,b))return r.json({token:sign(Date.now()+864e5)});t.push(Date.now());r.status(401).json({error:'Mot de passe incorrect'})});
app.get('/api/menu',async(q,r)=>{r.json({items:await Item.find({available:true}).sort({order:1,_id:1}),settings:await getS()})});
app.get('/api/admin/items',auth,async(q,r)=>r.json(await Item.find().sort({order:1,_id:1})));
app.post('/api/admin/items',auth,async(q,r)=>r.json(await Item.create(q.body)));
app.put('/api/admin/items/:id',auth,async(q,r)=>r.json(await Item.findByIdAndUpdate(q.params.id,q.body,{new:true})));
app.delete('/api/admin/items/:id',auth,async(q,r)=>{await Item.findByIdAndDelete(q.params.id);r.json({ok:true})});
app.get('/api/admin/settings',auth,async(q,r)=>r.json(await getS()));
app.put('/api/admin/settings',auth,async(q,r)=>{await Settings.findByIdAndUpdate('main',{data:q.body},{upsert:true});r.json(await getS())});
app.use(express.static('public'));
app.get('/admin',(q,r)=>r.sendFile(__dirname+'/public/admin.html'));
mongoose.connect(MONGODB_URI).then(async()=>{
 if(!await Item.countDocuments())await Item.insertMany([
  ['Crousty Classique','Crousty','Riz, poulet frit croustillant, sauce au choix',9],
  ['Méga Crousty','Crousty','Double portion de poulet, riz parfumé, sauce au choix',12],
  ['Tenders x6','Tenders & Wings','6 tenders de poulet panés',7],
  ['Frites','Accompagnements','Frites croustillantes',3],
  ['Soda 33cl','Boissons','Au choix',2],
  ['Brownie','Desserts','Brownie fondant',3]].map(([name,category,description,price],i)=>({name,category,description,price,order:i,tag:i==0?'Best-seller':''})));
 app.listen(process.env.PORT||3000,()=>console.log('OK'))}).catch(e=>{console.error(e);process.exit(1)});
