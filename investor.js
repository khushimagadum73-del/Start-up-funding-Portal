/* INVESTOR DASHBOARD */
var INV_API = 'http://127.0.0.1:5000';
var invToken = function() { return localStorage.getItem('ib_token'); };
var invHeaders = function(extra) { return Object.assign({'X-Auth-Token': invToken() || ''}, extra || {}); };

function invToast(msg, type) {
  type = type || 'success';
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:9999;background:' + (type==='success'?'#10b981':'#ef4444') + ';color:#fff;padding:0.75rem 1.25rem;border-radius:10px;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  t.innerHTML = '<i class="fas fa-' + (type==='success'?'check-circle':'exclamation-circle') + '"></i> ' + msg;
  document.body.appendChild(t);
  setTimeout(function() { if(t.parentNode) t.parentNode.removeChild(t); }, 3200);
}

/* ── render a single proposal card ── */
function renderProposalCard(p, listEl) {
  var initials = ((p.company_name || p.first_name || '?') + '  ').substring(0,2).toUpperCase();
  var goal = p.funding_goal ? '$' + Number(p.funding_goal).toLocaleString() : 'Not specified';
  var alreadyBtn = p.already_interested
    ? '<button class="btn btn-ghost" style="padding:0.35rem 0.9rem;font-size:0.8rem;color:#10b981" disabled><i class="fas fa-check"></i> Interested</button>'
    : '<button class="btn btn-primary" style="padding:0.35rem 0.9rem;font-size:0.8rem" onclick="expressInterest(' + p.id + ',this)"><i class="fas fa-hand-holding-usd"></i> Show Interest</button>';

  var div = document.createElement('div');
  div.className = 'match-item';
  div.style.cssText = 'flex-wrap:wrap;gap:0.75rem;align-items:flex-start;';
  div.innerHTML =
    '<div class="match-av" style="background:linear-gradient(135deg,#7c3aed,#3b82f6);flex-shrink:0">' + initials + '</div>' +
    '<div class="match-info" style="flex:1;min-width:180px">' +
      '<strong>' + p.title + '</strong>' +
      '<span>' + (p.company_name || (p.first_name + ' ' + p.last_name)) + ' &middot; ' + (p.industry || 'General') + ' &middot; ' + (p.funding_stage || 'N/A') + '</span>' +
      (p.description ? '<span style="color:var(--text3);font-size:0.8rem;margin-top:0.25rem;display:block">' + p.description.substring(0,120) + (p.description.length>120?'…':'') + '</span>' : '') +
    '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0">' +
      '<span style="font-size:0.8rem;color:var(--text3)">Goal: <strong style="color:var(--text)">' + goal + '</strong></span>' +
      '<span style="font-size:0.75rem;color:var(--text3)">' + p.interest_count + ' investor' + (p.interest_count!==1?'s':'') + ' interested</span>' +
      alreadyBtn +
    '</div>';
  listEl.appendChild(div);
}

/* ── load all active proposals ── */
var _allProposals = [];

function loadAllProposals() {
  var list = document.getElementById('proposals-list');
  if (!list) return;
  list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

  fetch(INV_API + '/proposals/all', { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      if (!r.ok) { list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center">Could not load proposals.</div>'; return; }
      _allProposals = r.data;
      list.innerHTML = '';
      if (!_allProposals.length) {
        list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center"><i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:0.75rem;opacity:0.3"></i>No active proposals yet. Ask startups to create proposals.</div>';
        return;
      }
      _allProposals.forEach(function(p) { renderProposalCard(p, list); });
      // update overview counter
      var ov = document.getElementById('ov-active-proposals');
      if (ov) ov.textContent = _allProposals.length;
    })
    .catch(function() {
      list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center">Cannot connect to server.</div>';
    });
}

/* ── load overview (latest 3 proposals) ── */
function loadOverviewProposals() {
  var list = document.getElementById('overview-proposals-list');
  if (!list) return;

  fetch(INV_API + '/proposals/all', { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      if (!r.ok || !r.data.length) {
        list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center;color:var(--text3)"><i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:0.75rem;opacity:0.3"></i>No proposals yet.</div>';
        return;
      }
      list.innerHTML = '';
      r.data.slice(0,3).forEach(function(p) { renderProposalCard(p, list); });
      var ov = document.getElementById('ov-active-proposals');
      if (ov) ov.textContent = r.data.length;
    })
    .catch(function() {
      list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center">Cannot connect to server.</div>';
    });
}

/* ── show interest ── */
function expressInterest(proposalId, btn) {
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  fetch(INV_API + '/proposals/' + proposalId + '/interest', { method: 'POST', headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      if (!r.ok) { invToast(r.data.error || 'Failed.', 'error'); btn.disabled=false; btn.innerHTML='<i class="fas fa-hand-holding-usd"></i> Show Interest'; return; }
      btn.outerHTML = '<button class="btn btn-ghost" style="padding:0.35rem 0.9rem;font-size:0.8rem;color:#10b981" disabled><i class="fas fa-check"></i> Interested</button>';
      invToast('Interest sent! The startup will be notified.');
      loadMyInterests();
      // refresh counters
      loadOverviewProposals();
    })
    .catch(function() {
      invToast('Cannot connect to server.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Show Interest';
    });
}

/* ── search/filter ── */
document.getElementById('discover-search') && document.getElementById('discover-search').addEventListener('input', filterProposals);
document.getElementById('discover-industry') && document.getElementById('discover-industry').addEventListener('change', filterProposals);

function filterProposals() {
  var q   = (document.getElementById('discover-search') ? document.getElementById('discover-search').value : '').toLowerCase();
  var ind = document.getElementById('discover-industry') ? document.getElementById('discover-industry').value : '';
  var list = document.getElementById('proposals-list');
  if (!list) return;
  list.innerHTML = '';
  var filtered = _allProposals.filter(function(p) {
    var matchQ   = !q   || (p.title + ' ' + (p.company_name||'') + ' ' + (p.first_name||'') + ' ' + (p.description||'')).toLowerCase().indexOf(q) !== -1;
    var matchInd = !ind || p.industry === ind;
    return matchQ && matchInd;
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center">No proposals match your search.</div>';
    return;
  }
  filtered.forEach(function(p) { renderProposalCard(p, list); });
}

/* ── my interests ── */
function loadMyInterests() {
  var tbody = document.getElementById('my-interests-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty"><i class="fas fa-spinner fa-spin"></i> Loading…</td></tr>';

  fetch(INV_API + '/my/interests', { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      if (!r.ok) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Could not load.</td></tr>'; return; }
      if (!r.data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">You have not shown interest in any proposals yet.<br>Go to Discover Startups to browse active proposals.</td></tr>';
        // update counters
        var ov = document.getElementById('ov-my-interests'); if(ov) ov.textContent = 0;
        var ova = document.getElementById('ov-accepted'); if(ova) ova.textContent = 0;
        var ovp = document.getElementById('ov-pending'); if(ovp) ovp.textContent = 0;
        return;
      }
      var sc = {pending:'startup', accepted:'investor', rejected:'admin'};
      var accepted = 0, pending = 0;
      tbody.innerHTML = r.data.map(function(row, i) {
        if (row.status === 'accepted') accepted++;
        if (row.status === 'pending')  pending++;
        var goal = row.funding_goal ? '$' + Number(row.funding_goal).toLocaleString() : '—';
        var statusLabel = row.status === 'accepted'
          ? '<span class="role-tag investor" style="font-size:0.8rem"><i class="fas fa-check-circle"></i> Approved</span>'
          : row.status === 'rejected'
            ? '<span class="role-tag admin" style="font-size:0.8rem">Rejected</span>'
            : '<span class="role-tag startup" style="font-size:0.8rem">Pending</span>';
        return '<tr>'
          + '<td>' + (i+1) + '</td>'
          + '<td><strong>' + row.title + '</strong></td>'
          + '<td>' + (row.company_name || (row.first_name + ' ' + row.last_name)) + '</td>'
          + '<td>' + (row.industry || '—') + '</td>'
          + '<td>' + goal + '</td>'
          + '<td>' + (row.funding_stage || '—') + '</td>'
          + '<td>' + statusLabel + '</td>'
          + '<td>' + new Date(row.created_at).toLocaleDateString() + '</td>'
          + '</tr>';
      }).join('');
      var ov = document.getElementById('ov-my-interests'); if(ov) ov.textContent = r.data.length;
      var ova = document.getElementById('ov-accepted'); if(ova) ova.textContent = accepted;
      var ovp = document.getElementById('ov-pending'); if(ovp) ovp.textContent = pending;

      // show notification if any accepted
      if (accepted > 0) {
        var notifList = document.getElementById('inv-notifications-list');
        if (notifList) {
          notifList.innerHTML = '';
          r.data.filter(function(x){ return x.status==='accepted'; }).forEach(function(row) {
            var div = document.createElement('div');
            div.className = 'match-item';
            div.innerHTML = '<div class="match-av" style="background:linear-gradient(135deg,#10b981,#06b6d4)"><i class="fas fa-check"></i></div>'
              + '<div class="match-info"><strong>Investment Approved!</strong>'
              + '<span>Your interest in "' + row.title + '" has been accepted by the startup. Congratulations!</span></div>';
            notifList.appendChild(div);
          });
        }
      }
    })
    .catch(function() {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Could not connect.</td></tr>';
    });
}

/* ── profile ── */
function loadInvestorProfile() {
  fetch(INV_API + '/me', { headers: invHeaders() })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var n = document.getElementById('inv-profile-name'); if(n) n.textContent = data.first_name + ' ' + data.last_name;
      var e = document.getElementById('inv-profile-email'); if(e) e.textContent = data.email;
    })
    .catch(function(){});
}

/* ── hook into switchSection from dashboard.js ── */
window.addEventListener('load', function() {
  if (typeof switchSection === 'function') {
    var _orig = switchSection;
    switchSection = function(name) {
      _orig(name);
      if (name === 'inv-discover')   loadAllProposals();
      if (name === 'inv-interests')  loadMyInterests();
      if (name === 'inv-profile')    loadInvestorProfile();
      if (name === 'inv-notifications') loadInvestorNotifications();
    };
  }
  // boot
  loadOverviewProposals();
  loadMyInterests();
  checkUnreadNotifications();
});

/* ══ NOTIFICATIONS ══ */
function loadInvestorNotifications() {
  var list = document.getElementById('inv-notifications-list');
  if (!list) return;
  list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

  fetch(INV_API + '/my/notifications', { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      if (!r.ok || !r.data.length) {
        list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center;color:var(--text3)"><i class="fas fa-bell" style="font-size:2rem;display:block;margin-bottom:0.75rem;opacity:0.3"></i>No notifications yet.</div>';
        return;
      }
      list.innerHTML = '';
      r.data.forEach(function(n) {
        var icon = n.type === 'success' ? 'check-circle' : n.type === 'info' ? 'info-circle' : 'bell';
        var color = n.type === 'success' ? 'linear-gradient(135deg,#10b981,#06b6d4)' : n.type === 'info' ? 'linear-gradient(135deg,#3b82f6,#7c3aed)' : 'linear-gradient(135deg,#f59e0b,#ef4444)';
        var unread = !n.is_read ? 'style="background:var(--surface2)"' : '';
        var div = document.createElement('div');
        div.className = 'match-item';
        if (!n.is_read) div.style.background = 'rgba(124,58,237,0.06)';
        div.innerHTML = '<div class="match-av" style="background:' + color + ';flex-shrink:0"><i class="fas fa-' + icon + '"></i></div>'
          + '<div class="match-info" style="flex:1">'
          + '<strong>' + n.title + '</strong>'
          + '<span>' + n.message + '</span>'
          + '<span style="color:var(--text3);font-size:0.75rem;margin-top:0.2rem;display:block">' + new Date(n.created_at).toLocaleString() + '</span>'
          + '</div>'
          + (!n.is_read ? '<span style="width:8px;height:8px;border-radius:50%;background:#7c3aed;flex-shrink:0;margin-left:0.5rem"></span>' : '');
        list.appendChild(div);
      });
      // mark all as read after viewing
      fetch(INV_API + '/my/notifications/read', { method: 'POST', headers: invHeaders() }).catch(function(){});
      // update badge count
      var unreadCount = r.data.filter(function(n){ return !n.is_read; }).length;
      updateNotifBadge(unreadCount);
    })
    .catch(function() {
      list.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center">Cannot connect to server.</div>';
    });
}

function updateNotifBadge(count) {
  // add a badge to the notifications nav item if there are unread
  var navItem = document.querySelector('.nav-item[data-section="inv-notifications"]');
  if (!navItem) return;
  var existing = navItem.querySelector('.notif-badge');
  if (existing) existing.remove();
  if (count > 0) {
    var badge = document.createElement('span');
    badge.className = 'notif-badge';
    badge.style.cssText = 'background:#ef4444;color:#fff;border-radius:100px;font-size:0.65rem;font-weight:700;padding:0.1rem 0.4rem;margin-left:auto;';
    badge.textContent = count;
    navItem.appendChild(badge);
  }
}

/* check for unread notifications on load */
function checkUnreadNotifications() {
  fetch(INV_API + '/my/notifications', { headers: invHeaders() })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!Array.isArray(data)) return;
      var unread = data.filter(function(n){ return !n.is_read; }).length;
      updateNotifBadge(unread);
    }).catch(function(){});
}



/* ══ MESSAGES / CHAT (investor) ══ */
var _invChatProposalId = null;
var _invChatOtherUserId = null;
var _invChatPollTimer = null;

function loadInvConversations() {
  var list = document.getElementById('inv-conv-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text3)"><i class="fas fa-spinner fa-spin"></i></div>';
  fetch(INV_API + '/messages/conversations', { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      list.innerHTML = '';
      if (!r.ok || !r.data.length) {
        list.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text3);font-size:0.82rem">No accepted deals yet.<br>Wait for a startup to accept your interest.</div>';
        return;
      }
      r.data.forEach(function(conv) {
        var initials = conv.other_name.split(' ').map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();
        var div = document.createElement('div');
        div.className = 'conv-item';
        div.innerHTML = '<div class="conv-av" style="background:linear-gradient(135deg,#10b981,#06b6d4)">' + initials + '</div>'
          + '<div class="conv-info"><div class="conv-name">' + conv.other_name + '</div>'
          + '<div class="conv-sub">' + conv.proposal_title + '</div></div>'
          + (conv.unread > 0 ? '<span class="conv-badge">' + conv.unread + '</span>' : '');
        div.addEventListener('click', function() {
          document.querySelectorAll('#inv-conv-list .conv-item').forEach(function(el){ el.classList.remove('active'); });
          div.classList.add('active');
          var badge = div.querySelector('.conv-badge'); if(badge) badge.remove();
          openInvChat(conv.proposal_id, conv.other_user_id, conv.other_name, conv.proposal_title);
        });
        list.appendChild(div);
      });
    })
    .catch(function() {
      list.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text3);font-size:0.82rem">Cannot connect.</div>';
    });
}

function openInvChat(proposalId, otherUserId, otherName, proposalTitle) {
  _invChatProposalId = proposalId;
  _invChatOtherUserId = otherUserId;
  var header = document.getElementById('inv-chat-header');
  if (header) header.innerHTML = '<h4><i class="fas fa-comment-dots"></i> ' + otherName + ' <span style="font-weight:400;color:var(--text3);font-size:0.8rem">· ' + proposalTitle + '</span></h4>';
  var inputArea = document.getElementById('inv-chat-input-area');
  if (inputArea) inputArea.style.display = '';
  fetchInvMessages();
  if (_invChatPollTimer) clearInterval(_invChatPollTimer);
  _invChatPollTimer = setInterval(fetchInvMessages, 5000);
}

function fetchInvMessages() {
  if (!_invChatProposalId || !_invChatOtherUserId) return;
  fetch(INV_API + '/messages/' + _invChatProposalId + '/' + _invChatOtherUserId, { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      var box = document.getElementById('inv-chat-messages');
      if (!box || !r.ok) return;
      var wasAtBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 50;
      box.innerHTML = '';
      if (!r.data.length) {
        box.innerHTML = '<div style="text-align:center;color:var(--text3);margin-top:2rem;font-size:0.85rem">No messages yet. Say hello!</div>';
        return;
      }
      r.data.forEach(function(msg) {
        var div = document.createElement('div');
        div.className = 'chat-bubble ' + (msg.is_mine ? 'mine' : 'theirs');
        var time = new Date(msg.created_at).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'});
        div.innerHTML = msg.message + '<span class="chat-time">' + (msg.is_mine ? '' : msg.sender_name + ' · ') + time + '</span>';
        box.appendChild(div);
      });
      if (wasAtBottom) box.scrollTop = box.scrollHeight;
    })
    .catch(function(){});
}

function invSendMessage() {
  var input = document.getElementById('inv-chat-input');
  if (!input || !input.value.trim() || !_invChatProposalId) return;
  var msg = input.value.trim();
  input.value = '';
  fetch(INV_API + '/messages/' + _invChatProposalId + '/' + _invChatOtherUserId, {
    method: 'POST',
    headers: invHeaders({'Content-Type':'application/json'}),
    body: JSON.stringify({message: msg})
  })
  .then(function() { fetchInvMessages(); })
  .catch(function() { invToast('Could not send message.', 'error'); });
}

/* ══ MEETINGS (investor) ══ */
function loadInvMeetings() {
  var tbody = document.getElementById('inv-meetings-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="table-empty"><i class="fas fa-spinner fa-spin"></i> Loading…</td></tr>';
  fetch(INV_API + '/meetings', { headers: invHeaders() })
    .then(function(res) { return res.json().then(function(d){ return {ok:res.ok,data:d}; }); })
    .then(function(r) {
      if (!r.ok) { tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Could not load meetings.</td></tr>'; return; }
      if (!r.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="table-empty"><i class="fas fa-calendar" style="font-size:2rem;display:block;margin-bottom:0.75rem;opacity:0.3"></i>No meetings scheduled yet.</td></tr>';
        return;
      }
      var sc = {pending:'startup',confirmed:'investor',declined:'admin',cancelled:'admin'};
      tbody.innerHTML = r.data.map(function(m, i) {
        var actions = '';
        if (m.status === 'pending') {
          actions = '<button class="btn btn-primary" style="padding:0.25rem 0.6rem;font-size:0.78rem;margin-right:0.3rem" onclick="respondMeeting(' + m.id + ',\'confirmed\')">'
            + '<i class="fas fa-check"></i> Confirm</button>'
            + '<button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.78rem;color:#ef4444" onclick="respondMeeting(' + m.id + ',\'declined\')">'
            + '<i class="fas fa-times"></i> Decline</button>';
        } else { actions = '—'; }
        return '<tr>'
          + '<td>' + (i+1) + '</td>'
          + '<td><strong>' + m.title + '</strong></td>'
          + '<td>' + m.other_name + (m.other_org ? '<br><small style="color:var(--text3)">' + m.other_org + '</small>' : '') + '</td>'
          + '<td>' + m.meeting_date + '</td>'
          + '<td>' + m.meeting_time + '</td>'
          + '<td>' + m.meeting_type + '</td>'
          + '<td style="font-size:0.8rem">' + m.proposal_title + '</td>'
          + '<td><span class="role-tag ' + (sc[m.status]||'startup') + '">' + m.status + '</span></td>'
          + '<td>' + actions + '</td>'
          + '</tr>';
      }).join('');
    })
    .catch(function() {
      tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Cannot connect to server.</td></tr>';
    });
}

function respondMeeting(id, status) {
  var label = status === 'confirmed' ? 'confirm' : 'decline';
  if (!confirm('Are you sure you want to ' + label + ' this meeting?')) return;
  fetch(INV_API + '/meetings/' + id + '/status', {
    method: 'POST',
    headers: invHeaders({'Content-Type':'application/json'}),
    body: JSON.stringify({status: status})
  })
  .then(function(){
    invToast('Meeting ' + status + '! The startup has been notified.');
    loadInvMeetings();
  })
  .catch(function(){invToast('Could not update meeting.','error');});
}
