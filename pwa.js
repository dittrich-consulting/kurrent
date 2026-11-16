const status=document.getElementById('offlineStatus'),install=document.getElementById('installApp'),update=document.getElementById('updateApp');
let prompt=null,registration;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;install.hidden=false;});
install.onclick=async()=>{if(!prompt)return;await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;};
window.addEventListener('appinstalled',()=>{install.hidden=true;prompt=null;});
function showUpdate(){if(registration?.waiting)update.hidden=false;}
let reloading=false;
navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
update.onclick=()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage('ACTIVATE');}};
if('serviceWorker' in navigator&&window.isSecureContext){
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  showUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')showUpdate();if(worker.state==='redundant')status.textContent='Offline setup did not finish. Reconnect and reopen this page to retry.';});});
  await navigator.serviceWorker.ready;
  const ready=()=>{status.textContent=navigator.onLine?'Ready for offline practice · saved on this device':'Offline · practice and statistics available';};
  ready();window.addEventListener('online',ready);window.addEventListener('offline',ready);
  navigator.storage?.persist?.().catch(()=>{});
 }catch{status.textContent='Offline setup could not finish. Reconnect and reload this page to retry.';}
}else status.textContent='Offline installation needs HTTPS. Open the published GitHub Pages address in Chrome.';
