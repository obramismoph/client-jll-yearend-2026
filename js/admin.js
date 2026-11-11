/* ONE JLL Year-End Party 2026: committee dashboard.
   Supabase Auth sign-in (accounts are created by Jay in the Supabase
   dashboard; self sign-up is off). Every signed-in user can read the guest
   list, check guests in and add walk-ins. Exposes window.JLLAdmin for
   scanner.js (roster lookup + check-in). */
(function(){
  'use strict';
  const C = window.JLL;
  const $ = (id) => document.getElementById(id);
  const ready = C.SUPABASE_URL.indexOf('YOUR_') !== 0 && window.supabase;
  const sb = ready ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  let rows = [];          // all rsvps
  let me = null;          // auth user
  let timer = null;
  let canDelete = false;  // true only for listed admins (table rsvp_admins); the database enforces it too

  function banner(id, msg, kind){ const el = $(id); el.textContent = msg || ''; el.className = 'banner ' + (kind || 'bad') + (msg ? ' show' : ''); }
  function fmtTime(ts){ if(!ts) return ''; return new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fullName(r){ return r.first_name + ' ' + r.last_name; }

  if(!sb){ banner('loginBanner', 'The dashboard is not connected to a database yet (js/config.js).'); $('loginBtn').disabled = true; }

  /* ---------- auth ---------- */
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); banner('loginBanner', '');
    $('loginBtn').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPass').value });
    $('loginBtn').disabled = false;
    if(error) banner('loginBanner', 'Sign-in failed: ' + error.message);
  });
  $('forgotBtn').addEventListener('click', async () => {
    const email = $('loginEmail').value.trim();
    if(!email){ banner('loginBanner', 'Type your email first, then click Forgot password.'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    banner('loginBanner', error ? 'Could not send the reset email: ' + error.message : 'Reset email sent to ' + email + '. Open the link on this device.', error ? 'bad' : 'ok');
  });
  $('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $('newPass').value });
    if(error){ banner('loginBanner', 'Could not save: ' + error.message); return; }
    $('resetForm').style.display = 'none'; $('loginForm').style.display = 'block';
    banner('loginBanner', 'Password saved. You are signed in.', 'ok');
    const { data } = await sb.auth.getUser(); if(data && data.user) enter(data.user);
  });
  $('changePassBtn').addEventListener('click', async () => {
    const p = prompt('New password (at least 8 characters):'); if(!p) return;
    if(p.length < 8){ banner('appBanner', 'Password too short.'); return; }
    const { error } = await sb.auth.updateUser({ password: p });
    banner('appBanner', error ? 'Could not change password: ' + error.message : 'Password changed.', error ? 'bad' : 'ok');
  });
  $('signOutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

  if(sb){
    sb.auth.onAuthStateChange((event, session) => {
      if(event === 'PASSWORD_RECOVERY'){ $('loginForm').style.display = 'none'; $('resetForm').style.display = 'block'; return; }
      if(session && session.user && !me) enter(session.user);
    });
    sb.auth.getSession().then(({ data }) => { if(data.session) enter(data.session.user); });
  }

  function enter(user){
    me = user;
    $('whoEmail').textContent = user.email;
    $('loginView').style.display = 'none';
    $('appView').style.display = 'block';
    C.BUSINESS_LINES.forEach(bl => {
      ['filterLine','wLine'].forEach(id => { const o = document.createElement('option'); o.value = bl; o.textContent = bl; $(id).appendChild(o); });
    });
    checkAdmin().then(load);
    timer = setInterval(load, 30000);
  }

  async function checkAdmin(){
    const { data } = await sb.from('rsvp_admins').select('email').eq('email', (me.email || '').toLowerCase()).maybeSingle();
    canDelete = !!data;
  }

  /* ---------- data ---------- */
  async function load(){
    const { data, error } = await sb.from('rsvps').select('*').order('created_at', { ascending: false });
    if(error){ banner('appBanner', 'Could not load guests: ' + error.message); return; }
    rows = data || [];
    $('lastSync').textContent = 'updated ' + fmtTime(new Date().toISOString());
    renderDash(); renderGuests();
  }
  $('refreshBtn').addEventListener('click', load);

  function renderDash(){
    const lines = C.BUSINESS_LINES.slice();
    rows.forEach(r => { if(lines.indexOf(r.business_line) < 0) lines.push(r.business_line); });
    const tb = $('lineTable').querySelector('tbody'); tb.innerHTML = '';
    const T = { rsvp: 0, att: 0, walk: 0 };
    lines.forEach(bl => {
      const g = rows.filter(r => r.business_line === bl);
      const rsvp = g.filter(r => !r.walk_in).length;
      const att = g.filter(r => !r.walk_in && r.checked_in).length;
      const walk = g.filter(r => r.walk_in && r.checked_in).length;
      T.rsvp += rsvp; T.att += att; T.walk += walk;
      if(!g.length && C.BUSINESS_LINES.indexOf(bl) < 0) return;
      tb.insertAdjacentHTML('beforeend', lineRow(bl, rsvp, att, walk, false));
    });
    tb.insertAdjacentHTML('beforeend', lineRow('All business lines', T.rsvp, T.att, T.walk, true));
    $('kRsvp').textContent = T.rsvp; $('kIn').textContent = T.att; $('kWalk').textContent = T.walk;
    $('kPresent').textContent = T.att + T.walk;
    $('kInSub').textContent = 'of ' + T.rsvp + ' RSVPs';
    $('kRate').textContent = (T.rsvp ? Math.round(100 * T.att / T.rsvp) : 0) + '% of RSVPs showed up';
  }
  function lineRow(bl, rsvp, att, walk, total){
    const pct = rsvp ? Math.round(100 * att / rsvp) : 0;
    return '<tr class="' + (total ? 'total' : '') + '"><td>' + esc(bl) + '</td><td>' + rsvp + '</td><td>' + att + '</td><td>' + walk + '</td><td>' + (att + walk) + '</td>'
      + '<td><div class="bar" title="' + pct + '%"><i style="width:' + pct + '%"></i></div><span class="small">' + pct + '%</span></td></tr>';
  }

  function renderGuests(){
    const q = $('search').value.trim().toLowerCase();
    const fl = $('filterLine').value, fs = $('filterStatus').value;
    const list = rows.filter(r => {
      if(fl && r.business_line !== fl) return false;
      if(fs === 'in' && !(r.checked_in && !r.walk_in)) return false;
      if(fs === 'out' && (r.checked_in || r.walk_in)) return false;
      if(fs === 'walk' && !r.walk_in) return false;
      if(q && (fullName(r) + ' ' + (r.email || '') + ' ' + r.id + ' ' + (r.contact || '') + ' ' + (r.employee_no || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const tb = $('guestTable').querySelector('tbody');
    tb.innerHTML = list.map(r => '<tr><td class="small">' + esc(r.id) + '</td><td><b>' + esc(fullName(r)) + '</b></td><td class="small">' + esc(r.employee_no) + '</td><td>' + esc(r.business_line) + '</td>'
      + '<td class="small">' + esc(r.email) + emailMark(r) + '</td><td class="small">' + esc(r.contact) + '</td><td>' + statusPill(r) + '</td>'
      + '<td>' + (r.checked_in ? '<button class="btn sm ghost" data-undo="' + esc(r.id) + '">Undo</button>' : '<button class="btn sm" data-in="' + esc(r.id) + '">Check in</button>')
      + (r.walk_in || !r.email ? '' : ' <button class="btn sm ghost" data-resend="' + esc(r.id) + '" title="Send the confirmation email again">Resend</button>')
      + (canDelete ? ' <button class="btn sm ghost" data-del="' + esc(r.id) + '" title="Remove this guest (no longer attending)" style="color:var(--bad)">Delete</button>' : '') + '</td></tr>').join('');
    $('guestCount').textContent = list.length + ' of ' + rows.length + ' guests shown';
  }
  function emailMark(r){
    if(r.walk_in || !r.email) return '';
    if(r.email_sent_at) return '<br><span class="small" title="Confirmation email sent">emailed ' + fmtTime(r.email_sent_at) + '</span>';
    if(r.email_error) return '<br><span class="small" style="color:var(--bad)" title="' + esc(r.email_error) + '">email failed</span>';
    return '<br><span class="small">email pending</span>';
  }
  function statusPill(r){
    if(r.walk_in) return '<span class="pill walk">Walk-in ' + fmtTime(r.checked_in_at) + '</span>';
    return r.checked_in ? '<span class="pill in">Checked in ' + fmtTime(r.checked_in_at) + '</span>' : '<span class="pill out">Not yet</span>';
  }
  ['search','filterLine','filterStatus'].forEach(id => $(id).addEventListener('input', renderGuests));
  $('guestTable').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.in) await checkIn(b.dataset.in, true);
    if(b.dataset.undo) await checkIn(b.dataset.undo, false);
    if(b.dataset.resend) await resendEmail(b.dataset.resend, b);
    if(b.dataset.del) askDelete(b.dataset.del);
  });

  /* ---------- delete a guest (admins only) ---------- */
  let delId = null;
  function askDelete(id){
    const r = find(id); if(!r || !canDelete) return;
    delId = id; $('delName').textContent = fullName(r); $('delLine').textContent = r.business_line;
    $('delModal').hidden = false; $('delCancel').focus();
  }
  function closeDelete(){ $('delModal').hidden = true; delId = null; }
  $('delCancel').addEventListener('click', closeDelete);
  $('delModal').addEventListener('click', (e) => { if(e.target === $('delModal')) closeDelete(); });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !$('delModal').hidden) closeDelete(); });
  $('delConfirm').addEventListener('click', async () => {
    if(!delId) return;
    const id = delId, name = fullName(find(id) || { first_name: id, last_name: '' });
    $('delConfirm').disabled = true;
    const { data, error } = await sb.from('rsvps').delete().eq('id', id).select('id');
    $('delConfirm').disabled = false; closeDelete();
    if(error || !data || !data.length){
      banner('appBanner', 'Could not delete ' + name + (error ? ': ' + error.message : '. Only the main committee account can delete guests.'));
      return;
    }
    rows = rows.filter(r => r.id !== id); renderDash(); renderGuests();
    banner('appBanner', name.trim() + ' was removed from the guest list.', 'ok');
  });

  async function resendEmail(id, btn){
    btn.disabled = true; banner('appBanner', '');
    const { error } = await sb.from('rsvps').update({ email_sent_at: null, email_attempts: 0, email_error: null }).eq('id', id);
    if(error){ banner('appBanner', 'Could not reset the email flag: ' + error.message); btn.disabled = false; return; }
    const { data, error: fnErr } = await sb.functions.invoke('send-confirmation', { body: { id } });
    const r = data && data.results && data.results[0];
    if(fnErr || !r || !r.sent) banner('appBanner', 'Email not sent: ' + (fnErr ? fnErr.message : (r && (r.error || r.skipped)) || 'unknown error'));
    else banner('appBanner', 'Confirmation email sent again for ' + id + '.', 'ok');
    await load(); btn.disabled = false;
  }

  /* ---------- actions ---------- */
  async function checkIn(id, on){
    const patch = on ? { checked_in: true, checked_in_at: new Date().toISOString(), checked_in_by: me.email }
                     : { checked_in: false, checked_in_at: null, checked_in_by: null };
    const { data, error } = await sb.from('rsvps').update(patch).eq('id', id).select().single();
    if(error){ banner('appBanner', 'Check-in failed: ' + error.message); return null; }
    const i = rows.findIndex(r => r.id === id); if(i >= 0) rows[i] = data; else rows.unshift(data);
    renderDash(); renderGuests();
    return data;
  }
  function find(id){ return rows.find(r => r.id === id) || null; }
  function search(text){
    const q = String(text || '').trim().toLowerCase(); if(!q) return [];
    return rows.filter(r => (fullName(r) + ' ' + r.id + ' ' + (r.email || '')).toLowerCase().indexOf(q) >= 0).slice(0, 8);
  }

  $('walkForm').addEventListener('submit', async (e) => {
    e.preventDefault(); banner('walkBanner', '');
    const rec = { id: C.ID_PREFIX + '-W' + Math.floor(10000 + Math.random() * 90000), last_name: $('wLast').value.trim(), first_name: $('wFirst').value.trim(), employee_no: $('wEmp').value.trim() || null,
      business_line: $('wLine').value, email: $('wEmail').value.trim().toLowerCase() || null, contact: $('wContact').value.trim() || null,
      walk_in: true, checked_in: true, checked_in_at: new Date().toISOString(), checked_in_by: me.email };
    if(!rec.last_name || !rec.first_name || !rec.business_line){ banner('walkBanner', 'Name and business line are required.', 'bad'); return; }
    $('walkBtn').disabled = true;
    const { data, error } = await sb.from('rsvps').insert(rec).select().single();
    $('walkBtn').disabled = false;
    if(error){ banner('walkBanner', 'Could not add: ' + error.message, 'bad'); return; }
    rows.unshift(data); renderDash(); renderGuests();
    $('walkForm').reset();
    banner('walkBanner', fullName(data) + ' added and checked in under ' + data.business_line + '.', 'ok');
  });

  $('exportBtn').addEventListener('click', () => {
    const head = ['Code','Last name','Employee no.','First name','Business line','Email','Contact','Type','Checked in','Checked in at (Manila)','Checked in by','RSVP at (Manila)'];
    const fmt = (ts) => ts ? new Date(ts).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '';
    const csv = [head].concat(rows.map(r => [r.id, r.last_name, r.employee_no || '', r.first_name, r.business_line, r.email || '', r.contact || '', r.walk_in ? 'Walk-in' : 'RSVP',
      r.checked_in ? 'Yes' : 'No', fmt(r.checked_in_at), r.checked_in_by || '', fmt(r.created_at)]))
      .map(a => a.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'JLL-YearEnd-2026-guests-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  });

  /* ---------- tabs ---------- */
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t.dataset.tab));
    if(t.dataset.tab !== 'scan' && window.JLLScanner) window.JLLScanner.stop();
  }));

  window.JLLAdmin = { find, search, checkIn, fullName, fmtTime, esc, reload: load };
})();
