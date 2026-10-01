const KEY = 'medtrack.v1', SL = { 1: ['morning'], 2: ['morning', 'night'], 3: ['morning', 'afternoon', 'night'] },
    LB = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' }, ORD = ['morning', 'afternoon', 'night'],
    DT = { morning: '09:00', afternoon: '14:00', night: '21:00' };
let S = { meds: [], size: 'normal', contrast: false, testDate: null, notify: false, defTimes: { ...DT } }, view = 'dash', notice = '', memOnly = false, lastDay = '', lastMin = 0, justTaken = '', notified = new Set(), tT, sel = null;
/* ---------- date utils (local calendar dates as YYYY-MM-DD) ---------- */
const p2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) };
const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d) };
const diff = (a, b) => Math.round((utc(a) - utc(b)) / 864e5);
const validYmd = s => /^\d{4}-\d\d-\d\d$/.test(s || '') && ymd(pd(s)) === s;
const today = () => S.testDate && validYmd(S.testDate) ? S.testDate : ymd(new Date());
const fLong = s => pd(s).toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + pd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const fShort = s => pd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const t12 = h => { const [a, b] = h.split(':').map(Number); return ((a + 11) % 12 + 1) + ':' + p2(b) + (a < 12 ? ' AM' : ' PM') };
const tIso = i => { const d = new Date(i); return t12(p2(d.getHours()) + ':' + p2(d.getMinutes())) };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* ---------- course logic ---------- */
const getCourseEndDate = m => addDays(m.startDate, m.durationDays - 1);
const getCourseDay = (m, t) => diff(t, m.startDate) + 1;
const courseState = (m, t) => t < m.startDate ? 'upcoming' : t > getCourseEndDate(m) ? 'completed' : 'active';
const isMedicineActive = (m, t = today()) => courseState(m, t) === 'active';
function getTodaysDoses(t = today()) {
    const o = [];
    S.meds.filter(m => isMedicineActive(m, t)).forEach(m => SL[m.dosesPerDay].forEach(s => {
        const k = t + '|' + s;
        o.push({ med: m, slot: s, key: k, time: m.times[s] || DT[s], takenAt: m.log[k] || null })
    }));
    return o.sort((a, b) => ORD.indexOf(a.slot) - ORD.indexOf(b.slot) || a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name))
}
const getPendingDoses = () => getTodaysDoses().filter(d => !d.takenAt);
const getCompletedDoses = () => getTodaysDoses().filter(d => d.takenAt);
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() };
const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b };
function doseState(d) { if (d.takenAt) return 'taken'; if (d.key.split('|')[0] < today()) return 'missed'; if (S.testDate || today() !== ymd(new Date())) return 'pending'; const x = nowMin() - toMin(d.time); return x >= 120 ? 'late' : x >= 0 ? 'due' : 'pending' }
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' };
const IC = { dash: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z', meds: 'M10.5 3.5a5 5 0 017 7l-7 7a5 5 0 01-7-7zM8 8l8 8', hist: 'M3 12a9 9 0 109-9 9 9 0 00-7 3.4M3 4v4h4M12 8v5l3 2', sett: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' };
const viewDate = () => sel && validYmd(sel) ? sel : today();
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h };
const avatar = n => '<span class="av" style="background:hsl(' + hue(n) + ' 45% 34%)" aria-hidden="true">' + esc(n.trim().charAt(0).toUpperCase()) + '</span>';
const dayStats = d => { const x = getTodaysDoses(d); return { total: x.length, taken: x.filter(y => y.takenAt).length } };
function streak() { let d = today(), n = 0, s = dayStats(d); if (!(s.total && s.taken === s.total)) d = addDays(d, -1); for (let i = 0; i < 60; i++) { s = dayStats(d); if (!s.total || s.taken < s.total) break; n++; d = addDays(d, -1) } return n }
function summary() { const t = today(), all = getTodaysDoses(t); return 'MedTrack — ' + fLong(t) + '\n' + (all.length ? all.map(d => (d.takenAt ? '✓ ' : '○ ') + d.med.name + ' (' + LB[d.slot] + ' ' + t12(d.time) + ')' + (d.takenAt ? ' taken at ' + tIso(d.takenAt) : ' pending')).join('\n') : 'No doses scheduled today.') + '\n' + dayStats(t).taken + ' of ' + all.length + ' doses completed.' }
function week() {
    const t = today(), D = viewDate(); let h = '<div class="week" role="group" aria-label="Choose a day">'; for (let i = -3; i <= 3; i++) {
        const d = addDays(t, i), s = dayStats(d), ok = s.total && s.taken === s.total;
        h += '<button class="wd' + (d === D ? ' sel' : '') + (d === t ? ' tod' : '') + '" data-act="selday" data-d="' + d + '" aria-pressed="' + (d === D) + '" aria-label="' + fLong(d) + (s.total ? ', ' + s.taken + ' of ' + s.total + ' taken' : ', nothing scheduled') + '"><small>' + (d === t ? 'Today' : pd(d).toLocaleDateString('en-GB', { weekday: 'short' })) + '</small><b>' + pd(d).getDate() + '</b><i class="' + (ok ? 'ok' : '') + '">' + (!s.total ? '–' : ok ? '✓' : s.taken + '/' + s.total) + '</i></button>'
    } return h + '</div>'
}
function periods(all) { const hr = new Date().getHours(), cur = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'night'; return '<div class="per">' + ORD.map(s => { const x = all.filter(d => d.slot === s); if (!x.length) return ''; const k = x.filter(d => d.takenAt).length; return '<div class="pt' + (k === x.length ? ' ok' : '') + (s === cur && viewDate() === today() ? ' now' : '') + '"><span>' + LB[s] + '</span><b>' + (k === x.length ? '✓ ' : '') + k + '/' + x.length + '</b></div>' }).join('') + '</div>' }
function insights() {
    const t = today(); let tot = 0, tk = 0, bars = ''; for (let i = -6; i <= 0; i++) { const d = addDays(t, i), s = dayStats(d); tot += s.total; tk += s.taken; bars += '<div class="col"><div class="tr"><i data-h="' + (s.total ? s.taken / s.total * 100 : 0) + '"></i></div><small>' + pd(d).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2) + '</small></div>' }
    return '<section class="card"><h3>Last 7 days</h3><p class="big" style="margin-top:.4rem">' + (tot ? Math.round(tk / tot * 100) + '% of doses ticked' : 'No doses scheduled yet') + '</p><div class="cols" role="img" aria-label="Daily completion for the last 7 days">' + bars + '</div><p class="meta">★ ' + streak() + '-day perfect streak • ' + tk + ' of ' + tot + ' doses ticked</p></section>'
}
function speak(t) { if (!('speechSynthesis' in window)) return announce(t); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = .85; speechSynthesis.speak(u) }
function toast(msg, undo) { const e = document.getElementById('toast'); e.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button class="btn" data-act="tundo">Undo</button>' : ''); e.classList.add('show'); window._tu = undo; clearTimeout(tT); tT = setTimeout(() => e.classList.remove('show'), 6000) }
async function toggleNotify(el) {
    if (!el.checked) { S.notify = false; save(); return }
    if (!('Notification' in window)) { el.checked = false; return toast('This browser does not support alerts.') }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); S.notify = p === 'granted'; if (!S.notify) { el.checked = false; toast('Alerts were not allowed in this browser.') } save()
}
const moveCompletedCourses = () => S.meds.filter(m => courseState(m, today()) === 'completed'); // derived, never deleted
/* ---------- storage ---------- */
const okMed = m => m && typeof m.name === 'string' && m.name.trim() && [1, 2, 3].includes(m.dosesPerDay) && validYmd(m.startDate) && Number.isInteger(m.durationDays) && m.durationDays > 0;
function load() {
    let raw = null; try {
        raw = localStorage.getItem(KEY); if (!raw) return; const d = JSON.parse(raw); if (!d || !Array.isArray(d.meds)) throw 0;
        S.size = ['normal', 'large', 'xl'].includes(d.size) ? d.size : 'normal'; S.contrast = !!d.contrast; S.testDate = validYmd(d.testDate) ? d.testDate : null; S.notify = !!d.notify; ORD.forEach(s => { const t = d.defTimes && d.defTimes[s]; if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) S.defTimes[s] = t }); Object.assign(DT, S.defTimes);
        const bad = d.meds.filter(m => !okMed(m)).length;
        S.meds = d.meds.filter(okMed).map(m => ({ id: String(m.id || Math.random().toString(36).slice(2)), name: m.name.trim(), note: typeof m.note === 'string' ? m.note.slice(0, 40) : '', dosesPerDay: m.dosesPerDay, startDate: m.startDate, durationDays: m.durationDays, times: (m.times && typeof m.times === 'object') ? m.times : {}, log: (m.log && typeof m.log === 'object') ? m.log : {}, demo: !!m.demo }));
        if (bad) notice = bad + ' saved medicine(s) could not be read and were skipped.'
    }
        catch (e) { notice = 'Saved data looked damaged, so MedTrack started fresh. A copy was kept in case it is needed.'; try { localStorage.setItem(KEY + '.backup', raw) } catch (_) { } }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); memOnly = false } catch (e) { memOnly = true } }
/* ---------- actions ---------- */
const announce = t => { const l = document.getElementById('live'); l.textContent = ''; setTimeout(() => l.textContent = t, 50) };
const find = id => S.meds.find(m => m.id === id);
function addMedicine(v) { S.meds.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...v, log: {}, demo: false }); save() }
function editMedicine(id, v) { const m = find(id); if (!m) return; Object.assign(m, v); save() }
function deleteMedicine(id) { S.meds = S.meds.filter(m => m.id !== id); save() }
function markDoseTaken(id, k) { const m = find(id); if (!m || m.log[k]) return; m.log[k] = new Date().toISOString(); save(); announce(m.name + ' marked as taken') }
function undoDose(id, k) { const m = find(id); if (!m) return; delete m.log[k]; save(); announce(m.name + ' marked as pending again') }
function loadDemo() {
    const t = today(); S.meds.push(
        { id: 'demoA' + Date.now(), name: 'Medicine A', dosesPerDay: 2, startDate: t, durationDays: 5, times: { morning: '09:00', night: '21:00' }, log: {}, demo: true },
        { id: 'demoB' + Date.now(), name: 'Medicine B', dosesPerDay: 3, startDate: t, durationDays: 7, times: { morning: '09:00', afternoon: '14:00', night: '21:00' }, log: {}, demo: true }); save()
}
/* ---------- modal ---------- */
function openModal(html) {
    const m = document.getElementById('modal'); m.innerHTML = '<div class="ov" data-act="ovl"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dt">' + html + '</div></div>';
    const f = m.querySelector('input:not([type=radio]),textarea,button'); f && f.focus()
}
const closeModal = () => { document.getElementById('modal').innerHTML = '' };
function confirmBox(title, yes, fn, msg = '') { openModal('<h2 id="dt" style="margin-top:0">' + title + '</h2>' + (msg ? '<p>' + msg + '</p>' : '') + '<div class="row"><button class="btn" data-act="close">Cancel</button><button class="btn dangerS" data-act="yes">' + yes + '</button></div>'); window._yes = () => { closeModal(); fn() } }
function medForm(m) {
    const v = m || { name: '', dosesPerDay: 2, durationDays: 5, startDate: today(), times: {} };
    const slots = ORD.map(s => '<div data-slot="' + s + '"><label for="t_' + s + '">' + LB[s] + ' time (optional)</label><input type="time" id="t_' + s + '" value="' + (v.times[s] || DT[s]) + '"><p class="err" id="e_' + s + '"></p></div>').join('');
    openModal('<h2 id="dt" style="margin-top:0">' + (m ? 'Edit Medicine' : 'Add Medicine') + '</h2><form id="mf" novalidate data-id="' + (m ? m.id : '') + '">' +
        '<label for="nm">Medicine name</label><input type="text" id="nm" value="' + esc(v.name) + '" autocomplete="off"><p class="err" id="e_nm"></p>' + '<label for="no">Note (optional, e.g. after food)</label><input type="text" id="no" maxlength="40" value="' + esc(v.note || '') + '">' +
        '<fieldset><legend>Times per day</legend><div class="seg">' + [1, 2, 3].map(n => '<label><input type="radio" name="dp" value="' + n + '"' + (v.dosesPerDay === n ? ' checked' : '') + '><span>' + n + '</span></label>').join('') + '</div></fieldset>' +
        '<label for="du">Course duration (days)</label><input type="number" id="du" min="1" max="365" inputmode="numeric" value="' + v.durationDays + '"><p class="err" id="e_du"></p>' +
        '<label for="sd">Start date</label><input type="date" id="sd" value="' + v.startDate + '"><p class="err" id="e_sd"></p>' + slots +
        '<div class="row" style="margin-top:1.2rem"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn pri">' + (m ? 'Save Changes' : 'Add Medicine') + '</button></div></form>');
    syncSlots()
}
function syncSlots() { const n = +(document.querySelector('input[name=dp]:checked') || { value: 1 }).value; ORD.forEach(s => { const e = document.querySelector('[data-slot=' + s + ']'); if (e) e.style.display = SL[n].includes(s) ? '' : 'none' }) }
function submitForm(f) {
    const id = f.dataset.id, g = i => document.getElementById(i), E = (i, t) => { g('e_' + i).textContent = t; return !!t };
    const name = g('nm').value.trim().replace(/\s+/g, ' '), dp = +f.querySelector('input[name=dp]:checked').value, du = Number(g('du').value), sd = g('sd').value; let bad = false;
    bad |= E('nm', !name ? 'Please enter the medicine name.' : S.meds.some(m => m.id !== id && m.name.toLowerCase() === name.toLowerCase() && courseState(m, today()) !== 'completed') ? 'This medicine is already in your list.' : '');
    bad |= E('du', !Number.isInteger(du) || du < 1 ? 'Please enter a whole number of days, 1 or more.' : du > 365 ? 'Please enter 365 days or fewer.' : '');
    bad |= E('sd', !validYmd(sd) ? 'Please choose a valid start date.' : '');
    const times = {}; SL[dp].forEach(s => { const t = g('t_' + s).value; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) bad |= E(s, 'Please enter a valid time.'); else { E(s, ''); times[s] = t } });
    if (bad) { const first = f.querySelector('.err:not(:empty)'); first && first.previousElementSibling.focus(); announce('Please fix the highlighted problems.'); return }
    const v = { name, note: g('no').value.trim().slice(0, 40), dosesPerDay: dp, durationDays: du, startDate: sd, times }; id ? editMedicine(id, v) : addMedicine(v); closeModal(); render(); announce(name + (id ? ' updated.' : ' added.'))
}
/* ---------- views ---------- */
const STL = { taken: ['t', '✓ Taken at '], pending: ['p', '○ Pending'], due: ['p due', '⏰ Time to take'], late: ['l', '! Overdue'], missed: ['l', '✕ Missed'] };
const doseCard = d => {
    const s = doseState(d), t = s === 'taken', c = STL[s], ro = d.key.split('|')[0] !== today(), pop = d.key === justTaken; return '<article class="card dose' + (t ? ' done' : '') + (pop ? ' pop' : '') + (s === 'late' || s === 'missed' ? ' lateC' : '') + '"><div class="dh">' + avatar(d.med.name) + '<div><h3>' + esc(d.med.name) + '</h3><p class="when">' + LB[d.slot] + ' • ' + t12(d.time) + '</p>' + (d.med.note ? '<p class="meta">📝 ' + esc(d.med.note) + '</p>' : '') + '<span class="st ' + c[0] + '">' + (t ? c[1] + tIso(d.takenAt) : c[1]) + '</span></div></div>' +
        (ro ? '' : '<button class="btn ' + (t ? '' : 'pri') + '" data-act="' + (t ? 'undo' : 'take') + '" data-id="' + d.med.id + '" data-key="' + d.key + '" aria-label="' + (t ? 'Undo ' : 'Mark as taken: ') + esc(d.med.name) + ', ' + LB[d.slot] + '">' + (t ? 'Undo' : '✓ Mark as Taken') + '</button>') + (pop ? '<svg class="chk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>' : '') + '</article>'
};
const addBtn = '<button class="btn pri" data-act="add">+ Add Medicine</button>';
function dash() {
    const D = viewDate(), isT = D === today(), all = getTodaysDoses(D), pe = all.filter(d => !d.takenAt), dn = all.filter(d => d.takenAt), pc = all.length ? Math.round(dn.length / all.length * 100) : 0, sk = streak();
    let h = '<p class="greet">' + greet() + ' — here is your checklist</p><h1>' + (isT ? 'Today\'s Medicines' : 'Medicines') + '</h1><p class="sub">' + fLong(D) + '</p>';
    if (!S.meds.length) return h + '<div class="card empty"><p>No medicines added yet.</p><p>Add your first medicine to start today\'s checklist.</p>' + addBtn + '<p style="margin-top:1rem"><button class="btn" data-act="demo">Try with sample medicines</button></p></div>';
    h += week();
    if (!isT) h += '<div class="note">You are viewing another day. Doses can only be ticked on today\'s date.<br><button class="btn" data-act="seltoday" style="margin-top:.5rem">Back to today</button></div>';
    if (!all.length) h += '<div class="card empty"><p>No doses are scheduled for this day.</p><p>Check the Medicines page for upcoming courses.</p></div>';
    else { const R = 44, C = 2 * Math.PI * R; h += '<section class="card prog" aria-label="Progress"><div class="ring" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pc + '" aria-label="Doses completed"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="' + R + '" class="rb"/><circle cx="50" cy="50" r="' + R + '" class="rf" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" data-off="' + (C * (1 - pc / 100)) + '"/></svg><b>' + pc + '%</b></div><div><p class="big">' + dn.length + ' of ' + all.length + ' doses completed</p><p class="meta">' + (pe.length ? pe.length + (isT ? ' still to take' : ' not taken') : '✓ All medicines completed.') + '</p>' + (isT && sk ? '<p class="meta">★ ' + sk + (sk > 1 ? ' perfect days' : ' perfect day') + ' in a row</p>' : '') + '</div></section>' + periods(all) }
    if (isT && pe.length) { const n = pe[0], s = doseState(n); h += '<section class="hero" aria-label="Next dose"><p class="kick">Next dose</p><h2>' + esc(n.med.name) + '</h2><p class="hl">' + LB[n.slot] + ' • ' + t12(n.time) + (s === 'late' ? ' • Overdue' : s === 'due' ? ' • Time to take' : '') + '</p><div class="row"><button class="btn heroB" data-act="take" data-id="' + n.med.id + '" data-key="' + n.key + '">✓ Mark as Taken</button><button class="btn heroG" data-act="speak" data-id="' + n.med.id + '" data-key="' + n.key + '">🔊 Read aloud</button></div></section>' }
    h += '<h2>' + (isT ? 'Pending' : 'Not taken') + ' – ' + pe.length + '</h2>' + (pe.length ? pe.map(doseCard).join('') : '<div class="card empty"><p>' + (isT ? 'Nothing pending for today.' : 'Everything was taken.') + '</p></div>');
    h += '<h2>' + (isT ? 'Completed Today' : 'Completed') + ' – ' + dn.length + '</h2>' + (dn.length ? dn.map(doseCard).join('') : '<p class="sub">Nothing taken yet' + (isT ? ' today' : '') + '.</p>');
    return h + '<div class="row" style="margin-top:1.5rem">' + addBtn + '<button class="btn" data-act="share">Share today\'s summary</button></div>'
}
function medCard(m) {
    const t = today(), st = courseState(m, t), tm = SL[m.dosesPerDay].map(s => LB[s] + ' ' + t12(m.times[s] || DT[s])).join(', ');
    return '<article class="card"><div class="dh">' + avatar(m.name) + '<h3>' + esc(m.name) + (m.demo ? ' <span class="meta">(sample)</span>' : '') + '</h3></div>' + (m.note ? '<p class="meta">📝 ' + esc(m.note) + '</p>' : '') + '<p class="when">' + m.dosesPerDay + (m.dosesPerDay > 1 ? ' times' : ' time') + ' a day</p><p class="meta">' + tm + '</p><p class="meta">Course: ' + m.durationDays + ' days • Started ' + fShort(m.startDate) + ' • Ends ' + fShort(getCourseEndDate(m)) + '</p>' +
        '<p class="meta"><b>' + (st === 'active' ? 'Day ' + getCourseDay(m, t) + ' of ' + m.durationDays : 'Starts ' + fShort(m.startDate)) + '</b></p>' + (st === 'active' ? '<div class="cbar"><i data-w="' + Math.round(getCourseDay(m, t) / m.durationDays * 100) + '"></i></div><p class="meta">' + (m.durationDays - getCourseDay(m, t)) + ' day(s) left after today</p>' : '') + '<div class="row" style="margin-top:.6rem"><button class="btn" data-act="edit" data-id="' + m.id + '" aria-label="Edit ' + esc(m.name) + '">Edit</button><button class="btn danger" data-act="del" data-id="' + m.id + '" aria-label="Delete ' + esc(m.name) + '">Delete</button></div></article>'
}
function meds() {
    const t = today(), cur = S.meds.filter(m => courseState(m, t) !== 'completed');
    let h = '<h1>All Medicines</h1><p class="sub">Active and upcoming courses</p><p>' + addBtn + '</p>';
    if (S.meds.some(m => m.demo)) h += '<div class="note">Sample medicines are shown. <button class="btn" data-act="rmdemo" style="margin-top:.5rem">Remove sample medicines</button></div>';
    return h + (cur.length ? cur.map(medCard).join('') : '<div class="card empty"><p>No active medicines.</p></div>')
}
function hist() {
    const c = moveCompletedCourses().sort((a, b) => getCourseEndDate(b).localeCompare(getCourseEndDate(a)));
    return '<h1>History</h1>' + insights() + '<h2 style="margin-top:1.2rem">Completed Courses</h2>' + (c.length ? c.map(m => {
        const tot = m.durationDays * m.dosesPerDay, tk = Object.keys(m.log).length;
        return '<article class="card"><h3>' + esc(m.name) + '</h3><p class="when">' + m.durationDays + '-day course</p><p class="meta">Completed on ' + fShort(getCourseEndDate(m)) + ' ' + pd(getCourseEndDate(m)).getFullYear() + '</p><p class="meta">' + tk + ' of ' + tot + ' doses ticked</p><div class="row"><button class="btn danger" data-act="del" data-id="' + m.id + '" aria-label="Delete ' + esc(m.name) + ' from history">Delete</button></div></article>'
    }).join('') : '<div class="card empty"><p>No completed courses yet.</p></div>')
}
function sett() {
    const sz = [['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra Large']];
    return '<h1>Settings</h1><section class="card"><fieldset><legend style="margin-top:0">Text size</legend><div class="seg" style="flex-wrap:wrap">' + sz.map(([v, l]) => '<label><input type="radio" name="sz" value="' + v + '"' + (S.size === v ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div></fieldset>' +
        '<label style="display:flex;gap:.7rem;align-items:center;min-height:48px"><input type="checkbox" id="hc" style="width:1.6rem;height:1.6rem"' + (S.contrast ? ' checked' : '') + '> High contrast mode</label></section>' +
        '<section class="card"><h3>Default dose times</h3><p class="meta">Used when you add a new medicine. Existing medicines keep their own times.</p>' + ORD.map(s => '<label for="d_' + s + '">' + LB[s] + '</label><input type="time" id="d_' + s + '" data-def="' + s + '" value="' + DT[s] + '">').join('') + '</section><section class="card"><h3>Alerts</h3><p class="meta">Optional. Browser alerts only work while this page is open and depend on your device and browser permissions. They are not a guaranteed reminder.</p><label style="display:flex;gap:.7rem;align-items:center;min-height:48px;margin:0"><input type="checkbox" id="nf" style="width:1.6rem;height:1.6rem"' + (S.notify ? ' checked' : '') + '> Alert me when a dose time arrives</label></section><section class="card"><h3>Your data</h3><p class="meta">Everything is stored only in this browser. MedTrack is a checklist and does not send reminders or give medical advice.</p><div class="row"><button class="btn" data-act="export">Export Data</button><button class="btn" data-act="import">Import Data</button><button class="btn danger" data-act="clear">Clear All Data</button></div></section>' +
        '<details class="card"><summary style="min-height:44px;font-size:1rem">Developer: test a different date</summary><label for="td">Test date</label><input type="date" id="td" value="' + (S.testDate || '') + '"><div class="row" style="margin-top:.7rem"><button class="btn" data-act="settd">Use this date</button><button class="btn" data-act="realtd">Use real date</button></div>' + (S.testDate ? '<p class="err">Test date active: ' + S.testDate + '</p>' : '') + '</details>'
}
function render(anim) {
    document.documentElement.className = (S.size === 'normal' ? '' : S.size) + (S.contrast ? ' hc' : '');
    const N = [['dash', 'Dashboard'], ['meds', 'Medicines'], ['hist', 'History'], ['sett', 'Settings']];
    document.querySelector('nav').innerHTML = N.map(([k, l]) => '<button data-nav="' + k + '"' + (view === k ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + IC[k] + '"/></svg><span>' + l + '</span></button>').join('');
    let b = notice ? '<div class="note" role="alert">' + esc(notice) + '</div>' : ''; if (memOnly) b += '<div class="note" role="alert">This browser is not allowing MedTrack to save. Your changes will be lost when you close the page.</div>';
    if (S.testDate) b += '<div class="note">Test date in use: ' + S.testDate + '</div>';
    const app = document.getElementById('app'); app.className = anim === true ? 'anim' : anim === 'soft' ? 'soft' : ''; app.innerHTML = b + ({ dash, meds, hist, sett })[view](); lastDay = today(); lastMin = nowMin();
    if (anim === true) app.querySelectorAll('.card,.hero').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
    const fill = () => { app.querySelectorAll('.rf').forEach(e => e.style.strokeDashoffset = e.dataset.off); app.querySelectorAll('.cbar i').forEach(e => e.style.width = e.dataset.w + '%'); app.querySelectorAll('.tr i').forEach(e => e.style.height = e.dataset.h + '%') };
    anim ? requestAnimationFrame(() => requestAnimationFrame(fill)) : fill(); if (anim === true) app.querySelectorAll('.ring b').forEach(e => { const to = parseInt(e.textContent); let t0 = null; const step = ts => { t0 = t0 || ts; const k = Math.min(1, (ts - t0) / 900); e.textContent = Math.round(to * k) + '%'; if (k < 1) requestAnimationFrame(step) }; requestAnimationFrame(step) }); justTaken = ''
}
/* ---------- events ---------- */
document.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]'); if (n) { view = n.dataset.nav; render(true); window.scrollTo(0, 0); return }
    const a = e.target.closest('[data-act]'); if (!a) return; const { act, id, key } = a.dataset;
    if (act === 'ovl') { if (e.target === a) closeModal(); return }
    if (act === 'close') return closeModal(); if (act === 'yes') return window._yes();
    if (act === 'selday') { sel = a.dataset.d === today() ? null : a.dataset.d; render('soft'); return }
    if (act === 'seltoday') { sel = null; render('soft'); return }
    if (act === 'share') return openModal('<h2 id="dt" style="margin-top:0">Share today\'s summary</h2><p class="meta">Copy this and send it to a family member or caregiver.</p><textarea readonly id="ex" aria-label="Summary">' + esc(summary()) + '</textarea><div class="row" style="margin-top:.7rem"><button class="btn pri" data-act="copy">Copy</button><button class="btn" data-act="close">Close</button></div>');
    if (act === 'copy') { const x = document.getElementById('ex'); x.select(); try { navigator.clipboard.writeText(x.value).then(() => toast('Copied'), () => { document.execCommand('copy'); toast('Copied') }) } catch (_) { try { document.execCommand('copy'); toast('Copied') } catch (__) { } } return }
    if (act === 'import') return openModal('<h2 id="dt" style="margin-top:0">Import Data</h2><p class="meta">Paste data you exported earlier. It will be added to your current medicines.</p><textarea id="im" aria-label="Data to import"></textarea><p class="err" id="e_im"></p><div class="row"><button class="btn pri" data-act="doimport">Import</button><button class="btn" data-act="close">Cancel</button></div>');
    if (act === 'doimport') { try { const a2 = JSON.parse(document.getElementById('im').value); if (!Array.isArray(a2)) throw 0; const ok = a2.filter(okMed).map(m => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: m.name.trim(), note: typeof m.note === 'string' ? m.note.slice(0, 40) : '', dosesPerDay: m.dosesPerDay, startDate: m.startDate, durationDays: m.durationDays, times: m.times && typeof m.times === 'object' ? m.times : {}, log: m.log && typeof m.log === 'object' ? m.log : {}, demo: false })); if (!ok.length) throw 0; S.meds.push(...ok); save(); closeModal(); render(); toast('Imported ' + ok.length + ' medicine(s)') } catch (_) { document.getElementById('e_im').textContent = 'That text could not be read. Please paste the exported data exactly.' } return }
    if (act === 'tundo') { document.getElementById('toast').classList.remove('show'); window._tu && window._tu(); return }
    if (act === 'speak') { const d = getTodaysDoses().find(x => x.key === key && x.med.id === id); if (!d) return; const n = getPendingDoses().length; speak('Next medicine: ' + d.med.name + ', ' + LB[d.slot] + ', at ' + t12(d.time) + '. You have ' + n + ' dose' + (n > 1 ? 's' : '') + ' left today.'); return }
    if (act === 'add') return medForm(); if (act === 'edit') return medForm(find(id));
    if (act === 'take') { markDoseTaken(id, key); try { navigator.vibrate && navigator.vibrate(40) } catch (_) { } justTaken = key; render('soft'); toast('✓ ' + find(id).name + ' marked as taken', () => { undoDose(id, key); render('soft') }); const b = document.querySelector('[data-act=undo][data-key="' + key + '"]'); b && b.focus() }
    if (act === 'undo') return confirmBox('Undo this dose?', 'Yes, Undo', () => { undoDose(id, key); render() }, 'It will go back to Pending.');
    if (act === 'del') { const m = find(id); return confirmBox('Are you sure you want to delete this medicine?', 'Delete', () => { deleteMedicine(id); render(); announce('Medicine deleted') }, esc(m ? m.name : '')) }
    if (act === 'demo') { loadDemo(); render() }
    if (act === 'rmdemo') { S.meds = S.meds.filter(m => !m.demo); save(); render() }
    if (act === 'clear') return confirmBox('Delete all medicine data?', 'Delete Everything', () => { S.meds = []; notice = ''; save(); render(); announce('All data deleted') });
    if (act === 'export') return openModal('<h2 id="dt" style="margin-top:0">Export Data</h2><p>Select all the text below and copy it to keep a backup.</p><textarea readonly id="ex" aria-label="Exported data">' + esc(JSON.stringify(S.meds, null, 1)) + '</textarea><p><button class="btn" data-act="close">Close</button></p>');
    if (act === 'settd') { const v = document.getElementById('td').value; S.testDate = validYmd(v) ? v : null; save(); render() }
    if (act === 'realtd') { S.testDate = null; save(); render() }
});
document.addEventListener('submit', e => { if (e.target.id === 'mf') { e.preventDefault(); submitForm(e.target) } });
document.addEventListener('change', e => { const t = e.target; if (t.name === 'dp') syncSlots(); if (t.name === 'sz') { S.size = t.value; save(); render() } if (t.id === 'hc') { S.contrast = t.checked; save(); render() } if (t.id === 'nf') toggleNotify(t); if (t.dataset.def && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.value)) { S.defTimes[t.dataset.def] = t.value; DT[t.dataset.def] = t.value; save(); announce('Default time saved') } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() });
setInterval(() => {
    const busy = document.querySelector('.ov') || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
    if (S.notify && 'Notification' in window && Notification.permission === 'granted' && !S.testDate) { const n = nowMin(); getPendingDoses().forEach(d => { const k = d.key + d.med.id, x = n - toMin(d.time); if (x >= 0 && x < 5 && !notified.has(k)) { notified.add(k); try { new Notification('Time for ' + d.med.name, { body: LB[d.slot] + ' • ' + t12(d.time) }) } catch (_) { } } }) }
    if (!busy && (today() !== lastDay || nowMin() !== lastMin)) render()
}, 20000); // minute + midnight refresh
load(); render(true);