const { randomBytes } = require('node:crypto');

const SERVICES = new Set(['Wash & fold','Dry cleaning','Both wash & fold and dry cleaning','Not sure yet']);
const WINDOWS = new Set(['Morning','Afternoon','Evening','Flexible']);
const val = (v,n=200) => typeof v === 'string' ? v.trim().slice(0,n) : '';
const safe = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 180;
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s+'T12:00:00Z')) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const get = o => ({
 requestType:val(o.requestType,20),service:val(o.service,100),orderNumber:val(o.orderNumber,80),
 items:val(o.items,1200),address:val(o.address,180),unit:val(o.unit,60),city:val(o.city,90),
 zip:val(o.zip,10),requestedDate:val(o.requestedDate,10),timeWindow:val(o.timeWindow,20),
 firstName:val(o.firstName,65),lastName:val(o.lastName,65),email:val(o.email,180),
 phone:val(o.phone,30),contactConsent:val(o.contactConsent,12),website:val(o.website,500)
});
function validate(d) {
 if(d.website)return 'spam';
 if(!['pickup','delivery'].includes(d.requestType))return 'Select pickup or delivery.';
 if(d.requestType==='pickup'&&!SERVICES.has(d.service))return 'Select a valid service.';
 if(!d.address||!d.city||!/^\d{5}(?:-\d{4})?$/.test(d.zip))return 'Enter a valid street address, city, and ZIP code.';
 if(!validDate(d.requestedDate))return 'Enter a valid preferred date.';
 if(!WINDOWS.has(d.timeWindow))return 'Select a time window.';
 if(!d.firstName||!d.lastName)return 'Enter your full name.';
 if(!validEmail(d.email))return 'Enter a valid email address.';
 if((d.phone.match(/\d/g)||[]).length<10)return 'Enter a valid phone number.';
 if(!['on','true'].includes(d.contactConsent))return 'Please allow us to contact you about the request.';
 return null;
}
async function sendEmail(apiKey, from, to, subject, html, replyTo) {
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html,...(replyTo?{reply_to:replyTo}:{})})});
 if(!response.ok)throw Error('Email provider error '+response.status);
}
function details(d,ref) {
 const fields=[
 ['Request type',d.requestType],['Service / order reference',d.requestType==='pickup'?d.service:(d.orderNumber||'Not supplied')],
 ['Name',d.firstName+' '+d.lastName],['Email',d.email],['Phone',d.phone],
 ['Location',[d.address,d.unit,d.city,d.zip].filter(Boolean).join(', ')],
 ['Preferred date',d.requestedDate],['Preferred time',d.timeWindow],['Notes',d.items||'None']
 ];
 return '<div style="font-family:Arial,sans-serif;color:#183953;background:#edf5ff;padding:24px"><div style="max-width:650px;margin:auto;background:white;padding:28px;border-radius:16px"><h1 style="color:#2359e5">Apollo Laundry</h1><h2>New '+safe(d.requestType)+' request</h2><p>Reference: '+safe(ref)+' — not yet confirmed. Contact the customer to schedule.</p><table style="border-collapse:collapse;width:100%">'+fields.map(([k,v])=>'<tr><th style="border-bottom:1px solid #ddd;text-align:left;padding:10px">'+safe(k)+'</th><td style="border-bottom:1px solid #ddd;padding:10px;white-space:pre-wrap">'+safe(v)+'</td></tr>').join('')+'</table></div></div>';
}
module.exports=async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,error:'Method not allowed.'});}
 if(!String(req.headers['content-type']||'').toLowerCase().includes('application/json'))return res.status(415).json({success:false,error:'JSON is required.'});
 if(Number(req.headers['content-length']||0)>30000)return res.status(413).json({success:false,error:'Request too large.'});
 let body=req.body;
 if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({success:false,error:'Invalid JSON.'})}}
 if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({success:false,error:'Invalid request.'});
 const d=get(body),err=validate(d);
 if(err==='spam')return res.status(200).json({success:true,reference:'RECEIVED'});
 if(err)return res.status(400).json({success:false,error:err});
 const {RESEND_API_KEY:key,APOLLO_REQUEST_EMAIL:inbox,APOLLO_FROM_EMAIL:sender}=process.env;
 if(!key||!validEmail(inbox||'')||!sender||!validEmail(sender.replace(/^.*?<([^>]+)>$/,'$1')))return res.status(503).json({success:false,error:'Online requests are not activated yet.'});
 const ref='AP-'+randomBytes(4).toString('hex').toUpperCase();
 try{
   await sendEmail(key,sender,inbox,'[Apollo] New '+d.requestType+' request · '+ref,details(d,ref),d.email);
   if(process.env.APOLLO_SEND_CUSTOMER_CONFIRMATION==='true'){
     const ack='<div style="font-family:Arial,sans-serif;color:#183953"><h2>Apollo received your request.</h2><p>Hi '+safe(d.firstName)+', thanks for reaching out. Your '+safe(d.requestType)+' request ('+safe(ref)+') has been received.</p><p><b>This is not a confirmed appointment.</b> Our team will contact you to confirm availability, scheduling and pricing.</p></div>';
     try{await sendEmail(key,sender,d.email,'Apollo request received · '+ref,ack)}catch{}
   }
   return res.status(200).json({success:true,reference:ref});
 }catch{return res.status(502).json({success:false,error:'Your request could not be sent. Please try again.'});}
};