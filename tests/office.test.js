import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
async function start(dir){const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'0',DATA_DIR:dir,OFFICE_PASSWORD:'test-password'},stdio:['ignore','pipe','pipe']});let out='';const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',b=>{out+=b;const m=out.match(/port (\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);child.on('exit',c=>{if(c)reject(Error('server exited '+c));});});return {child,base:'http://127.0.0.1:'+port};}
async function stop(child){child.kill();await new Promise(r=>child.once('exit',r));}
test('private office: functional workflow, uploads, validation, restart persistence',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'office-test-'));let s=await start(dir);try{
const request=async(url,method='GET',b,extra={})=>{const r=await fetch(s.base+url,{method,headers:{'X-Office-Password':'test-password',...extra},body:b===undefined?undefined:typeof b==='string'?b:JSON.stringify(b)});return {status:r.status,data:await r.json()};};
assert.equal((await fetch(s.base+'/api/state')).status,401);assert.equal((await fetch(s.base+'/')).status,200);
const made=await request('/api/projects','POST',{name:'บ้านทดสอบ'});assert.equal(made.status,201);const id=made.data.id,url='/api/projects/'+id;
assert.equal((await request(url,'PATCH',{house:{width:-1}})).status,400);
let p=(await request(url,'PATCH',{action:'task',role:'architect',text:'บ้าน 3 ห้องนอน'})).data;assert.equal(p.tasks.length,1);const task=p.tasks[0].id;
p=(await request(url,'PATCH',{action:'answer',taskId:task,answer:'ผังแนวคิด'})).data;assert.equal(p.tasks.length,1);assert.equal(p.tasks[0].status,'รอตรวจอนุมัติ');
p=(await request(url,'PATCH',{action:'approve',taskId:task})).data;assert.equal(p.tasks.length,2);assert.equal(p.tasks[1].role,'draft');await request(url,'PATCH',{action:'approve',taskId:task});assert.equal((await request('/api/state')).data.projects[0].tasks.length,2);
p=(await request(url,'PATCH',{mode:'auto',action:'answer',taskId:p.tasks[1].id,answer:'ตารางวัสดุและค่าแรง'})).data;assert.equal(p.tasks[2].role,'engineer');assert.equal(p.tasks[1].status,'อนุมัติแล้ว');
assert.equal((await request(url,'PATCH',{action:'answer',taskId:task,answer:'แก้คำตอบที่อนุมัติแล้ว'})).status,400);
const f=await request(url+'/files','POST','sample pdf',{'X-File-Name':encodeURIComponent('แบบบ้าน.pdf')});assert.equal(f.status,201);const bytes=await fetch(s.base+'/api/files/'+f.data.id,{headers:{'X-Office-Password':'test-password'}});assert.equal(await bytes.text(),'sample pdf');assert.equal((await request(url+'/files','POST','bad',{'X-File-Name':'bad.exe'})).status,400);
await stop(s.child);s=await start(dir);const persisted=(await request('/api/state')).data.projects[0];assert.equal(persisted.tasks.length,3);assert.equal(persisted.files.length,1);assert.equal(persisted.tasks[0].answer,'ผังแนวคิด');
}finally{await stop(s.child);await rm(dir,{recursive:true,force:true});}});
