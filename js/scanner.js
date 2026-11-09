/* ONE JLL Year-End Party 2026: QR check-in scanner (camera via jsQR), plus
   typed code or name lookup. Uses window.JLLAdmin from admin.js for the
   roster and the check-in call. Pattern from the Lhabab Stupa scanner. */
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const A = () => window.JLLAdmin;
  let stream = null, raf = null, paused = false, lastCode = '', lastTime = 0;
  const canvas = document.createElement('canvas');

  function result(kind, title, big, sub){
    const el = $('scanResult');
    el.className = 'result ' + (kind || '');
    el.innerHTML = '<div class="eyebrow small">' + title + '</div><div class="big">' + big + '</div><div class="sub">' + (sub || '') + '</div>';
  }

  async function start(){
    if(!window.jsQR){ result('bad', 'Error', 'QR library did not load', 'Check the internet connection and reload.'); return; }
    try{
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = $('scanVideo'); v.srcObject = stream; await v.play();
      paused = false; loop();
      result('', 'Camera on', 'Scan a QR code', 'Hold the code inside the frame');
    }catch(err){
      console.error('camera failed', err);
      result('bad', 'Camera', 'Could not open the camera', 'Allow camera access for this site and make sure you are on HTTPS.');
    }
  }
  function stop(){
    if(raf) cancelAnimationFrame(raf); raf = null;
    if(stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    const v = $('scanVideo'); if(v) v.srcObject = null;
  }
  function loop(){
    const v = $('scanVideo');
    if(!paused && v.readyState === v.HAVE_ENOUGH_DATA){
      canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if(code && code.data){
        const now = Date.now();
        if(code.data !== lastCode || now - lastTime > 4000){ lastCode = code.data; lastTime = now; process(code.data); }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  async function process(raw){
    paused = true;
    const m = String(raw).toUpperCase().match(/JLL-W?\d{5,6}/);
    const id = m ? m[0] : String(raw).trim().toUpperCase();
    result('', 'Checking', id, '');
    try{
      let g = A().find(id);
      if(!g){ await A().reload(); g = A().find(id); }
      if(!g){ result('bad', 'Not found', id, 'No RSVP with this code. Add the guest as a walk-in.'); beep(220); return; }
      if(g.checked_in){
        result('again', 'Already checked in at ' + A().fmtTime(g.checked_in_at), A().esc(A().fullName(g)), A().esc(g.business_line)); beep(440); return;
      }
      const upd = await A().checkIn(g.id, true);
      if(upd) { result('ok', 'Welcome!', A().esc(A().fullName(upd)), A().esc(upd.business_line) + ' &middot; ' + A().fmtTime(upd.checked_in_at)); beep(880); }
      else result('bad', 'Error', 'Check-in did not save', 'Try again or use the guest list.');
    }finally{ setTimeout(() => { paused = false; }, 1500); }
  }

  function beep(freq){
    try{
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.start(); o.stop(ctx.currentTime + 0.2);
    }catch(e){ /* sound is a nicety; silent failure is fine */ }
  }

  /* typed code or name */
  $('manualForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('manualCode').value.trim(); if(!q) return;
    $('manualMatches').innerHTML = '';
    if(/^JLL-W?\d{5,6}$/i.test(q)){ process(q); return; }
    const hits = A().search(q);
    if(!hits.length){ result('bad', 'Not found', A().esc(q), 'No guest matches. Check the spelling or add a walk-in.'); return; }
    $('manualMatches').innerHTML = hits.map(g => '<button class="btn sm ghost" style="margin:4px" data-id="' + A().esc(g.id) + '">'
      + A().esc(A().fullName(g)) + ' <span class="small">(' + A().esc(g.business_line) + (g.checked_in ? ', in' : '') + ')</span></button>').join('');
  });
  $('manualMatches').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]'); if(!b) return;
    $('manualMatches').innerHTML = ''; $('manualCode').value = '';
    process(b.dataset.id);
  });

  $('scanStart').addEventListener('click', start);
  $('scanStop').addEventListener('click', () => { stop(); result('', 'Camera off', 'Scanner stopped', ''); });
  window.addEventListener('pagehide', stop);
  window.JLLScanner = { start, stop };
})();
