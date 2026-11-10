const authScreen = document.querySelector('#auth-screen');
const dashboard = document.querySelector('#dashboard');
const authForm = document.querySelector('#auth-form');
const authNameInput = document.querySelector('#auth-name');
const authEmailInput = document.querySelector('#auth-email');
const authPasswordInput = document.querySelector('#auth-password');
const authHeading = document.querySelector('#auth-heading');
const authDescription = document.querySelector('#auth-description');
const authSubmit = document.querySelector('#auth-submit');
const authSwitchPrompt = document.querySelector('#auth-switch-prompt');
const authSwitch = document.querySelector('#auth-switch');
const authMessage = document.querySelector('#auth-message');
const dashboardMessage = document.querySelector('#dashboard-message');
const studentRows = document.querySelector('#student-rows');
const filterForm = document.querySelector('#filter-form');
const filterSearch = document.querySelector('#filter-search');
const filterCity = document.querySelector('#filter-city');
const filterDepartment = document.querySelector('#filter-department');
const filterMarks = document.querySelector('#filter-marks');
const filterMinAge = document.querySelector('#filter-min-age');
const filterMaxAge = document.querySelector('#filter-max-age');
const sortOrder = document.querySelector('#sort-order');
const studentDialog = document.querySelector('#student-dialog');
const studentForm = document.querySelector('#student-form');
const studentFormError = document.querySelector('#student-form-error');
const saveStudentButton = document.querySelector('#save-student-button');
const detailDialog = document.querySelector('#detail-dialog');
const toast = document.querySelector('#toast');

const pageSize = 5;
const colors = ['purple', 'blue', 'green', 'orange', 'pink', 'teal'];

let isRegisterMode = false;
let currentUser = null;
let students = [];
let currentPage = 1;
let totalPages = 1;
let editingStudentId = null;
let searchTimer = null;
let toastTimer = null;
let latestListRequest = 0;

function getToken() {
  return sessionStorage.getItem('campusflow-token');
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (response.status === 401 && token) {
    showLogin('Your session expired. Please sign in again.');
  }
  if (!response.ok) {
    throw new Error(body?.message || 'Something went wrong. Please try again.');
  }

  return body;
}

function showFormMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function hideFormMessage(element) {
  element.textContent = '';
  element.hidden = true;
}

function showToast(message, kind = 'success') {
  toast.textContent = message;
  toast.className = `toast toast-${kind} toast-visible`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 3200);
}

function setLoading(button, loading, message) {
  if (loading) {
    button.dataset.originalText = button.textContent.trim();
    button.textContent = message;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || message;
  button.disabled = false;
}

function showLogin(message = '') {
  sessionStorage.removeItem('campusflow-token');
  sessionStorage.removeItem('campusflow-user');
  currentUser = null;
  dashboard.hidden = true;
  authScreen.hidden = false;
  authPasswordInput.value = '';
  authPasswordInput.autocomplete = isRegisterMode ? 'new-password' : 'current-password';
  hideFormMessage(authMessage);

  if (message) {
    showFormMessage(authMessage, message);
  }
}

function setAuthMode(register) {
  isRegisterMode = register;
  hideFormMessage(authMessage);
  authNameInput.hidden = !register;
  authNameInput.required = register;
  authNameInput.previousElementSibling.hidden = !register;
  authHeading.textContent = register ? 'Create your account' : 'Welcome back';
  authDescription.textContent = register
    ? 'Create your Student account to explore the student directory.'
    : 'Sign in to view and manage your student records.';
  authPasswordInput.autocomplete = register ? 'new-password' : 'current-password';
  authSubmit.textContent = register ? 'Create account' : 'Sign in';
  authSwitchPrompt.textContent = register ? 'Already have an account?' : 'New here?';
  authSwitch.textContent = register ? 'Sign in instead' : 'Create a student account';
  authForm.reset();
  hideFormMessage(authMessage);
}

function openDashboard(user) {
  currentUser = user;
  authScreen.hidden = true;
  dashboard.hidden = false;
  dashboardMessage.hidden = true;

  const displayName = user.name || user.email || 'Student';
  document.querySelector('#profile-name').textContent = displayName;
  document.querySelector('#profile-role').textContent = user.role || 'Student';
  document.querySelector('#profile-avatar').textContent = displayName.trim().charAt(0).toUpperCase();
  document.querySelector('#add-student-button').hidden = user.role !== 'Admin';

  loadDashboard();
}

async function handleAuthentication(event) {
  event.preventDefault();
  hideFormMessage(authMessage);

  const body = {
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value
  };
  if (isRegisterMode) {
    body.name = authNameInput.value.trim();
  }

  const previousLabel = isRegisterMode ? 'Create account' : 'Sign in';
  authSubmit.dataset.originalText = previousLabel;
  setLoading(authSubmit, true, 'Please wait…');

  try {
    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (isRegisterMode) {
      setAuthMode(false);
      authEmailInput.value = body.email;
      showFormMessage(authMessage, 'Account created. You can now sign in.');
      return;
    }

    sessionStorage.setItem('campusflow-token', result.token);
    sessionStorage.setItem('campusflow-user', JSON.stringify(result.user));
    openDashboard(result.user);
  } catch (error) {
    showFormMessage(authMessage, error.message);
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = isRegisterMode ? 'Create account' : 'Sign in';
  }
}

function buildListUrl() {
  const params = new URLSearchParams();
  params.set('page', String(currentPage));
  params.set('limit', String(pageSize));

  const search = filterSearch.value.trim();
  const city = filterCity.value;
  const department = filterDepartment.value;
  const minMarks = filterMarks.value.trim();
  const minAge = filterMinAge.value.trim();
  const maxAge = filterMaxAge.value.trim();

  if (search) params.set('search', search);
  if (city) params.set('city', city);
  if (department) params.set('department', department);
  if (minMarks) params.set('minMarks', minMarks);
  if (minAge) params.set('minAge', minAge);
  if (maxAge) params.set('maxAge', maxAge);
  if (sortOrder.value) {
    params.set('sortBy', 'marks');
    params.set('order', sortOrder.value);
  }

  return `/api/students?${params}`;
}

async function loadDashboard() {
  if (!getToken()) {
    showLogin();
    return;
  }

  await Promise.all([loadStats(), loadStudents()]);
}

async function loadStats() {
  try {
    const stats = await apiRequest('/api/students/stats');
    document.querySelector('#stat-students').textContent = stats.totalStudents.toLocaleString();
    document.querySelector('#stat-average').textContent = `${stats.averageMarks}%`;
    document.querySelector('#stat-departments').textContent = stats.departmentsCount.toLocaleString();
    document.querySelector('#stat-cities').textContent = stats.citiesCount.toLocaleString();
    document.querySelector('#sidebar-count').textContent = stats.totalStudents.toLocaleString();
    updateFilterOptions(filterCity, 'All cities', stats.cities);
    updateFilterOptions(filterDepartment, 'All departments', stats.departments);
  } catch (error) {
    showDashboardMessage(error.message);
  }
}

function updateFilterOptions(select, label, values) {
  const selectedValue = select.value;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = label;
  select.replaceChildren(placeholder);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });

  if (values.includes(selectedValue)) {
    select.value = selectedValue;
  }
}

async function loadStudents() {
  const requestId = ++latestListRequest;
  studentRows.replaceChildren();
  document.querySelector('#empty-state').hidden = true;

  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = currentUser?.role === 'Admin' ? 6 : 5;
  loadingCell.className = 'table-loading';
  loadingCell.textContent = 'Loading student records…';
  loadingRow.append(loadingCell);
  studentRows.append(loadingRow);

  try {
    const result = await apiRequest(buildListUrl());
    if (requestId !== latestListRequest) return;

    students = result.students;
    currentPage = result.currentPage;
    totalPages = Math.max(result.totalPages, 1);
    renderStudents();
    document.querySelector('#visible-count').textContent =
      `${result.totalStudents.toLocaleString()} ${result.totalStudents === 1 ? 'student' : 'students'}`;
    document.querySelector('#current-page-caption').textContent = `Page ${currentPage} of ${totalPages}`;
    document.querySelector('#pagination-summary').textContent = result.totalStudents === 0
      ? 'No students to show'
      : `Showing ${((currentPage - 1) * result.pageLimit) + 1}–${Math.min(
        currentPage * result.pageLimit,
        result.totalStudents
      )} of ${result.totalStudents.toLocaleString()} students`;
    document.querySelector('#page-number').textContent = `${currentPage} / ${totalPages}`;
    document.querySelector('#previous-page').disabled = currentPage <= 1;
    document.querySelector('#next-page').disabled = currentPage >= totalPages;
    document.querySelector('#empty-state').hidden = students.length > 0;
  } catch (error) {
    if (requestId !== latestListRequest || !getToken()) return;
    studentRows.replaceChildren();
    showDashboardMessage(error.message);
    document.querySelector('#empty-state').hidden = true;
  }
}

function renderStudents() {
  studentRows.replaceChildren();
  document.querySelector('.actions-heading').hidden = currentUser?.role !== 'Admin';

  if (students.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = currentUser?.role === 'Admin' ? 6 : 5;
    cell.className = 'table-empty-cell';
    cell.textContent = 'No students on this page.';
    row.append(cell);
    studentRows.append(row);
    return;
  }

  students.forEach((student, index) => {
    const row = document.createElement('tr');
    const studentCell = document.createElement('td');
    const identity = document.createElement('div');
    identity.className = 'student-identity';
    const avatar = document.createElement('span');
    const color = colors[index % colors.length];
    const studentInitials = student.name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
    avatar.className = `student-avatar avatar-${color}`;
    avatar.textContent = studentInitials;
    const studentCopy = document.createElement('span');
    studentCopy.className = 'student-copy';
    const studentName = document.createElement('strong');
    studentName.textContent = student.name;
    const studentEmail = document.createElement('small');
    studentEmail.textContent = student.email;
    studentCopy.append(studentName, studentEmail);
    identity.append(avatar, studentCopy);
    studentCell.append(identity);

    const ageCell = createCell(`${student.age} yrs`, 'age-value');
    const marksCell = document.createElement('td');
    const markSummary = document.createElement('div');
    markSummary.className = 'marks-summary';
    const markValue = document.createElement('strong');
    markValue.textContent = `${student.marks}%`;
    const progressTrack = document.createElement('span');
    progressTrack.className = 'marks-track';
    const progressFill = document.createElement('span');
    progressFill.className = `marks-fill ${Number(student.marks) >= 80 ? 'marks-high' : ''}`;
    progressFill.style.width = `${Math.max(0, Math.min(Number(student.marks), 100))}%`;
    progressTrack.append(progressFill);
    markSummary.append(markValue, progressTrack);
    marksCell.append(markSummary);
    const cityCell = createCell(student.city);
    const departmentCell = document.createElement('td');
    const departmentBadge = document.createElement('span');
    departmentBadge.className = 'department-badge';
    departmentBadge.textContent = student.department;
    departmentCell.append(departmentBadge);
    row.append(studentCell, ageCell, marksCell, cityCell, departmentCell);

    if (currentUser?.role === 'Admin') {
      const actions = document.createElement('td');
      actions.className = 'actions-cell';
      const viewButton = createIconButton('View details', 'eye');
      viewButton.addEventListener('click', () => showStudentDetails(student));
      const editButton = createIconButton('Edit student', 'edit');
      editButton.addEventListener('click', () => openStudentDialog(student));
      const deleteButton = createIconButton('Delete student', 'trash');
      deleteButton.classList.add('delete-action');
      deleteButton.addEventListener('click', () => deleteStudent(student));
      actions.append(viewButton, editButton, deleteButton);
      row.append(actions);
    } else {
      const viewCell = document.createElement('td');
      viewCell.className = 'actions-cell';
      const viewButton = createIconButton('View details', 'eye');
      viewButton.addEventListener('click', () => showStudentDetails(student));
      viewCell.append(viewButton);
      row.append(viewCell);
      document.querySelector('.actions-heading').hidden = false;
    }

    studentRows.append(row);
  });
}

function createCell(value, className = '') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = value;
  return cell;
}

function createIconButton(label, iconName) {
  const paths = {
    eye: '<path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.5"></circle>',
    edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4z"></path>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path>'
  };
  const button = document.createElement('button');
  button.className = 'icon-button row-action';
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = paths[iconName];
  button.append(icon);
  return button;
}

function showDashboardMessage(message) {
  showFormMessage(dashboardMessage, message);
}

function hideDashboardMessage() {
  hideFormMessage(dashboardMessage);
}

function applyFilters(resetPage = true) {
  if (resetPage) currentPage = 1;
  hideDashboardMessage();
  loadStudents();
}

function clearFilters() {
  filterForm.reset();
  sortOrder.value = '';
  applyFilters();
}

function openStudentDialog(student = null) {
  if (currentUser?.role !== 'Admin') return;

  editingStudentId = student?._id || null;
  studentForm.reset();
  hideFormMessage(studentFormError);
  document.querySelector('#student-dialog-title').textContent = student ? 'Edit student' : 'Add a student';
  saveStudentButton.dataset.originalText = student ? 'Save changes' : 'Add student';
  saveStudentButton.textContent = saveStudentButton.dataset.originalText;

  if (student) {
    for (const field of ['name', 'email', 'age', 'marks', 'city', 'department']) {
      studentForm.elements[field].value = student[field];
    }
  }

  studentDialog.showModal();
  studentForm.elements.name.focus();
}

async function saveStudent(event) {
  event.preventDefault();
  hideFormMessage(studentFormError);

  const body = Object.fromEntries(new FormData(studentForm).entries());
  body.age = Number(body.age);
  body.marks = Number(body.marks);
  const isEditing = Boolean(editingStudentId);
  const endpoint = isEditing ? `/api/students/${editingStudentId}` : '/api/students';
  const previousLabel = isEditing ? 'Save changes' : 'Add student';
  saveStudentButton.dataset.originalText = previousLabel;
  setLoading(saveStudentButton, true, 'Saving…');

  try {
    const result = await apiRequest(endpoint, {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    studentDialog.close();
    showToast(result.message || 'Student record saved.');
    await Promise.all([loadStats(), loadStudents()]);
  } catch (error) {
    showFormMessage(studentFormError, error.message);
  } finally {
    saveStudentButton.disabled = false;
    saveStudentButton.textContent = saveStudentButton.dataset.originalText || previousLabel;
  }
}

async function deleteStudent(student) {
  if (currentUser?.role !== 'Admin') return;

  const confirmed = window.confirm(`Delete ${student.name}'s student record? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const result = await apiRequest(`/api/students/${student._id}`, { method: 'DELETE' });
    if (students.length === 1 && currentPage > 1) currentPage -= 1;
    showToast(result.message || 'Student record deleted.');
    await Promise.all([loadStats(), loadStudents()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showStudentDetails(student) {
  const details = document.querySelector('#student-details');
  details.replaceChildren();
  const initials = student.name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const avatar = document.createElement('span');
  avatar.className = 'detail-avatar';
  avatar.textContent = initials;
  const title = document.createElement('h2');
  title.id = 'detail-name';
  title.className = 'detail-name';
  title.textContent = student.name;
  const email = document.createElement('p');
  email.className = 'detail-email';
  email.textContent = student.email;
  const header = document.createElement('div');
  header.className = 'detail-profile';
  header.append(avatar, document.createElement('span'));
  header.lastChild.append(title, email);

  const grid = document.createElement('dl');
  grid.className = 'detail-grid';
  const items = [
    ['Age', `${student.age} years`],
    ['Marks', `${student.marks}%`],
    ['City', student.city],
    ['Department', student.department],
    ['Student ID', student._id]
  ];

  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'detail-item';
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    item.append(term, description);
    grid.append(item);
  });

  details.append(header, grid);
  detailDialog.showModal();
}

authForm.addEventListener('submit', handleAuthentication);
authSwitch.addEventListener('click', () => setAuthMode(!isRegisterMode));
document.querySelector('#logout-button').addEventListener('click', () => showLogin());
document.querySelector('#add-student-button').addEventListener('click', () => openStudentDialog());
document.querySelector('#sidebar-students').addEventListener('click', () => {
  document.querySelector('#students-section').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#clear-filters').addEventListener('click', clearFilters);
document.querySelector('#empty-clear-filters').addEventListener('click', clearFilters);
document.querySelector('#previous-page').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadStudents();
  }
});
document.querySelector('#next-page').addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    loadStudents();
  }
});
document.querySelector('#close-student-dialog').addEventListener('click', () => studentDialog.close());
document.querySelector('#cancel-student-dialog').addEventListener('click', () => studentDialog.close());
document.querySelector('#close-detail-dialog').addEventListener('click', () => detailDialog.close());
studentForm.addEventListener('submit', saveStudent);
sortOrder.addEventListener('change', () => applyFilters());
filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters();
});

for (const input of [filterSearch, filterMarks, filterMinAge, filterMaxAge]) {
  input.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => applyFilters(), 280);
  });
}

filterForm.addEventListener('change', (event) => {
  if (event.target.matches('select')) applyFilters();
});

document.querySelector('#students-section').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    studentDialog.close();
    detailDialog.close();
  }
});

function restoreSession() {
  const token = getToken();
  const savedUser = sessionStorage.getItem('campusflow-user');
  if (!token || !savedUser) {
    showLogin();
    return;
  }

  try {
    openDashboard(JSON.parse(savedUser));
  } catch {
    showLogin();
  }
}

restoreSession();
