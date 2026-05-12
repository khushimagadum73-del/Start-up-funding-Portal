import os

js = r"""
var _API = 'http://127.0.0.1:5000';
var _getToken = function() { return localStorage.getItem('ib_token'); };
var _authHeaders = function(extra) { return Object.assign({'X-Auth-Token': _getToken() || ''}, extra || {}); };

function showToast(msg, type) {
  type = type || 'success';
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:9999;background:' + (type==='success'?'#10b981':'#ef4444') + ';color:#fff;padding:0.75rem 1.25rem;border-radius:10px;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  t.innerHTML = '<i class="fas fa-' + (type==='success'?'check-circle':'exclamation-circle') + '"></i> ' + msg;
  document.body.appendChild(t);
  setTimeout(function() { if(t.parentNode) t.parentNode.removeChild(t); }, 3200);
}

function openModal(id) { var el=document.getElementById(id); if(el) el.style.display='flex'; }
function closeModal(id) { var el=document.getElementById(id); if(el) el.style.display='none'; }

document.querySelectorAll('.modal-overlay').forEach(function(o) {
  o.addEventListener('click', function(e) { if(e.target===o) o.style.display='none'; });
});
"""

out_path = os.path.join(os.path.dirname(__file__), '..', 'startup.js')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(js.lstrip())

print("Part 1 written:", os.path.abspath(out_path))
