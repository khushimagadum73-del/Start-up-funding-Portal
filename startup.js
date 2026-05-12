
var _API='http://127.0.0.1:5000';
var _getToken=function(){return localStorage.getItem('ib_token');};
var _authHeaders=function(extra){return Object.assign({'X-Auth-Token':_getToken()||''},extra||{});};
function showToast(msg,type){
  type=type||'success';
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:2rem;right:2rem;z-index:9999;background:'+(type==='success'?'#10b981':'#ef4444')+';color:#fff;padding:0.75rem 1.25rem;border-radius:10px;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  t.innerHTML='<i class="fas fa-'+(type==='success'?'check-circle':'exclamation-circle')+'"></i> '+msg;
  document.body.appendChild(t);
  setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},3200);
}
function openModal(id){var el=document.getElementById(id);if(el)el.style.display='flex';}
function closeModal(id){var el=document.getElementById(id);if(el)el.style.display='none';}
document.querySelectorAll('.modal-overlay').forEach(function(o){
  o.addEventListener('click',function(e){if(e.target===o)o.style.display='none';});
});

/* ===== PROPOSALS ===== */
var _proposals=[];

function loadProposals(){
  var tbody=document.getElementById('proposals-tbody');
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="9" class="table-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
  fetch(_API+'/proposals',{headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      if(!r.ok){tbody.innerHTML='<tr><td colspan="9" class="table-empty">Error: '+(r.data.error||'Failed')+'</td></tr>';return;}
      _proposals=r.data;
      renderProposals();
      var ov=document.getElementById('ov-proposals');
      if(ov)ov.textContent=_proposals.length;
      loadOverviewInterests();
    })
    .catch(function(){tbody.innerHTML='<tr><td colspan="9" class="table-empty">Cannot connect to server.</td></tr>';});
}

function renderProposals(){
  var tbody=document.getElementById('proposals-tbody');
  if(!tbody)return;
  if(!_proposals.length){
    tbody.innerHTML='<tr><td colspan="9" class="table-empty">No proposals yet. Click New Proposal to get started.</td></tr>';
    return;
  }
  var sc={active:'investor',draft:'admin',funded:'startup',closed:'admin'};
  tbody.innerHTML=_proposals.map(function(p,i){
    var goal=p.funding_goal?'$'+Number(p.funding_goal).toLocaleString():'-';
    var safeTitle=p.title.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<tr><td>'+(i+1)+'</td>'
      +'<td><strong>'+p.title+'</strong></td>'
      +'<td>'+(p.industry||'-')+'</td>'
      +'<td>'+goal+'</td>'
      +'<td>'+(p.funding_stage||'-')+'</td>'
      +'<td><span class="role-tag '+(sc[p.status]||'startup')+'">'+p.status+'</span></td>'
      +'<td><button class="btn btn-primary" style="padding:0.25rem 0.65rem;font-size:0.78rem" onclick="viewInterests('+p.id+',\''+safeTitle+'\')">'
      +'<i class="fas fa-users"></i> View Interests</button></td>'
      +'<td>'+new Date(p.created_at).toLocaleDateString()+'</td>'
      +'<td><button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.78rem;color:#ef4444" onclick="deleteProposal('+p.id+')">'
      +'<i class="fas fa-trash"></i></button></td></tr>';
  }).join('');
}

var _npBtn=document.getElementById('new-proposal-btn');
if(_npBtn){
  _npBtn.addEventListener('click',function(){
    var f=document.getElementById('proposal-form');if(f)f.reset();
    var e=document.getElementById('modal-error');if(e)e.style.display='none';
    openModal('proposal-modal');
  });
}
var _mc=document.getElementById('modal-close');
if(_mc)_mc.addEventListener('click',function(){closeModal('proposal-modal');});
var _mca=document.getElementById('modal-cancel');
if(_mca)_mca.addEventListener('click',function(){closeModal('proposal-modal');});

var _pf=document.getElementById('proposal-form');
if(_pf){
  _pf.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=document.getElementById('proposal-submit-btn');
    var errEl=document.getElementById('modal-error');
    if(errEl)errEl.style.display='none';
    var payload={
      title:document.getElementById('p-title').value.trim(),
      description:document.getElementById('p-desc').value.trim(),
      industry:document.getElementById('p-industry').value,
      funding_stage:document.getElementById('p-stage').value,
      funding_goal:parseFloat(document.getElementById('p-goal').value)||0
    };
    if(!payload.title){
      if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> Title is required.';errEl.style.display='flex';}
      return;
    }
    if(btn){btn.querySelector('.btn-text').style.display='none';btn.querySelector('.btn-loader').style.display='';btn.disabled=true;}
    fetch(_API+'/proposals',{method:'POST',headers:_authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)})
      .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
      .then(function(r){
        if(!r.ok){if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> '+(r.data.error||'Failed.');errEl.style.display='flex';}return;}
        closeModal('proposal-modal');
        showToast('Proposal created! Investors can now see it.');
        loadProposals();
        if(typeof switchSection==='function')switchSection('proposals');
      })
      .catch(function(){if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> Cannot connect.';errEl.style.display='flex';}})
      .finally(function(){if(btn){btn.querySelector('.btn-text').style.display='';btn.querySelector('.btn-loader').style.display='none';btn.disabled=false;}});
  });
}

function deleteProposal(id){
  if(!confirm('Delete this proposal?'))return;
  fetch(_API+'/proposals/'+id,{method:'DELETE',headers:_authHeaders()})
    .then(function(){showToast('Proposal deleted.');loadProposals();})
    .catch(function(){showToast('Could not delete.','error');});
}

/* ===== INTERESTED INVESTORS ===== */
function loadOverviewInterests(){
  var list=document.getElementById('ov-interests-list');
  if(!list||!_proposals.length){
    if(list)list.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center;color:var(--text3)">No proposals yet.</div>';
    return;
  }
  var totalInterested=0,totalAccepted=0,allRows=[],pending=_proposals.length;
  _proposals.forEach(function(p){
    fetch(_API+'/proposals/'+p.id+'/interests',{headers:_authHeaders()})
      .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
      .then(function(r){
        if(r.ok){r.data.forEach(function(inv){totalInterested++;if(inv.status==='accepted')totalAccepted++;allRows.push({inv:inv,proposal:p});});}
      })
      .finally(function(){
        pending--;
        if(pending===0){
          var ovI=document.getElementById('ov-interested');if(ovI)ovI.textContent=totalInterested;
          var ovA=document.getElementById('ov-accepted');if(ovA)ovA.textContent=totalAccepted;
          list.innerHTML='';
          if(!allRows.length){list.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center;color:var(--text3)">No investors have shown interest yet.</div>';return;}
          allRows.slice(0,5).forEach(function(item){
            var inv=item.inv;var p=item.proposal;
            var initials=((inv.first_name||'?').charAt(0)+(inv.last_name||'?').charAt(0)).toUpperCase();
            var sc={pending:'startup',accepted:'investor',rejected:'admin'};
            var safeTitle=p.title.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            var actionBtn=inv.status==='pending'
              ?'<button class="btn btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem" onclick="acceptInvestor('+inv.id+',\''+safeTitle+'\','+p.id+',this)"><i class="fas fa-check"></i> Accept</button>'
              :inv.status==='accepted'
                ?'<span style="color:#10b981;font-size:0.82rem"><i class="fas fa-check-circle"></i> Accepted</span>'
                :'<span style="color:var(--text3);font-size:0.82rem">Rejected</span>';
            var div=document.createElement('div');
            div.className='match-item';
            div.innerHTML='<div class="match-av" style="background:linear-gradient(135deg,#7c3aed,#3b82f6)">'+initials+'</div>'
              +'<div class="match-info"><strong>'+inv.first_name+' '+inv.last_name+'</strong>'
              +'<span>Proposal: '+p.title+'</span></div>'
              +'<span class="role-tag '+(sc[inv.status]||'startup')+'" style="margin-right:0.5rem">'+inv.status+'</span>'+actionBtn;
            list.appendChild(div);
          });
          if(allRows.length>5){
            var more=document.createElement('div');more.className='table-empty';more.style.cssText='padding:0.75rem;text-align:center;';
            more.innerHTML='<button class="btn btn-ghost" style="font-size:0.82rem" onclick="if(typeof switchSection===\'function\')switchSection(\'interested\')">View all '+allRows.length+' interests</button>';
            list.appendChild(more);
          }
        }
      });
  });
}

function loadAllInterests(){
  var container=document.getElementById('all-interests-list');
  if(!container)return;
  if(!_proposals.length){container.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center;color:var(--text3)">No proposals yet.</div>';return;}
  container.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  var allSections=[],pending=_proposals.length;
  _proposals.forEach(function(p){
    fetch(_API+'/proposals/'+p.id+'/interests',{headers:_authHeaders()})
      .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
      .then(function(r){allSections.push({proposal:p,investors:r.ok?r.data:[]});})
      .finally(function(){pending--;if(pending===0)renderAllInterests(allSections);});
  });
}

function renderAllInterests(sections){
  var container=document.getElementById('all-interests-list');
  if(!container)return;
  container.innerHTML='';
  var hasAny=sections.some(function(s){return s.investors.length>0;});
  if(!hasAny){container.innerHTML='<div class="table-empty" style="padding:3rem;text-align:center;color:var(--text3)">No investors have shown interest yet.</div>';return;}
  sections.forEach(function(s){
    if(!s.investors.length)return;
    var card=document.createElement('div');card.className='dash-card';card.style.marginBottom='1rem';
    var sc={pending:'startup',accepted:'investor',rejected:'admin'};
    var header='<div class="dash-card-header"><h4><i class="fas fa-file-alt"></i> '+s.proposal.title
      +' <span style="font-weight:400;color:var(--text3);font-size:0.82rem">('+s.investors.length+' interested)</span></h4>'
      +'<span class="role-tag '+(s.proposal.status==='funded'?'startup':'investor')+'">'+s.proposal.status+'</span></div>';
    var rows=s.investors.map(function(inv,i){
      var safeTitle=s.proposal.title.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      var actionBtn=inv.status==='pending'
        ?'<button class="btn btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem" onclick="acceptInvestor('+inv.id+',\''+safeTitle+'\','+s.proposal.id+',this)"><i class="fas fa-check"></i> Accept</button>'
        :inv.status==='accepted'
          ?'<span style="color:#10b981;font-weight:600"><i class="fas fa-check-circle"></i> Accepted</span>'
          :'<span style="color:var(--text3)">Rejected</span>';
      return '<tr><td>'+(i+1)+'</td><td><strong>'+inv.first_name+' '+inv.last_name+'</strong></td>'
        +'<td>'+(inv.investor_type||'—')+'</td><td>'+inv.email+'</td>'
        +'<td>'+new Date(inv.created_at).toLocaleDateString()+'</td>'
        +'<td><span class="role-tag '+(sc[inv.status]||'startup')+'">'+inv.status+'</span></td>'
        +'<td>'+actionBtn+'</td></tr>';
    }).join('');
    card.innerHTML=header+'<div class="table-wrap"><table class="dash-table"><thead><tr><th>#</th><th>Investor</th><th>Type</th><th>Email</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    container.appendChild(card);
  });
}

function viewInterests(proposalId,title){
  if(typeof switchSection==='function')switchSection('interested');
  setTimeout(function(){loadAllInterests();},100);
}

function acceptInvestor(interestId,title,proposalId,btn){
  if(!confirm('Accept this investor? The proposal will be marked as funded.'))return;
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
  fetch(_API+'/interests/'+interestId+'/accept',{method:'POST',headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      if(!r.ok){showToast(r.data.error||'Failed.','error');btn.disabled=false;btn.innerHTML='<i class="fas fa-check"></i> Accept';return;}
      showToast('Investor accepted! They have been notified.');
      loadProposals();loadAllInterests();
    })
    .catch(function(){showToast('Cannot connect.','error');btn.disabled=false;btn.innerHTML='<i class="fas fa-check"></i> Accept';});
}

/* ===== FIND INVESTORS ===== */
var _allInvestors=[];
function loadRealInvestors(){
  var list=document.getElementById('investor-list');
  if(!list)return;
  list.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading investors...</div>';
  fetch(_API+'/investors/all',{headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      if(!r.ok){list.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center">Could not load investors.</div>';return;}
      _allInvestors=r.data;renderInvestorList(_allInvestors);
    })
    .catch(function(){list.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center">Cannot connect to server.</div>';});
}
function renderInvestorList(investors){
  var list=document.getElementById('investor-list');if(!list)return;list.innerHTML='';
  if(!investors.length){list.innerHTML='<div class="table-empty" style="padding:2rem;text-align:center;color:var(--text3)">No investors registered yet.</div>';return;}
  var grads=['linear-gradient(135deg,#7c3aed,#3b82f6)','linear-gradient(135deg,#06b6d4,#10b981)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#10b981,#3b82f6)'];
  investors.forEach(function(inv,i){
    var initials=(inv.first_name.charAt(0)+inv.last_name.charAt(0)).toUpperCase();
    var subtitle=[inv.investor_type,inv.investment_focus].filter(Boolean).join(' · ')||'Independent Investor';
    var div=document.createElement('div');div.className='match-item';
    div.innerHTML='<div class="match-av" style="background:'+grads[i%grads.length]+'">'+initials+'</div>'
      +'<div class="match-info"><strong>'+inv.first_name+' '+inv.last_name+'</strong><span>'+subtitle+'</span></div>';
    list.appendChild(div);
  });
}
var _invSearch=document.getElementById('inv-search');
var _invTypeFilter=document.getElementById('inv-type-filter');
if(_invSearch)_invSearch.addEventListener('input',function(){filterInvestors();});
if(_invTypeFilter)_invTypeFilter.addEventListener('change',function(){filterInvestors();});
function filterInvestors(){
  var q=(_invSearch?_invSearch.value:'').toLowerCase();
  var type=_invTypeFilter?_invTypeFilter.value.toLowerCase():'';
  renderInvestorList(_allInvestors.filter(function(inv){
    var text=(inv.first_name+' '+inv.last_name+' '+(inv.investment_focus||'')).toLowerCase();
    return(!q||text.indexOf(q)!==-1)&&(!type||(inv.investor_type||'').toLowerCase().indexOf(type)!==-1);
  }));
}

/* ===== PROFILE ===== */
function loadProfile(){
  fetch(_API+'/me',{headers:_authHeaders()})
    .then(function(res){return res.json();})
    .then(function(data){
      var n=document.getElementById('profile-name');if(n)n.textContent=data.first_name+' '+data.last_name;
      var e=document.getElementById('profile-email');if(e)e.textContent=data.email;
    }).catch(function(){});
}

/* ===== MEETINGS ===== */
var _acceptedDeals=[];
function openScheduleModal(){
  fetch(_API+'/messages/conversations',{headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      var sel=document.getElementById('s-investor-select');if(!sel)return;
      _acceptedDeals=r.ok?r.data:[];
      if(!_acceptedDeals.length){sel.innerHTML='<option value="">No accepted investors yet</option>';}
      else{sel.innerHTML='<option value="">Select investor...</option>'+_acceptedDeals.map(function(d){return'<option value="'+d.other_user_id+'|'+d.proposal_id+'">'+d.other_name+' - '+d.proposal_title+'</option>';}).join('');}
    }).catch(function(){});
  var errEl=document.getElementById('schedule-error');if(errEl)errEl.style.display='none';
  var form=document.getElementById('schedule-form');if(form)form.reset();
  openModal('schedule-modal');
}
function loadMeetings(){
  var tbody=document.getElementById('meetings-tbody');if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="9" class="table-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
  fetch(_API+'/meetings',{headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      if(!r.ok){tbody.innerHTML='<tr><td colspan="9" class="table-empty">Could not load meetings.</td></tr>';return;}
      if(!r.data.length){tbody.innerHTML='<tr><td colspan="9" class="table-empty">No meetings scheduled yet.</td></tr>';return;}
      var sc={pending:'startup',confirmed:'investor',declined:'admin',cancelled:'admin'};
      tbody.innerHTML=r.data.map(function(m,i){
        var cancelBtn=(m.status==='pending'||m.status==='confirmed')
          ?'<button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.78rem;color:#ef4444" onclick="cancelMeeting('+m.id+')"><i class="fas fa-times"></i> Cancel</button>'
          :'—';
        return'<tr><td>'+(i+1)+'</td><td><strong>'+m.title+'</strong></td><td>'+m.other_name+'</td>'
          +'<td>'+m.meeting_date+'</td><td>'+m.meeting_time+'</td><td>'+m.meeting_type+'</td>'
          +'<td style="font-size:0.8rem">'+m.proposal_title+'</td>'
          +'<td><span class="role-tag '+(sc[m.status]||'startup')+'">'+m.status+'</span></td>'
          +'<td>'+cancelBtn+'</td></tr>';
      }).join('');
    }).catch(function(){tbody.innerHTML='<tr><td colspan="9" class="table-empty">Cannot connect to server.</td></tr>';});
}
var _schedForm=document.getElementById('schedule-form');
if(_schedForm){
  _schedForm.addEventListener('submit',function(e){
    e.preventDefault();
    var errEl=document.getElementById('schedule-error');if(errEl)errEl.style.display='none';
    var selVal=document.getElementById('s-investor-select').value;
    if(!selVal){if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> Please select an investor.';errEl.style.display='flex';}return;}
    var parts=selVal.split('|');
    var payload={proposal_id:parseInt(parts[1]),investor_id:parseInt(parts[0]),
      title:document.getElementById('s-title').value.trim(),
      meeting_date:document.getElementById('s-date').value,
      meeting_time:document.getElementById('s-time').value,
      meeting_type:document.getElementById('s-type').value,
      agenda:document.getElementById('s-agenda').value.trim()};
    if(!payload.title||!payload.meeting_date||!payload.meeting_time){
      if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> Please fill all required fields.';errEl.style.display='flex';}return;}
    var btn=document.getElementById('schedule-submit-btn');
    if(btn){btn.querySelector('.btn-text').style.display='none';btn.querySelector('.btn-loader').style.display='';btn.disabled=true;}
    fetch(_API+'/meetings',{method:'POST',headers:_authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)})
      .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
      .then(function(r){
        if(!r.ok){if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> '+(r.data.error||'Failed.');errEl.style.display='flex';}return;}
        closeModal('schedule-modal');showToast('Meeting scheduled! The investor has been notified.');
        loadMeetings();if(typeof switchSection==='function')switchSection('meetings');
      })
      .catch(function(){if(errEl){errEl.innerHTML='<i class="fas fa-exclamation-circle"></i> Cannot connect.';errEl.style.display='flex';}})
      .finally(function(){if(btn){btn.querySelector('.btn-text').style.display='';btn.querySelector('.btn-loader').style.display='none';btn.disabled=false;}});
  });
}
function cancelMeeting(id){
  if(!confirm('Cancel this meeting?'))return;
  fetch(_API+'/meetings/'+id+'/status',{method:'POST',headers:_authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({status:'cancelled'})})
    .then(function(){showToast('Meeting cancelled.');loadMeetings();})
    .catch(function(){showToast('Could not cancel.','error');});
}

/* ===== MESSAGES / CHAT ===== */
var _chatProposalId=null,_chatOtherUserId=null,_chatPollTimer=null;
function loadConversations(){
  var list=document.getElementById('conv-list');if(!list)return;
  list.innerHTML='<div style="padding:1rem;text-align:center;color:var(--text3)"><i class="fas fa-spinner fa-spin"></i></div>';
  fetch(_API+'/messages/conversations',{headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      list.innerHTML='';
      if(!r.ok||!r.data.length){list.innerHTML='<div style="padding:1rem;text-align:center;color:var(--text3);font-size:0.82rem">No accepted deals yet.</div>';return;}
      r.data.forEach(function(conv){
        var initials=conv.other_name.split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
        var div=document.createElement('div');div.className='conv-item';
        div.innerHTML='<div class="conv-av" style="background:linear-gradient(135deg,#7c3aed,#3b82f6)">'+initials+'</div>'
          +'<div class="conv-info"><div class="conv-name">'+conv.other_name+'</div><div class="conv-sub">'+conv.proposal_title+'</div></div>'
          +(conv.unread>0?'<span class="conv-badge">'+conv.unread+'</span>':'');
        div.addEventListener('click',function(){
          document.querySelectorAll('#conv-list .conv-item').forEach(function(el){el.classList.remove('active');});
          div.classList.add('active');
          var badge=div.querySelector('.conv-badge');if(badge)badge.remove();
          openChat(conv.proposal_id,conv.other_user_id,conv.other_name,conv.proposal_title);
        });
        list.appendChild(div);
      });
    }).catch(function(){list.innerHTML='<div style="padding:1rem;text-align:center;color:var(--text3);font-size:0.82rem">Cannot connect.</div>';});
}
function openChat(proposalId,otherUserId,otherName,proposalTitle){
  _chatProposalId=proposalId;_chatOtherUserId=otherUserId;
  var header=document.getElementById('chat-header');
  if(header)header.innerHTML='<h4><i class="fas fa-comment-dots"></i> '+otherName+' <span style="font-weight:400;color:var(--text3);font-size:0.8rem">- '+proposalTitle+'</span></h4>';
  var inputArea=document.getElementById('chat-input-area');if(inputArea)inputArea.style.display='';
  fetchMessages();
  if(_chatPollTimer)clearInterval(_chatPollTimer);
  _chatPollTimer=setInterval(fetchMessages,5000);
}
function fetchMessages(){
  if(!_chatProposalId||!_chatOtherUserId)return;
  fetch(_API+'/messages/'+_chatProposalId+'/'+_chatOtherUserId,{headers:_authHeaders()})
    .then(function(res){return res.json().then(function(d){return{ok:res.ok,data:d};});})
    .then(function(r){
      var box=document.getElementById('chat-messages');if(!box||!r.ok)return;
      var wasAtBottom=box.scrollHeight-box.scrollTop<=box.clientHeight+50;
      box.innerHTML='';
      if(!r.data.length){box.innerHTML='<div style="text-align:center;color:var(--text3);margin-top:2rem;font-size:0.85rem">No messages yet. Say hello!</div>';return;}
      r.data.forEach(function(msg){
        var div=document.createElement('div');div.className='chat-bubble '+(msg.is_mine?'mine':'theirs');
        var time=new Date(msg.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
        div.innerHTML=msg.message+'<span class="chat-time">'+(msg.is_mine?'':msg.sender_name+' - ')+time+'</span>';
        box.appendChild(div);
      });
      if(wasAtBottom)box.scrollTop=box.scrollHeight;
    }).catch(function(){});
}
function sendChatMessage(){
  var input=document.getElementById('chat-input');
  if(!input||!input.value.trim()||!_chatProposalId)return;
  var msg=input.value.trim();input.value='';
  fetch(_API+'/messages/'+_chatProposalId+'/'+_chatOtherUserId,{method:'POST',headers:_authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({message:msg})})
    .then(function(){fetchMessages();})
    .catch(function(){showToast('Could not send message.','error');});
}

/* ===== BOOT ===== */
loadProposals();
