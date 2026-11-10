/* ONE JLL Year-End Party 2026: RSVP page logic.
   Reads window.JLL (js/config.js). Saves through the rsvp_register RPC only
   (guests never read the table) and renders a QR ticket the guest can
   download or print. The confirmation email is sent by the database itself
   (webhook -> edge function send-confirmation -> Resend), not by this page. */
(function(){
  'use strict';
  const C = window.JLL;
  const EV = C.EVENT;
  const $ = (id) => document.getElementById(id);

  const sbReady = C.SUPABASE_URL.indexOf('YOUR_') !== 0 && C.SUPABASE_ANON_KEY.indexOf('YOUR_') !== 0 && window.supabase;
  const sb = sbReady ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

  /* ---------- static text from config ---------- */
  $('factDate').textContent = EV.date_text;
  $('factTime').textContent = EV.time_text;
  $('factReg').textContent = '(' + EV.registration_text.charAt(0).toLowerCase() + EV.registration_text.slice(1) + ')';
  $('factVenue').href = EV.venue_map;
  $('factVenue').querySelector('span').textContent = EV.venue;
  $('dressCode').textContent = EV.dress;
  $('tkDate').textContent = EV.date_text;
  $('tkVenue').textContent = EV.venue;
  $('tkTime').textContent = EV.time_text + ' (' + EV.registration_text.toLowerCase() + ')';
  $('contactLink').href = 'mailto:' + C.CONTACT_EMAIL; $('contactLink').textContent = C.CONTACT_EMAIL;
  const sel = $('businessLine');
  C.BUSINESS_LINES.forEach(bl => { const o = document.createElement('option'); o.value = bl; o.textContent = bl; sel.appendChild(o); });
  $('calBtn').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(EV.name)
    + '&dates=' + EV.gcal_start + '/' + EV.gcal_end
    + '&location=' + encodeURIComponent(EV.venue)
    + '&details=' + encodeURIComponent(EV.dress + '. ' + EV.registration_text + '.');

  if(!sb){
    $('setupBanner').classList.add('show');
    $('submitBtn').disabled = true;
  }

  /* ---------- helpers ---------- */
  function show(view){
    ['formView','findView','successView'].forEach(v => { $(v).style.display = v === view ? 'block' : 'none'; });
    if(view !== 'successView') document.body.classList.remove('ticket-view');
  }
  function setErr(id, on){
    const el = $('err-' + id), input = $(id);
    if(el) el.style.display = on ? 'block' : 'none';
    if(input) input.setAttribute('aria-invalid', on ? 'true' : 'false');
  }
  function banner(id, msg, kind){
    const el = $(id);
    el.textContent = msg || '';
    el.className = 'banner ' + (kind || 'bad') + (msg ? ' show' : '');
  }
  function busy(on){
    $('submitBtn').disabled = on || !sb;
    $('submitLabel').innerHTML = on ? '<span class="spinner"></span> Saving your RSVP' : 'Confirm my RSVP';
  }
  function newId(){
    const n = Math.floor(100000 + Math.random() * 900000);
    return C.ID_PREFIX + '-' + n;
  }
  function cleanPhone(v){ return String(v || '').replace(/[^\d+]/g, ''); }
  function validPhone(v){ const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 13; }
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function titleCase(s){ return String(s || '').trim().replace(/\s+/g, ' '); }
  function qrUrl(id){ return 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=1&data=' + encodeURIComponent(id); }

  /* ---------- ticket ---------- */
  function renderTicket(rec, opts){
    opts = opts || {};
    $('tkName').textContent = rec.first_name + ' ' + rec.last_name;
    $('tkLine').textContent = rec.business_line;
    $('tkCode').textContent = rec.id;
    $('tkQr').src = qrUrl(rec.id);
    banner('successBanner', opts.message || ("You're on the list! See you on December 11."), opts.kind || 'ok');
    const es = $('emailState');
    es.style.display = 'none';
    show('successView');
    $('rsvpCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function emailState(ok, msg){
    const es = $('emailState');
    es.style.display = 'block';
    es.className = 'emailstate ' + (ok ? 'ok' : 'warn');
    es.textContent = msg;
  }

  function emailNotice(rec){
    emailState(true, 'Your confirmation with this QR code is on its way to ' + rec.email + '. Check Spam or Junk if it is not there in a few minutes.');
  }

  /* ---------- submit ---------- */
  $('rsvpForm').addEventListener('submit', async function(e){
    e.preventDefault();
    banner('formBanner', '');
    const lastName = titleCase($('lastName').value);
    const firstName = titleCase($('firstName').value);
    const businessLine = $('businessLine').value;
    const email = $('email').value.trim().toLowerCase();
    const contact = cleanPhone($('contact').value);
    let bad = false;
    setErr('lastName', !lastName); bad = bad || !lastName;
    setErr('firstName', !firstName); bad = bad || !firstName;
    setErr('businessLine', !businessLine); bad = bad || !businessLine;
    setErr('email', !validEmail(email)); bad = bad || !validEmail(email);
    setErr('contact', !validPhone(contact)); bad = bad || !validPhone(contact);
    if(bad){ banner('formBanner', 'Please check the highlighted fields.'); return; }
    if(!sb){ banner('formBanner', 'Registration is not open yet. Please try again later.'); return; }

    busy(true);
    try{
      let res = null, tries = 0;
      while(tries < 3){
        tries++;
        const { data, error } = await sb.rpc('rsvp_register', {
          p_id: newId(), p_last: lastName, p_first: firstName, p_line: businessLine, p_email: email, p_contact: contact
        });
        if(error && error.code === '23505' && /rsvps_pkey/.test(error.message || '')) continue; // id collision: new id, try again
        if(error) throw error;
        res = data; break;
      }
      if(!res) throw new Error('Could not get a unique RSVP code. Please try again.');
      if(res.duplicate){
        renderTicket(res, { message: 'This email is already on the list, so here is the QR code we have for it.', kind: 'warn' });
        emailState(false, 'Need the email again? Use "Find my QR code" or ask the committee.');
      }else{
        renderTicket(res);
        $('rsvpForm').reset();
        emailNotice(res);
      }
    }catch(err){
      console.error('rsvp failed', err);
      banner('formBanner', 'Sorry, your RSVP could not be saved: ' + (err.message || err) + '. Please try again or contact the committee.');
    }finally{ busy(false); }
  });

  /* ---------- find my QR ---------- */
  $('findLink').addEventListener('click', () => { show('findView'); $('findEmail').focus(); });
  $('findBack').addEventListener('click', () => show('formView'));
  $('findForm').addEventListener('submit', async function(e){
    e.preventDefault();
    setErr('findEmail', false);
    const email = $('findEmail').value.trim().toLowerCase();
    if(!validEmail(email) || !sb){ setErr('findEmail', true); return; }
    $('findBtn').disabled = true;
    try{
      const { data, error } = await sb.rpc('rsvp_lookup', { p_email: email });
      if(error) throw error;
      if(!data){ setErr('findEmail', true); return; }
      renderTicket(data, { message: 'Here is your QR code again.', kind: 'ok' });
    }catch(err){
      console.error('lookup failed', err);
      setErr('findEmail', true);
    }finally{ $('findBtn').disabled = false; }
  });

  /* ---------- ticket actions ---------- */
  $('againBtn').addEventListener('click', () => { show('formView'); $('lastName').focus(); });
  $('printBtn').addEventListener('click', () => window.print());
  $('dlBtn').addEventListener('click', async function(){
    const btn = this; btn.disabled = true;
    try{
      const canvas = await html2canvas($('ticket'), { useCORS: true, backgroundColor: '#ffffff', scale: 2 });
      const a = document.createElement('a');
      a.download = $('tkCode').textContent + '-JLL-YearEnd-2026.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    }catch(err){
      console.error('download failed', err);
      alert('Could not build the image. Take a screenshot of the QR instead.');
    }finally{ btn.disabled = false; }
  });

  // Live validation feedback
  ['lastName','firstName','businessLine','email','contact'].forEach(id => {
    $(id).addEventListener('input', () => setErr(id, false));
  });
})();
