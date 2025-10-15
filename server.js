import express from 'express';import fs from 'fs';import path from 'path';import PDFDocument from 'pdfkit';import cors from 'cors';import dotenv from 'dotenv';import {v4 as uuidv4} from 'uuid';dotenv.config();
const app=express();app.use(cors());app.use(express.json({limit:'20mb'}));
const OUT_DIR=path.join(process.cwd(),'submissions');fs.mkdirSync(OUT_DIR,{recursive:true});
app.post('/api/osd/submit',async(req,res)=>{try{const d=req.body;const ref=uuidv4().slice(0,8);const file=path.join(OUT_DIR,`OSD_${ref}.pdf`);
await buildPDF(d,file);res.json({ok:true,ref});}catch(e){res.status(500).json({error:e.message});}});
function buildPDF(d,f){return new Promise((res,rej)=>{const doc=new PDFDocument({margin:40});const s=fs.createWriteStream(f);
doc.pipe(s);doc.fontSize(20).text('OSD – Driver Sign-Off');doc.moveDown();
doc.fontSize(12).text(`Date: ${d.date}`);doc.text(`Carrier: ${d.carrier}`);doc.text(`Driver: ${d.driverName}`);doc.text(`BOL #: ${d.bol}`);doc.text(`PO #: ${d.po}`);doc.moveDown();
doc.text('Notes:');doc.text(d.notes||'(none)');if(d.signatureDataUrl){try{const buf=Buffer.from(d.signatureDataUrl.split(',')[1],'base64');doc.addPage();doc.text('Signature:');doc.image(buf,{fit:[400,120]});}catch{}}
doc.end();s.on('finish',res);s.on('error',rej);});}
app.listen(process.env.PORT||8080);
