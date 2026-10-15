const form = document.getElementById('studentForm');
const rows = document.getElementById('studentRows');
const notice = document.getElementById('notice');
const recordId = document.getElementById('recordId');
const saveButton = document.getElementById('saveButton');
const cancelEdit = document.getElementById('cancelEdit');
let allStudents = [];
let noticeTimer;

function showNotice(message, type = 'info') {
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
}
function setApiStatus(online) {
  const el = document.getElementById('apiStatus');
  el.textContent = online ? 'Connected' : 'Unavailable';
  el.style.color = online ? '#188765' : '#c04c4c';
}
async function api(path = '', options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/students${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let body;
  try { body = await response.json(); } catch { body = { message: 'The server returned an invalid response.' }; }
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}
function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'S'; }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function renderStudents(students) {
  document.getElementById('totalCount').textContent = allStudents.length;
  document.getElementById('visibleCount').textContent = `${students.length} record${students.length === 1 ? '' : 's'}`;
  document.getElementById('searchStatus').textContent = document.getElementById('searchInput').value.trim() ? 'Filtered' : 'All students';
  if (!students.length) {
    rows.innerHTML = `<tr><td colspan="4" class="empty">${document.getElementById('searchInput').value.trim() ? 'No matching students found.' : 'No records yet. Add your first student using the form.'}</td></tr>`;
    return;
  }
  rows.innerHTML = students.map(student => `<tr>
    <td><div class="student-cell"><span class="avatar">${escapeHtml(initials(student.name))}</span><div><div class="student-name">${escapeHtml(student.name)}</div><div class="student-email">${escapeHtml(student.studentId)} · ${escapeHtml(student.email)}</div></div></div></td>
    <td><div class="dept" title="${escapeHtml(student.department)}">${escapeHtml(student.department)}</div></td>
    <td>${escapeHtml(student.semester)}</td>
    <td><div class="action-set"><button class="icon-btn" data-action="edit" data-id="${escapeHtml(student._id)}" aria-label="Edit ${escapeHtml(student.name)}">Edit</button><button class="icon-btn delete" data-action="delete" data-id="${escapeHtml(student._id)}" aria-label="Delete ${escapeHtml(student.name)}">Delete</button></div></td>
  </tr>`).join('');
}
async function loadStudents() {
  rows.innerHTML = '<tr><td colspan="4" class="empty">Loading records…</td></tr>';
  try {
    const result = await api();
    allStudents = result.data || [];
    setApiStatus(true);
    filterAndRender();
  } catch (error) {
    setApiStatus(false);
    rows.innerHTML = '<tr><td colspan="4" class="empty">Could not load records. Check the backend URL, server and database connection.</td></tr>';
    showNotice(`${error.message}. If this is your first run, start the backend and check its MONGODB_URI.`, 'error');
  }
}
function filterAndRender() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = allStudents.filter(s => [s.studentId, s.name, s.email, s.department].some(v => String(v || '').toLowerCase().includes(query)));
  renderStudents(filtered);
}
function resetForm() {
  form.reset(); recordId.value = '';
  document.getElementById('formTitle').textContent = 'Add a student';
  saveButton.innerHTML = '＋ Add student'; cancelEdit.hidden = true;
  document.getElementById('studentId').disabled = false;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    studentId: document.getElementById('studentId').value.trim(),
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    department: document.getElementById('department').value.trim(),
    semester: Number(document.getElementById('semester').value),
    contact: document.getElementById('contact').value.trim()
  };
  saveButton.disabled = true;
  try {
    if (recordId.value) {
      await api(`/${encodeURIComponent(recordId.value)}`, { method: 'PUT', body: JSON.stringify(payload) });
      showNotice('Student updated successfully.', 'success');
    } else {
      await api('', { method: 'POST', body: JSON.stringify(payload) });
      showNotice('Student added successfully.', 'success');
    }
    resetForm(); await loadStudents();
  } catch (error) { showNotice(error.message, 'error'); }
  finally { saveButton.disabled = false; }
});
rows.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const student = allStudents.find(s => s._id === button.dataset.id);
  if (!student) return;
  if (button.dataset.action === 'edit') {
    recordId.value = student._id;
    for (const field of ['studentId', 'name', 'email', 'department', 'semester', 'contact']) document.getElementById(field).value = student[field] ?? '';
    document.getElementById('formTitle').textContent = 'Update student';
    saveButton.innerHTML = '✓ Save changes'; cancelEdit.hidden = false;
    document.getElementById('studentId').disabled = true;
    document.getElementById('studentId').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (button.dataset.action === 'delete') {
    if (!confirm(`Delete the record for ${student.name} (${student.studentId})? This cannot be undone.`)) return;
    button.disabled = true;
    try { await api(`/${encodeURIComponent(student._id)}`, { method: 'DELETE' }); showNotice('Student deleted successfully.', 'success'); await loadStudents(); }
    catch (error) { showNotice(error.message, 'error'); button.disabled = false; }
  }
});
cancelEdit.addEventListener('click', resetForm);
document.getElementById('refreshButton').addEventListener('click', loadStudents);
document.getElementById('searchInput').addEventListener('input', filterAndRender);
loadStudents();
