/* 墨场：GitHub Pages + Supabase 云端同步。仅使用公开 Publishable/anon key。 */
(()=>{
'use strict';
const C='mochang_cloud_config_v2',S='mochang_cloud_session_v2',P='mochang_cloud_pending_v2',B='mochang_cloud_previous_local_v2';
const get=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const copy=o=>JSON.parse(JSON.stringify(o));
const $=s=>document.querySelector(s);
let config=get(C)||{},session=get(S),pending=get(P),api=null,revision=0,active=false,busy=false,conflict=false,timer=0,seq=0,modal,indicator,adapter,status='本机保存',recovering=false;
const usable=d=>Array.isArray(d?.projects)&&d.projects.length&&d.projects.every(p=>p&&typeof p.id==='string'&&Array.isArray(p.characters)&&Array.isArray(p.scenes));
const nonempty=d=>!!d?.projects?.some(p=>p.characters?.length||p.scenes?.length||p.timeline?.length||p.relations?.length||p.notes?.length||p.summary||p.logline||(p.name&&p.name!=='未命名作品'));
const safe=t=>String(t||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const valid=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test((config.url||'').trim())&&String(config.key||'').length>20&&!/service_role|sb_secret_/i.test(config.key);
function message(t,err){let e=$('#cloudMsg');if(e){e.textContent=t;e.style.color=err?'#a63842':'#337860'}}
function setStatus(t){status=t;if(indicator){indicator.textContent='☁ '+t;indicator.title='云端账号与同步';indicator.style.color=/已同步|已保存/.test(t)?'#337860':/冲突|失败/.test(t)?'#a63842':'#705650'}}
function backup(data){if(nonempty(data)){try{put(B,{date:new Date().toISOString(),data:copy(data)})}catch{}}}
function download(data){let blob=new Blob([JSON.stringify({app:'墨场',version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='墨场_保护备份_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
async function request(path,method,body,needsAuth=true,mayRetry=true){
 if(!valid())throw Error('请先填写有效的 Supabase URL 与 publishable/anon key');
 if(needsAuth&&session?.expires_at&&Date.now()/1000>session.expires_at-60)await refresh();
 let headers={'apikey':config.key,'Content-Type':'application/json'};
 if(needsAuth){if(!session?.access_token)throw Error('请先登录');headers.Authorization='Bearer '+session.access_token}
 let response=await fetch(config.url+path,{method:method||'GET',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(response.status===401&&needsAuth&&mayRetry&&session?.refresh_token){await refresh();return request(path,method,body,true,false)}
 let data;try{data=await response.json()}catch{data=null}
 if(!response.ok)throw Error(data?.message||data?.error_description||data?.error||'服务返回 HTTP '+response.status);
 return data
}
let refreshing;
async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{let s=await request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token},false);session={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)};put(S,session);return session})();try{return await refreshing}finally{refreshing=null}}
async function readRemote(){let rows=await request('/rest/v1/mochang_documents?select=data,revision,updated_at&limit=1');return rows?.[0]||null}
async function writeRemote(data,old){return request('/rest/v1/rpc/mochang_save','POST',{p_data:data,p_expected_revision:old})}
function apply(data){if(!usable(data))throw Error('云端数据格式异常，已保护本机稿件');adapter.apply(copy(data))}
function protectPending(){if(pending?.data)backup(pending.data)}
async function connect(){
 if(!session?.access_token)return;
 setStatus('连接中…');
 try{
  let who=await request('/auth/v1/user');session.user=who;put(S,session);
  let uid=who.id,cloud=await readRemote(),draft=get(P);
  if(draft?.user_id!==uid&&usable(draft?.data)){backup(draft.data);pending=null;localStorage.removeItem(P)}
  if(draft?.user_id===uid&&usable(draft.data)){
   if((cloud?.revision||0)!==draft.revision){pending=draft;conflict=true;active=false;setStatus('版本冲突');open();message('云端和本机都有修改，已停止自动覆盖。请先导出备份并选择要保留的版本。',true);return}
   pending=draft;revision=draft.revision;active=true;conflict=false;apply(draft.data);setStatus('待同步');setTimeout(flush,160);return
  }
  if(!cloud){
   let data=adapter.read();
   if(nonempty(data)&&!confirm('云端还没有稿件。是否将本机已有作品上传作为初始云端稿件？\n取消后会继续本机保存，不会删除作品。')){setStatus('未启用同步');return}
   let done=await writeRemote(data,0);revision=Number(done.revision);active=true;conflict=false;pending=null;localStorage.removeItem(P);setStatus('云端已保存');return
  }
  if(!usable(cloud.data))throw Error('云端稿件格式异常，已停止加载');
  if(nonempty(adapter.read())&&JSON.stringify(adapter.read().projects)!==JSON.stringify(cloud.data.projects))backup(adapter.read());
  revision=Number(cloud.revision);active=true;conflict=false;pending=null;localStorage.removeItem(P);apply(cloud.data);setStatus('已同步');
 }catch(e){setStatus('连接失败');message(e.message,true)}
}
function queue(data){
 if(!active||conflict||!session?.user?.id)return;
 pending={user_id:session.user.id,revision,data:copy(data),sequence:++seq};try{put(P,pending)}catch{setStatus('本机空间不足');return}
 setStatus('待同步');clearTimeout(timer);timer=setTimeout(flush,1100)
}
async function flush(){
 if(!active||busy||conflict||!pending)return;
 busy=true;let snap=pending;setStatus('保存中…');
 try{
  let result=await writeRemote(snap.data,revision);revision=Number(result.revision);
  if(pending?.sequence===snap.sequence){pending=null;localStorage.removeItem(P);setStatus('云端已保存')}
  else if(pending){pending.revision=revision;put(P,pending);setStatus('继续同步…');setTimeout(flush,80)}
 }catch(e){
  if(String(e.message).includes('SYNC_CONFLICT')){conflict=true;setStatus('版本冲突');open();message('另一台设备已修改云端内容。本机草稿已保留，先下载备份再选择版本。',true)}
  else setStatus(navigator.onLine?'同步失败':'离线待同步')
 }finally{busy=false}
}
async function adoptCloud(){
 if(pending&&!confirm('本机还有未同步内容。建议先下载备份。确定改用云端版本吗？'))return;
 protectPending();let cloud=await readRemote();if(!usable(cloud?.data))throw Error('没有找到有效云端作品');
 revision=Number(cloud.revision);pending=null;localStorage.removeItem(P);active=true;conflict=false;apply(cloud.data);setStatus('已同步')
}
async function overrideCloud(){
 if(!confirm('确认使用本机草稿覆盖当前云端稿件？其他设备的最新修改可能被替换。请先下载备份。'))return;
 let old=await readRemote(),data=pending?.data||adapter.read();
 if(!usable(data))throw Error('本机稿件无效');if(old?.data)backup(old.data);
 let done=await writeRemote(data,old?.revision||0);revision=Number(done.revision);pending=null;localStorage.removeItem(P);active=true;conflict=false;apply(data);setStatus('云端已保存')
}
async function importOld(){
 let old=get(B);if(!usable(old?.data))throw Error('没有找到本机旧稿');
 if(!active||conflict)throw Error('请先连接云端或解决冲突');
 if(!confirm('将旧稿的作品作为新项目追加到云端吗？现有云端作品不会删除。'))return;
 let data=copy(adapter.read());for(let proj of old.data.projects){let p=copy(proj);p.id='old_'+Date.now()+'_'+Math.random().toString(36).slice(2);p.name=(p.name||'未命名作品')+'（旧稿）';data.projects.push(p)}
 apply(data);queue(data);setStatus('旧稿待同步')
}
async function signup(){
 let email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value;
 if(!email||password.length<6)throw Error('请输入邮箱和至少 6 位密码');
 let s=await request('/auth/v1/signup','POST',{email,password},false);
 if(s?.access_token){session={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)};put(S,session);await connect();open()}
 else message('注册请求已提交，请按 Supabase 邮件提示完成验证，再登录')
}
async function login(){
 let email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value;
 if(!email||!password)throw Error('请输入邮箱和密码');
 let s=await request('/auth/v1/token?grant_type=password','POST',{email,password},false);
 session={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)};put(S,session);await connect();open()
}
async function logout(){
 if(pending&&!confirm('仍有尚未同步的草稿，请先下载备份。确定退出吗？'))return;
 protectPending();backup(adapter.read());
 try{await request('/auth/v1/logout','POST',undefined,true)}catch{}
 active=false;conflict=false;session=null;pending=null;revision=0;localStorage.removeItem(S);localStorage.removeItem(P);adapter.apply(adapter.blank());setStatus('本机保存');open()
}
function close(){modal.classList.remove('open')}
function open(){
 if(!modal)return;
 modal.classList.add('open');let el=$('#cloudBody');
 if(!valid()){
  el.innerHTML='<p>配置一次你自己的 Supabase 项目，之后即可使用邮箱登录。请先在数据库运行仓库中的 supabase/schema.sql。</p><label>Project URL</label><input id="cloudUrl" placeholder="https://xxxx.supabase.co" value="'+safe(config.url)+'"><label>Publishable / anon key（公开密钥）</label><input id="cloudKey" value="'+safe(config.key)+'" placeholder="sb_publishable_..." autocomplete="off"><p class="hint">不要填写 sb_secret_、service_role、数据库密码。公开的 publishable/anon Key 可以用于网页，但必须启用数据库 RLS。</p><div class="actions"><button id="cloudSet" class="primary">保存设置</button></div><p id="cloudMsg"></p>';
  $('#cloudSet').onclick=()=>{let url=$('#cloudUrl').value.trim().replace(/\/+$/,''),key=$('#cloudKey').value.trim();config={url,key};if(!valid()){message('URL 或公开 Key 格式不正确，请不要填写私密密钥。',true);return}try{put(C,config);open()}catch(e){message('本机无法保存设置：'+e.message,true)}};return
 }
 if(recovering&&session?.access_token){
  el.innerHTML='<p>密码重置链接已验证。请为账号设置新密码。</p><label>新密码</label><input id="cloudNewPassword" type="password" autocomplete="new-password"><div class="actions"><button class="primary" id="cloudUpdatePass">保存新密码</button></div><p id="cloudMsg"></p>';
  wire('#cloudUpdatePass',async()=>{let password=$('#cloudNewPassword').value;if(password.length<6)throw Error('新密码至少6位');await request('/auth/v1/user','PUT',{password});recovering=false;await connect();open()});return
 }
 if(!session?.access_token){
  el.innerHTML='<p>登录同一邮箱账号，即可在手机、电脑上继续写作。第一次登录会保护你现有的本机作品。</p><label>邮箱</label><input id="cloudEmail" type="email" autocomplete="username"><label>密码</label><input id="cloudPassword" type="password" autocomplete="current-password"><div class="actions"><button id="cloudLogin" class="primary">登录</button><button id="cloudSignup">注册</button><button id="cloudReset">找回密码</button><button id="cloudCfg">更换项目</button></div><p id="cloudMsg"></p><p class="hint">如果邮箱验证已开启，注册后需先验证邮件。你可以在 Supabase → Authentication 中管理用户。</p>';
  wire('#cloudLogin',login);wire('#cloudSignup',signup);
  wire('#cloudReset',async()=>{let email=$('#cloudEmail').value.trim();if(!email)throw Error('先填写邮箱');await request('/auth/v1/recover','POST',{email},false);message('如果账号存在，将收到密码重置邮件。')});
  $('#cloudCfg').onclick=()=>{config={};localStorage.removeItem(C);open()};return
 }
 el.innerHTML='<p>已登录：'+safe(session.user?.email||'Supabase 账号')+'<br>状态：'+safe(status)+'<br>云端版本：'+revision+'</p><p class="hint">编辑后先存本机，随后自动同步。如两台设备同时修改，系统会暂停覆盖并提示处理冲突。</p><div class="actions"><button id="cloudSync" class="primary">立即同步</button><button id="cloudBackup">下载本机备份</button>'+(get(B)?.data?'<button id="cloudImport">追加导入旧稿</button>':'')+(pending||conflict?'<button id="cloudRemote">改用云端版本</button><button id="cloudLocal">用本机覆盖云端</button>':'')+'<button id="cloudLogout">退出账号</button></div><p id="cloudMsg"></p>';
 wire('#cloudSync',async()=>{if(!active)await connect();else await flush()});
 wire('#cloudRemote',adoptCloud);wire('#cloudLocal',overrideCloud);wire('#cloudImport',importOld);wire('#cloudLogout',logout);
 $('#cloudBackup').onclick=()=>download(pending?.data||adapter.read())
}
function wire(sel,fn){let node=$(sel);if(!node)return;node.onclick=async()=>{node.disabled=true;try{await fn()}catch(e){message(e.message,true)}finally{node.disabled=false}}}
async function refreshIfChanged(){
 if(!active||pending||busy||conflict||!navigator.onLine)return;
 try{let v=await readRemote();if(v&&v.revision>revision&&usable(v.data)){backup(adapter.read());revision=Number(v.revision);apply(v.data);setStatus('已同步')}}catch{}
}
function init(helpers){
 adapter=helpers;
 let style=document.createElement('style');
 style.textContent='.cloud-indicator{border:1px solid #dfd7cc;background:#fffdf8;border-radius:8px;padding:6px 10px;cursor:pointer;color:#705650;font:inherit;white-space:nowrap}.cloud-overlay{position:fixed;inset:0;z-index:250;display:none;place-items:center;background:#201a19a9;padding:15px}.cloud-overlay.open{display:grid}.cloud-panel{background:#fffdf8;border-radius:14px;padding:20px;width:min(520px,100%);max-height:90dvh;overflow:auto;color:#302b29}.cloud-panel h2{font:600 21px serif;margin:0 0 12px}.cloud-panel p{font-size:13px;line-height:1.7;margin:10px 0;color:#6e6158}.cloud-panel label{display:block;margin-top:12px;font-size:12px}.cloud-panel input{display:block;width:100%;box-sizing:border-box;border:1px solid #d7cec1;border-radius:8px;padding:10px;margin-top:4px;font-size:16px}.cloud-panel .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.cloud-panel button{cursor:pointer;background:#fffdf8;border:1px solid #ded2c8;color:#584e46;border-radius:8px;padding:9px 12px}.cloud-panel button.primary{background:#8f3e40;color:white;border-color:#8f3e40}.cloud-panel .hint{background:#f8f2eb;padding:10px;border-radius:7px}.cloud-close{float:right}.cloud-panel #cloudMsg{color:#337860}@media(max-width:600px){.cloud-overlay{align-items:end;padding:0}.cloud-panel{width:100%;max-height:92dvh;border-radius:15px 15px 0 0}}';
 document.head.append(style);
 modal=document.createElement('div');modal.className='cloud-overlay';modal.innerHTML='<div class="cloud-panel" role="dialog" aria-modal="true"><button class="cloud-close" id="cloudClose">✕</button><h2>云端账号与同步</h2><div id="cloudBody"></div></div>';document.body.append(modal);
 $('#cloudClose').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close()});
 indicator=document.createElement('button');indicator.className='cloud-indicator';indicator.onclick=open;$('.top-actions')?.prepend(indicator);setStatus(status);
 let menu=$('#mobileMenu .mobile-menu-items');if(menu){let item=document.createElement('button');item.innerHTML='<span>☁</span> 云端账号与同步 <b>›</b>';item.onclick=()=>{document.getElementById('mobileMenu')?.classList.remove('open');document.getElementById('mobileMenuBackdrop').hidden=true;document.body.classList.remove('menu-open');open()};menu.append(item)}
 // 兼容邮箱验证及密码重置邮件带回的短期登录令牌。
 let hash=location.hash.startsWith('#')?new URLSearchParams(location.hash.slice(1)):null;
 recovering=hash?.get('type')==='recovery';
 if(hash?.get('access_token')&&hash.get('refresh_token')){session={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)};put(S,session);history.replaceState(null,'',location.pathname+location.search)}
 if(valid()&&session?.access_token){if(recovering)open();else connect()}
 window.addEventListener('online',()=>{if(pending)flush();else refreshIfChanged()});
 window.addEventListener('focus',()=>{if(pending)flush();else refreshIfChanged()});
 setInterval(()=>{if(active&&!document.hidden){if(pending)flush();else refreshIfChanged()}},30000);
}
window.MochangCloud={init,queue,openPanel:open};
})();