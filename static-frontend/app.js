// app.js
const API_BASE_URL = 'http://localhost:8080'; 

// 만약 나중에 자동으로 주소가 바뀌길 원한다면 아래처럼 써야 합니다.
/*
const API_BASE_URL = (() => {
  const host = window.location.hostname; // 현재 접속 중인 도메인을 가져옴
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8080';
  }
  // 배포 환경에서도 아직 백엔드가 로컬에 있다면 아래 주소도 localhost여야 함
  return 'http://localhost:8080'; 
})();
*/

const labels = {
  roles: {
    SUPER_ADMIN: '슈퍼 관리자',
    OPERATION_ADMIN: '운영 관리자',
    CS_ADMIN: 'CS 관리자',
  },
  adminStatus: {
    ACTIVE: '활성',
    INACTIVE: '비활성',
    SUSPENDED: '정지',
    PENDING: '승인대기',
    REJECTED: '거부',
  },
  customerStatus: {
    ACTIVE: '활성',
    INACTIVE: '비활성',
    SUSPENDED: '정지',
  },
  productStatus: {
    ON_SALE: '판매중',
    SOLD_OUT: '품절',
    DISCONTINUED: '단종',
  },
  orderStatus: {
    READY: '준비중',
    SHIPPING: '배송중',
    DELIVERED: '배송완료',
    CANCELED: '주문취소',
  },
}

// 1. 더미 데이터를 걷어내고 빈 배열로 초기화합니다.
const db = {
  admins: [],
  customers: [],
  products: [],
  orders: [],
}

let state = {
  admin: JSON.parse(localStorage.getItem('staticAdmin') || 'null'),
  authView: 'login',
  page: 'dashboard',
  keyword: '',
  status: '',
  category: '',
  role: '',
  synced: false,
  syncing: false,
}

const app = document.getElementById('app')

function inferRole(email) {
  if (email.includes('super')) return 'SUPER_ADMIN'
  if (email.includes('operation')) return 'OPERATION_ADMIN'
  return 'CS_ADMIN'
}

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    const text = await response.text()
    if (!text) return { httpStatus: response.status, message: response.ok ? '성공' : response.statusText }
    try {
      return JSON.parse(text)
    } catch {
      return { httpStatus: response.status, message: text }
    }
  } catch {
    return { httpStatus: 500, message: '백엔드 연결 실패' }
  }
}

function normalizeRole(value) {
  return {
    SUPER_ADMIN: 'SUPER_ADMIN',
    OPERATION_ADMIN: 'OPERATION_ADMIN',
    CS_ADMIN: 'CS_ADMIN',
    '슈퍼 관리자': 'SUPER_ADMIN',
    '운영 관리자': 'OPERATION_ADMIN',
    'CS 관리자': 'CS_ADMIN',
  }[value] || 'CS_ADMIN'
}

function normalizeAdminStatus(value) {
  return {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    SUSPENDED: 'SUSPENDED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    '활성': 'ACTIVE',
    '비활성': 'INACTIVE',
    '정지': 'SUSPENDED',
    '승인대기': 'PENDING',
    '거부': 'REJECTED',
  }[value] || 'PENDING'
}

function normalizeCustomerStatus(value) {
  return {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    SUSPENDED: 'SUSPENDED',
    '활성': 'ACTIVE',
    '비활성': 'INACTIVE',
    '정지': 'SUSPENDED',
  }[value] || 'ACTIVE'
}

function normalizeProductStatus(value) {
  return {
    ON_SALE: 'ON_SALE',
    SOLD_OUT: 'SOLD_OUT',
    DISCONTINUED: 'DISCONTINUED',
    '판매중': 'ON_SALE',
    '품절': 'SOLD_OUT',
    '단종': 'DISCONTINUED',
  }[value] || 'ON_SALE'
}

function normalizeOrderStatus(value) {
  return {
    READY: 'READY',
    SHIPPING: 'SHIPPING',
    DELIVERED: 'DELIVERED',
    CANCELED: 'CANCELED',
    '준비중': 'READY',
    '배송중': 'SHIPPING',
    '배송완료': 'DELIVERED',
    '주문취소': 'CANCELED',
  }[value] || 'READY'
}

function pageContent(response) {
  return response?.httpStatus === 200 && Array.isArray(response.data?.content) ? response.data.content : null
}

// 백엔드에서 데이터를 동기화합니다.
async function syncFromBackend() {
  const [adminsRes, customersRes, productsRes, ordersRes] = await Promise.all([
    apiRequest('/admins?page=1&size=200'),
    apiRequest('/customers?page=1&size=200'),
    apiRequest('/products?page=1&size=200'),
    apiRequest('/orders?page=1&size=200'),
  ])

  const admins = pageContent(adminsRes)
  if (admins) {
    db.admins = admins.map((admin) => ({
      adminId: admin.adminId ?? admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone ?? admin.phoneNumber ?? '',
      role: normalizeRole(admin.role),
      status: normalizeAdminStatus(admin.status),
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      approvedAt: admin.approvedAt,
      rejectedAt: admin.rejectedAt,
      rejectedReason: admin.rejectedReason,
    }))
  }

  const customers = pageContent(customersRes)
  if (customers) {
    db.customers = customers.map((customer) => ({
      customerId: customer.customerId ?? customer.id,
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber ?? customer.phone ?? '',
      status: normalizeCustomerStatus(customer.status),
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt ?? customer.createdAt,
      totalOrderCount: customer.totalOrderCount ?? 0,
      totalPurchaseAmount: customer.totalPurchaseAmount ?? 0,
    }))
  }

  const products = pageContent(productsRes)
  if (products) {
    db.products = products.map((product) => ({
      productId: product.productId ?? product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      status: normalizeProductStatus(product.status),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      adminName: product.adminName ?? '-',
      adminEmail: product.adminEmail,
    }))
  }

  const orders = pageContent(ordersRes)
  if (orders) {
    db.orders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId ?? 0,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      productId: order.productId ?? 0,
      productName: order.productName,
      quantity: order.quantity,
      orderPrice: order.orderPrice ?? 0,
      totalPrice: order.totalPrice,
      status: normalizeOrderStatus(order.status),
      receiverName: order.receiverName ?? '-',
      receiverPhone: order.receiverPhone ?? '-',
      deliveryAddress: order.deliveryAddress ?? '-',
      createdAt: order.createdAt,
      adminName: order.adminName ?? '-',
      adminEmail: order.adminEmail,
      adminRole: order.adminRole,
    }))
  }
}

async function login(email, password) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (response.httpStatus === 200 || response.httpStatus === 201) {
    state.admin = { email, role: inferRole(email) }
    localStorage.setItem('staticAdmin', JSON.stringify(state.admin))
    await syncFromBackend()
    state.synced = true
    render()
    return
  }

  // 실패 시 무조건 실패 메시지만 출력 (Mock 로그인 제거)
  state.loginMessage = response.message || '로그인에 실패했습니다.'
  render()
}

async function signup(form) {
  if (!form.name.trim()) {
    state.signupMessage = '이름을 입력해주세요.'
    render()
    return
  }
  if (!isValidEmail(form.email)) {
    state.signupMessage = '이메일 형식이 올바르지 않습니다.'
    render()
    return
  }
  if (form.password.length < 8) {
    state.signupMessage = '비밀번호는 8자 이상으로 입력해주세요.'
    render()
    return
  }
  if (!isValidExactPhone(form.phoneNumber)) {
    state.signupMessage = '전화번호 형식이 올바르지 않습니다. 예: 010-1234-5678'
    render()
    return
  }

  const response = await apiRequest('/admins/signUp', {
    method: 'POST',
    body: JSON.stringify(form),
  })

  if (isBackendError(response)) {
    state.signupMessage = response.message || '관리자 등록 요청에 실패했습니다.'
    render()
    return
  }

  // 성공 시 Mock 배열 푸시 제거, 로그인 화면으로 이동
  state.authView = 'login'
  state.signupMessage = '관리자 등록 요청이 완료되었습니다. 승인 후 로그인할 수 있습니다.'
  render()
}

function logout() {
  localStorage.removeItem('staticAdmin')
  state = { admin: null, authView: 'login', page: 'dashboard', keyword: '', status: '', category: '', role: '', synced: false, syncing: false, currentPage: 1 }
  apiRequest('/auth/logout', { method: 'POST' })
  render()
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR')
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidExactPhone(value) {
  return /^010-\d{4}-\d{4}$/.test(value)
}

function isBackendError(response) {
  return response?.httpStatus >= 400
}

function showFormError(message) {
  let target = document.getElementById('formMessage')
  if (!target) return
  target.innerHTML = `<div class="message">${message}</div>`
}

function badge(text, tone = 'green') {
  return `<span class="badge ${tone}">${text}</span>`
}

function roleBadge(role) {
  const tone = role === 'SUPER_ADMIN' ? 'purple' : role === 'OPERATION_ADMIN' ? 'blue' : 'green'
  return badge(labels.roles[role] || role, tone)
}

function statusBadge(status, type) {
  const tone = ['ACTIVE', 'ON_SALE', 'DELIVERED'].includes(status)
    ? 'green'
    : ['PENDING', 'SOLD_OUT', 'SHIPPING'].includes(status)
      ? 'yellow'
      : ['READY'].includes(status)
        ? 'blue'
        : 'red'
  const map = type === 'admin' ? labels.adminStatus : type === 'customer' ? labels.customerStatus : type === 'product' ? labels.productStatus : labels.orderStatus
  return badge(map[status] || status, tone)
}

function filterRows(rows, keys) {
  const keyword = state.keyword.trim().toLowerCase()
  if (!keyword) return rows
  return rows.filter((row) => keys.some((key) => String(row[key] || '').toLowerCase().includes(keyword)))
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <h1>이커머스 백오피스</h1>
        <p>관리자 계정으로 로그인해주세요.</p>
        <form id="loginForm">
          <div class="field">
            <label for="email">이메일</label>
            <input id="email" type="email" placeholder="admin@example.com" required />
          </div>
          <div class="field">
            <label for="password">비밀번호</label>
            <input id="password" type="password" required />
          </div>
          <button class="btn" style="width:100%; margin-top:20px" type="submit">로그인</button>
          ${state.loginMessage ? `<div class="message">${state.loginMessage}</div>` : ''}
          ${state.signupMessage ? `<div class="message" style="background:rgba(70,200,111,.14); color:#86efac">${state.signupMessage}</div>` : ''}
          <button class="btn ghost" style="width:100%; margin-top:12px" type="button" id="showSignup">관리자 등록 신청</button>
        </form>
      </section>
    </main>
  `

  document.getElementById('showSignup').addEventListener('click', () => {
    state.authView = 'signup'
    state.signupMessage = ''
    render()
  })
  document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault()
    login(document.getElementById('email').value, document.getElementById('password').value)
  })
}

function renderSignup() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <h1>관리자 등록</h1>
        <p>신규 관리자 계정을 신청합니다.</p>
        <form id="signupForm">
          <div class="field">
            <label for="signupName">이름</label>
            <input id="signupName" required />
          </div>
          <div class="field">
            <label for="signupEmail">이메일</label>
            <input id="signupEmail" type="email" required />
          </div>
          <div class="field">
            <label for="signupPassword">비밀번호</label>
            <input id="signupPassword" type="password" minlength="8" required />
          </div>
          <div class="field">
            <label for="signupPhone">전화번호</label>
            <input id="signupPhone" placeholder="010-1234-5678" required />
          </div>
          <div class="field">
            <label for="signupRole">역할</label>
            <select id="signupRole" required>
              <option value="CS_ADMIN">CS 관리자</option>
              <option value="OPERATION_ADMIN">운영 관리자</option>
            </select>
          </div>
          ${state.signupMessage ? `<div class="message">${state.signupMessage}</div>` : ''}
          <button class="btn" style="width:100%; margin-top:20px" type="submit">등록 요청</button>
          <button class="btn ghost" style="width:100%; margin-top:12px" type="button" id="showLogin">로그인으로 돌아가기</button>
        </form>
      </section>
    </main>
  `

  document.getElementById('showLogin').addEventListener('click', () => {
    state.authView = 'login'
    render()
  })
  document.getElementById('signupForm').addEventListener('submit', (event) => {
    event.preventDefault()
    signup({
      name: document.getElementById('signupName').value,
      email: document.getElementById('signupEmail').value,
      password: document.getElementById('signupPassword').value,
      phoneNumber: document.getElementById('signupPhone').value,
      role: document.getElementById('signupRole').value,
    })
  })
}

function renderShell(content) {
  const nav = [
    ['dashboard', '▦', '대시보드'],
    ['admins', '♙', '관리자 관리'],
    ['customers', '♧', '고객 관리'],
    ['products', '◇', '상품 관리'],
    ['orders', '♔', '주문 관리'],
  ]

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-icon">▦</span>
          <span>이커머스 백오피스</span>
          <span class="brand-arrow">‹</span>
        </div>
        <nav class="nav">
          ${nav.map(([page, icon, name]) => `<button class="${state.page === page ? 'active' : ''}" data-page="${page}"><span>${icon}</span>${name}</button>`).join('')}
        </nav>
        <div class="profile">
          <strong>${state.admin.email}</strong>
          <span>${labels.roles[state.admin.role] || state.admin.role}</span>
          <button class="btn ghost" style="width:100%; margin-top:16px" id="profileBtn">내 정보 수정</button>
          <button class="btn ghost" style="width:100%; margin-top:16px" id="passwordBtn">비밀번호 변경</button>
          <button class="btn ghost" style="width:100%; margin-top:16px" id="logoutBtn">로그아웃</button>
        </div>
      </aside>
      <section class="main">
        <header class="topbar">
          <strong>${nav.find(([page]) => page === state.page)?.[2] || '대시보드'}</strong>
          <div class="topbar-actions">
            <span>☼</span>
            <span class="user-chip"><span class="user-avatar">♙</span>admin⌄</span>
          </div>
        </header>
        <main class="content">${content}</main>
      </section>
    </div>
  `

  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.page = button.dataset.page
      state.keyword = ''
      state.status = ''
      state.category = ''
      state.role = ''
      state.currentPage = 1
      render()
    })
  })
  document.getElementById('profileBtn').addEventListener('click', openProfileDialog)
  document.getElementById('passwordBtn').addEventListener('click', openPasswordDialog)
  document.getElementById('logoutBtn').addEventListener('click', logout)
}

function renderDashboard() {
  renderShell(`
    <section class="page-title">
      <h1>안녕하세요, ${state.admin.email.split('@')[0]}님</h1>
      <p>관리자 대시보드에 오신 것을 환영합니다.</p>
    </section>
    <section class="stats">
      ${statCard('관리자', db.admins.length)}
      ${statCard('고객', db.customers.length)}
      ${statCard('상품', db.products.length)}
      ${statCard('주문', db.orders.length)}
    </section>
  `)
}

function statCard(title, value) {
  return `<div class="card stat"><span>${title}</span><strong>${value.toLocaleString('ko-KR')}</strong></div>`
}

function tablePage({ title, rows, columns, searchPlaceholder, filters = '', actions = '' }) {
  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  if (state.currentPage > totalPages) state.currentPage = totalPages
  const pageStart = (state.currentPage - 1) * PAGE_SIZE
  const pagedRows = rows.slice(pageStart, pageStart + PAGE_SIZE)

  const paginationButtons = Array.from({ length: totalPages }, (_, i) => {
    const p = i + 1
    return `<button class="btn small ${p === state.currentPage ? '' : 'ghost'} page-btn" data-p="${p}">${p}</button>`
  }).join('')

  renderShell(`
    <section class="table-panel">
      <div class="toolbar">
        <div class="filters">
          <input id="keyword" placeholder="${searchPlaceholder}" value="${state.keyword}" />
          <button class="btn secondary" id="searchBtn">검색</button>
        </div>
        <div class="filters">
          ${filters}
          ${actions}
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${columns.map((column) => `<th>${column.header}</th>`).join('')}</tr></thead>
          <tbody>
            ${pagedRows.length ? pagedRows.map((row) => `<tr>${columns.map((column) => `<td>${column.cell(row)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}" class="muted" style="text-align: center; padding: 40px;">데이터가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="pagination">${paginationButtons}</div>
    </section>
  `)

  document.getElementById('searchBtn').addEventListener('click', () => {
    state.keyword = document.getElementById('keyword').value
    state.currentPage = 1
    render()
  })
  document.getElementById('keyword').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      state.keyword = event.target.value
      state.currentPage = 1
      render()
    }
  })
  document.querySelectorAll('[data-filter]').forEach((control) => {
    control.addEventListener('change', () => {
      state[control.dataset.filter] = control.value
      state.currentPage = 1
      render()
    })
  })
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id))
  })
  document.querySelectorAll('.page-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentPage = Number(button.dataset.p)
      render()
    })
  })
}

function renderAdmins() {
  let rows = filterRows(db.admins, ['name', 'email'])
  if (state.role) rows = rows.filter((row) => row.role === state.role)
  if (state.status) rows = rows.filter((row) => row.status === state.status)
  tablePage({
    title: '관리자 관리',
    rows,
    searchPlaceholder: '이름 또는 이메일로 검색...',
    filters: `
      <div class="filter-bar">
        <span class="filter-label">▽ 필터</span>
        <select data-filter="role">
          <option value="">모든 역할</option>
          ${Object.entries(labels.roles).map(([value, label]) => `<option value="${value}" ${state.role === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <select data-filter="status">
          <option value="">모든 상태</option>
          ${Object.entries(labels.adminStatus).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    `,
    columns: [
      { header: '<input class="row-check" type="checkbox" />', cell: () => '<input class="row-check" type="checkbox" />' },
      { header: 'ID', cell: (row) => row.adminId },
      { header: '이름 <span class="sort-mark">⌄</span>', cell: (row) => row.name },
      { header: '이메일 <span class="sort-mark">⌄</span>', cell: (row) => row.email },
      { header: '전화번호', cell: (row) => row.phone },
      { header: '역할 <span class="sort-mark">⌄</span>', cell: (row) => roleBadge(row.role) },
      { header: '상태 <span class="sort-mark">⌄</span>', cell: (row) => statusBadge(row.status, 'admin') },
      { header: '가입일 <span class="sort-mark">⌄</span>', cell: (row) => formatDate(row.createdAt) },
      { header: '승인일 <span class="sort-mark">⌄</span>', cell: (row) => row.approvedAt ? formatDate(row.approvedAt) : '-' },
      { header: '작업', cell: (row) => adminActions(row) },
    ],
  })
}

function adminActions(row) {
  const detailButton = actionIcon('view', 'detailAdmin', row.adminId, 'eye', '상세 조회')
  const approveButton = ['PENDING', 'REJECTED'].includes(row.status)
    ? actionIcon('approve', 'approveAdmin', row.adminId, 'check', '승인')
    : ''
  const rejectButton = row.status === 'PENDING'
    ? actionIcon('reject', 'rejectAdmin', row.adminId, 'x', '거부')
    : ''
  const deleteButton = actionIcon('delete', 'deleteAdmin', row.adminId, 'trash', '삭제')

  return `<div class="action-buttons">${detailButton}${approveButton}${rejectButton}${deleteButton}</div>`
}

function actionIcon(tone, action, id, icon, label) {
  return `<button class="icon-action ${tone}" data-action="${action}" data-id="${id}" title="${label}" aria-label="${label}">${iconSvg(icon)}</button>`
}

function iconSvg(name) {
  const icons = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m18 2 4 4L8 20l-5 1 1-5L18 2Z"/><path d="m15 5 4 4"/></svg>',
    filePen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m15 13 3 3"/><path d="M10 20l1-4 7-7 3 3-7 7-4 1Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  }
  return icons[name] || icons.eye
}

function renderCustomers() {
  let rows = filterRows(db.customers, ['name', 'email'])
  if (state.status) rows = rows.filter((row) => row.status === state.status)
  tablePage({
    title: '고객 관리',
    rows,
    searchPlaceholder: '이름 또는 이메일로 검색...',
    filters: `<div class="filter-bar"><span class="filter-label">▽ 필터</span><select data-filter="status"><option value="">모든 상태</option>${Object.entries(labels.customerStatus).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`,
    columns: [
      { header: '<input class="row-check" type="checkbox" />', cell: () => '<input class="row-check" type="checkbox" />' },
      { header: 'ID', cell: (row) => row.customerId },
      { header: '이름 <span class="sort-mark">⌄</span>', cell: (row) => row.name },
      { header: '이메일 <span class="sort-mark">⌄</span>', cell: (row) => row.email },
      { header: '전화번호', cell: (row) => row.phoneNumber },
      { header: '상태 <span class="sort-mark">⌄</span>', cell: (row) => statusBadge(row.status, 'customer') },
      { header: '총 주문수 <span class="sort-mark">⌄</span>', cell: (row) => Number(row.totalOrderCount || 0).toLocaleString('ko-KR') },
      { header: '총 구매금액 <span class="sort-mark">⌄</span>', cell: (row) => formatPrice(row.totalPurchaseAmount) },
      { header: '가입일 <span class="sort-mark">⌄</span>', cell: (row) => formatDate(row.createdAt) },
      { header: '작업', cell: (row) => customerActions(row) },
    ],
  })
}

function customerActions(row) {
  return `<div class="action-buttons">
    ${actionIcon('view', 'detailCustomer', row.customerId, 'eye', '상세 조회')}
    ${actionIcon('delete', 'deleteCustomer', row.customerId, 'trash', '삭제')}
  </div>`
}

function renderProducts() {
  let rows = filterRows(db.products, ['name', 'category'])
  if (state.category) rows = rows.filter((row) => row.category === state.category)
  if (state.status) rows = rows.filter((row) => row.status === state.status)
  tablePage({
    title: '상품 관리',
    rows,
    searchPlaceholder: '상품명 검색...',
    actions: '<button class="btn" data-action="newProduct">상품 등록</button>',
    filters: `
      <div class="filter-bar">
        <span class="filter-label">▽ 필터</span>
        <select data-filter="category"><option value="">전체 카테고리</option>${['전자기기', '의류', '식품', '도서', '생활용품'].map((value) => `<option value="${value}" ${state.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select>
        <select data-filter="status"><option value="">전체 상태</option>${Object.entries(labels.productStatus).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
      </div>
    `,
    columns: [
      { header: '<input class="row-check" type="checkbox" />', cell: () => '<input class="row-check" type="checkbox" />' },
      { header: 'ID', cell: (row) => row.productId },
      { header: '상품명 <span class="sort-mark">⌄</span>', cell: (row) => row.name },
      { header: '카테고리 <span class="sort-mark">⌄</span>', cell: (row) => badge(row.category, 'blue') },
      { header: '가격 <span class="sort-mark">⌄</span>', cell: (row) => formatPrice(row.price) },
      { header: '재고 <span class="sort-mark">⌄</span>', cell: (row) => row.stock },
      { header: '상태 <span class="sort-mark">⌄</span>', cell: (row) => statusBadge(row.status, 'product') },
      { header: '등록일 <span class="sort-mark">⌄</span>', cell: (row) => formatDate(row.createdAt) },
      { header: '등록 관리자 <span class="sort-mark">⌄</span>', cell: (row) => row.adminName },
      { header: '작업', cell: (row) => productActions(row) },
    ],
  })
}

function productActions(row) {
  return `<div class="action-buttons">
    ${actionIcon('view', 'detailProduct', row.productId, 'eye', '상세 조회')}
    ${actionIcon('delete', 'deleteProduct', row.productId, 'trash', '삭제')}
  </div>`
}

function renderOrders() {
  let rows = filterRows(db.orders, ['orderNumber', 'customerName', 'productName'])
  if (state.status) rows = rows.filter((row) => row.status === state.status)
  tablePage({
    title: '주문 관리',
    rows,
    searchPlaceholder: '주문번호 또는 고객명 검색...',
    actions: '<button class="btn" data-action="newOrder">주문 생성</button>',
    filters: `<div class="filter-bar"><span class="filter-label">▽ 필터</span><select data-filter="status"><option value="">전체 상태</option>${Object.entries(labels.orderStatus).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`,
    columns: [
      { header: '<input class="row-check" type="checkbox" />', cell: () => '<input class="row-check" type="checkbox" />' },
      { header: 'ID', cell: (row) => row.id },
      { header: '주문번호 <span class="sort-mark">⌄</span>', cell: (row) => row.orderNumber },
      { header: '고객명 <span class="sort-mark">⌄</span>', cell: (row) => row.customerName },
      { header: '상품명', cell: (row) => row.productName },
      { header: '수량', cell: (row) => row.quantity },
      { header: '총금액 <span class="sort-mark">⌄</span>', cell: (row) => formatPrice(row.totalPrice) },
      { header: '상태 <span class="sort-mark">⌄</span>', cell: (row) => statusBadge(row.status, 'order') },
      { header: '담당자', cell: (row) => row.adminName },
      { header: '주문일 <span class="sort-mark">⌄</span>', cell: (row) => formatDate(row.createdAt) },
      { header: '작업', cell: (row) => orderActions(row) },
    ],
  })
}

function orderActions(row) {
  const cancelButton = row.status === 'READY'
    ? actionIcon('reject', 'cancelOrder', row.id, 'x', '취소')
    : ''
  return `<div class="action-buttons">
    ${actionIcon('view', 'detailOrder', row.id, 'eye', '상세 조회')}
    ${cancelButton}
  </div>`
}

async function handleAction(action, id) {
  if (action === 'newProduct') openProductDialog()
  if (action === 'newOrder') openOrderDialog()
  if (action === 'detailAdmin') openAdminDetail(Number(id))
  if (action === 'detailCustomer') openCustomerDetail(Number(id))
  if (action === 'detailProduct') openProductDetail(Number(id))
  if (action === 'detailOrder') openOrderDetail(Number(id))
  if (action === 'editCustomer') openCustomerEdit(Number(id))
  if (action === 'editProduct') openProductEdit(Number(id))
  if (action === 'stockProduct') openProductStockEdit(Number(id))
  if (action === 'editOrder') openOrderEdit(Number(id))
  if (action === 'editAdminInfo') openAdminEdit(Number(id))
  if (action === 'editAdminSecurity') openAdminEdit(Number(id))
  if (action === 'editAdminStatus') openAdminEdit(Number(id))
  if (action === 'approveAdmin') approveAdmin(Number(id))
  if (action === 'rejectAdmin') rejectAdmin(Number(id))
  if (action === 'deleteAdmin') deleteAdmin(Number(id))
  if (action === 'deleteCustomer') deleteCustomer(Number(id))
  if (action === 'deleteProduct') deleteProduct(Number(id))
  if (action === 'cancelOrder') cancelOrder(Number(id))
}

async function approveAdmin(adminId) {
  const response = await apiRequest(`/admins/${adminId}/approve`, { method: 'POST' })
  if (isBackendError(response)) {
    window.alert(response.message || '관리자 승인에 실패했습니다.')
    return
  }
  await syncFromBackend();
  render()
}

async function rejectAdmin(adminId) {
  const rejectedReason = window.prompt('거부 사유를 입력하세요.', '서류 미비')
  if (!rejectedReason) return

  const response = await apiRequest(`/admins/${adminId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectedReason }),
  })
  if (isBackendError(response)) {
    window.alert(response.message || '관리자 거부에 실패했습니다.')
    return
  }
  await syncFromBackend();
  render()
}

async function deleteAdmin(adminId) {
  if (!window.confirm('이 관리자를 삭제하시겠습니까?')) return

  const response = await apiRequest(`/admins/${adminId}`, { method: 'DELETE' })
  if (isBackendError(response)) {
    window.alert(response.message || '관리자 삭제에 실패했습니다.')
    return
  }
  await syncFromBackend();
  render()
}

async function deleteCustomer(customerId) {
  if (!window.confirm('이 고객을 삭제하시겠습니까?')) return
  const response = await apiRequest(`/customers/${customerId}`, { method: 'DELETE' })
  if (isBackendError(response)) {
    window.alert(response.message || '고객 삭제에 실패했습니다.')
    return
  }
  await syncFromBackend();
  render()
}

async function deleteProduct(productId) {
  if (!window.confirm('이 상품을 삭제하시겠습니까?')) return
  const response = await apiRequest(`/products/${productId}`, { method: 'DELETE' })
  if (isBackendError(response)) {
    window.alert(response.message || '상품 삭제에 실패했습니다.')
    return
  }
  await syncFromBackend();
  render()
}

async function cancelOrder(orderId) {
  const cancelReason = window.prompt('취소 사유를 입력하세요.', '고객 요청')
  if (!cancelReason) return
  const response = await apiRequest(`/orders/${orderId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ cancelReason }),
  })
  if (isBackendError(response)) {
    window.alert(response.message || '주문 취소에 실패했습니다.')
    return
  }
  await syncFromBackend();
  closeDialog()
  render()
}

function openProfileDialog() {
  const current = db.admins.find((admin) => admin.email === state.admin.email) || {
    name: state.admin.email.split('@')[0],
    email: state.admin.email,
    phone: '',
  }

  openDialog(`
    <h2>내 정보 수정</h2>
    <div class="field"><label>이름</label><input id="profileName" value="${current.name}" /></div>
    <div class="field"><label>이메일</label><input id="profileEmail" value="${current.email}" /></div>
    <div class="field"><label>전화번호</label><input id="profilePhone" value="${current.phone}" /></div>
    <div id="formMessage"></div>
    <div class="dialog-actions">
      <button class="btn ghost" data-close>취소</button>
      <button class="btn" id="saveProfile">저장</button>
    </div>
  `)

  document.getElementById('saveProfile').addEventListener('click', async () => {
    const nextProfile = {
      name: document.getElementById('profileName').value.trim(),
      email: document.getElementById('profileEmail').value.trim(),
      phoneNumber: document.getElementById('profilePhone').value.trim(),
    }
    if (!nextProfile.name) {
      showFormError('이름을 입력해주세요.')
      return
    }
    if (!isValidEmail(nextProfile.email)) {
      showFormError('이메일 형식이 올바르지 않습니다. 예: admin@test.com')
      return
    }
    if (!isValidExactPhone(nextProfile.phoneNumber)) {
      showFormError('전화번호는 010-1234-5678 형식이어야 합니다.')
      return
    }

    const response = await apiRequest('/admins/profile', {
      method: 'PATCH',
      body: JSON.stringify(nextProfile),
    })
    if (isBackendError(response)) {
      showFormError(response.message || '프로필 수정에 실패했습니다.')
      return
    }

    state.admin.email = nextProfile.email
    localStorage.setItem('staticAdmin', JSON.stringify(state.admin))
    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openPasswordDialog() {
  openDialog(`
    <h2>비밀번호 변경</h2>
    <div class="field">
      <label for="currentPassword">현재 비밀번호</label>
      <input id="currentPassword" type="password" />
    </div>
    <div class="field">
      <label for="newPassword">새 비밀번호</label>
      <input id="newPassword" type="password" />
    </div>
    <div class="field">
      <label for="confirmPassword">새 비밀번호 확인</label>
      <input id="confirmPassword" type="password" />
    </div>
    <div id="passwordMessage"></div>
    <div class="dialog-actions">
      <button class="btn ghost" data-close>취소</button>
      <button class="btn" id="savePassword">변경</button>
    </div>
  `)

  document.getElementById('savePassword').addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value
    const newPassword = document.getElementById('newPassword').value
    const confirmPassword = document.getElementById('confirmPassword').value
    const message = document.getElementById('passwordMessage')

    if (newPassword.length < 8) {
      message.innerHTML = '<div class="message">새 비밀번호는 8자 이상이어야 합니다.</div>'
      return
    }
    if (newPassword !== confirmPassword) {
      message.innerHTML = '<div class="message">새 비밀번호와 확인 값이 일치하지 않습니다.</div>'
      return
    }

    const response = await apiRequest('/admins/profile/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    })
    if (isBackendError(response)) {
      message.innerHTML = `<div class="message">${response.message || '비밀번호 변경에 실패했습니다.'}</div>`
      return
    }
    message.innerHTML = `<div class="message" style="background:rgba(70,200,111,.14); color:#86efac">${response.message || '비밀번호가 변경되었습니다.'}</div>`
  })
}

function detailItem(label, value) {
  return `<div class="detail-item"><span>${label}</span><strong>${value || '-'}</strong></div>`
}

async function openAdminDetail(adminId) {
  await apiRequest(`/admins/${adminId}`)
  openAdminEdit(adminId)
}

async function openCustomerDetail(customerId) {
  await apiRequest(`/customers/${customerId}`)
  openCustomerEdit(customerId)
}

async function openProductDetail(productId) {
  await apiRequest(`/products/${productId}`)
  openProductEdit(productId)
}

async function openOrderDetail(orderId) {
  await apiRequest(`/orders/${orderId}`)
  openOrderEdit(orderId)
}

function openAdminEdit(adminId) {
  const admin = db.admins.find((item) => item.adminId === adminId)
  if (!admin) return

  openDialog(`
    <h2>관리자 상세 및 수정</h2>
    <div class="detail-grid">
      ${detailItem('ID', admin.adminId)}
      ${detailItem('가입일', formatDate(admin.createdAt))}
      ${detailItem('승인일', admin.approvedAt ? formatDate(admin.approvedAt) : '-')}
      ${detailItem('거부 사유', admin.rejectedReason || '-')}
    </div>
    <div class="field"><label>이름</label><input id="editAdminName" value="${admin.name}" /></div>
    <div class="field"><label>이메일</label><input id="editAdminEmail" value="${admin.email}" /></div>
    <div class="field"><label>전화번호</label><input id="editAdminPhone" value="${admin.phone}" /></div>
    <div class="field">
      <label>역할</label>
      <select id="editAdminRole">
        ${Object.entries(labels.roles).map(([value, label]) => `<option value="${value}" ${admin.role === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>상태</label>
      <select id="editAdminStatus">
        ${Object.entries(labels.adminStatus).map(([value, label]) => `<option value="${value}" ${admin.status === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div id="formMessage"></div>
    <div class="dialog-actions">
      <button class="btn ghost" data-close>취소</button>
      <button class="btn" id="saveAdminEdit">저장</button>
    </div>
  `, true)

  document.getElementById('saveAdminEdit').addEventListener('click', async () => {
    const nextAdmin = {
      name: document.getElementById('editAdminName').value.trim(),
      email: document.getElementById('editAdminEmail').value.trim(),
      phone: document.getElementById('editAdminPhone').value.trim(),
      role: document.getElementById('editAdminRole').value,
      status: document.getElementById('editAdminStatus').value,
    }

    if (!nextAdmin.name) {
      showFormError('이름을 입력해주세요.')
      return
    }
    if (!isValidEmail(nextAdmin.email)) {
      showFormError('이메일 형식이 올바르지 않습니다. 예: admin@test.com')
      return
    }
    if (!isValidExactPhone(nextAdmin.phone)) {
      showFormError('전화번호는 010-1234-5678 형식이어야 합니다.')
      return
    }

    const updateResponse = await apiRequest(`/admins/${adminId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: nextAdmin.name,
        email: nextAdmin.email,
        phoneNumber: nextAdmin.phone,
      }),
    })
    const roleResponse = await apiRequest(`/admins/${adminId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: nextAdmin.role }),
    })
    const statusResponse = await apiRequest(`/admins/${adminId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextAdmin.status }),
    })

    const failed = [updateResponse, roleResponse, statusResponse].find(isBackendError)
    if (failed) {
      showFormError(failed.message || '백엔드 검증에 실패했습니다.')
      return
    }

    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openCustomerEdit(customerId) {
  const customer = db.customers.find((item) => item.customerId === customerId)
  if (!customer) return

  openDialog(`
    <h2>고객 상세 및 수정</h2>
    <div class="detail-grid">
      ${detailItem('ID', customer.customerId)}
      ${detailItem('총 주문수', Number(customer.totalOrderCount || 0).toLocaleString('ko-KR'))}
      ${detailItem('총 구매금액', formatPrice(customer.totalPurchaseAmount))}
      ${detailItem('가입일', formatDate(customer.createdAt))}
    </div>
    <div class="field"><label>이름</label><input id="editCustomerName" value="${customer.name}" /></div>
    <div class="field"><label>이메일</label><input id="editCustomerEmail" value="${customer.email}" /></div>
    <div class="field"><label>전화번호</label><input id="editCustomerPhone" value="${customer.phoneNumber}" /></div>
    <div class="field">
      <label>상태</label>
      <select id="editCustomerStatus">
        ${Object.entries(labels.customerStatus).map(([value, label]) => `<option value="${value}" ${customer.status === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div id="formMessage"></div>
    <div class="dialog-actions"><button class="btn ghost" data-close>취소</button><button class="btn" id="saveCustomerEdit">저장</button></div>
  `, true)
  document.getElementById('saveCustomerEdit').addEventListener('click', async () => {
    const nextCustomer = {
      name: document.getElementById('editCustomerName').value.trim(),
      email: document.getElementById('editCustomerEmail').value.trim(),
      phoneNumber: document.getElementById('editCustomerPhone').value.trim(),
      status: document.getElementById('editCustomerStatus').value,
    }
    if (!nextCustomer.name) {
      showFormError('이름을 입력해주세요.')
      return
    }
    if (!isValidEmail(nextCustomer.email)) {
      showFormError('이메일 형식이 올바르지 않습니다. 예: customer@test.com')
      return
    }
    if (!isValidExactPhone(nextCustomer.phoneNumber)) {
      showFormError('전화번호는 010-1234-5678 형식이어야 합니다.')
      return
    }

    const updateResponse = await apiRequest(`/customers/${customerId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: nextCustomer.name,
        email: nextCustomer.email,
        phoneNumber: nextCustomer.phoneNumber,
      }),
    })
    const statusResponse = await apiRequest(`/customers/${customerId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextCustomer.status }),
    })
    const failed = [updateResponse, statusResponse].find(isBackendError)
    if (failed) {
      showFormError(failed.message || '백엔드 검증에 실패했습니다.')
      return
    }

    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openProductEdit(productId) {
  const product = db.products.find((item) => item.productId === productId)
  if (!product) return

  openDialog(`
    <h2>상품 상세 및 수정</h2>
    <div class="detail-grid">
      ${detailItem('ID', product.productId)}
      ${detailItem('등록일', formatDate(product.createdAt))}
      ${detailItem('수정일', product.updatedAt ? formatDate(product.updatedAt) : '-')}
      ${detailItem('등록 관리자', product.adminName)}
    </div>
    <div class="field"><label>상품명</label><input id="editProductName" value="${product.name}" /></div>
    <div class="field"><label>카테고리</label><input id="editProductCategory" value="${product.category}" /></div>
    <div class="field"><label>가격</label><input id="editProductPrice" type="number" value="${product.price}" /></div>
    <div class="field"><label>재고</label><input id="editProductStock" type="number" value="${product.stock}" min="0" /></div>
    <div class="field">
      <label>상태</label>
      <select id="editProductStatus">
        ${Object.entries(labels.productStatus).map(([value, label]) => `<option value="${value}" ${product.status === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div id="formMessage"></div>
    <div class="dialog-actions"><button class="btn ghost" data-close>취소</button><button class="btn" id="saveProductEdit">저장</button></div>
  `, true)
  document.getElementById('editProductStatus').addEventListener('change', (e) => {
    const stock = Number(document.getElementById('editProductStock').value || 0)
    if (stock === 0 && e.target.value === 'ON_SALE') {
      alert('재고가 0인 상태에서는 판매중으로 변경할 수 없습니다.\n재고를 먼저 입력해주세요.')
      e.target.value = 'SOLD_OUT'
    }
  })
  document.getElementById('saveProductEdit').addEventListener('click', async () => {
    const nextProduct = {
      name: document.getElementById('editProductName').value.trim(),
      category: document.getElementById('editProductCategory').value.trim(),
      price: Number(document.getElementById('editProductPrice').value || 0),
      stock: Number(document.getElementById('editProductStock').value || 0),
      status: document.getElementById('editProductStatus').value,
    }
    // 재고가 0이면 자동으로 품절, 재고가 있으면 품절 상태 자동 해제
    if (nextProduct.stock === 0) {
      nextProduct.status = 'SOLD_OUT'
    } else if (nextProduct.stock > 0 && nextProduct.status === 'SOLD_OUT') {
      nextProduct.status = 'ON_SALE'
    }
    if (!nextProduct.name) {
      showFormError('상품명을 입력해주세요.')
      return
    }
    if (!nextProduct.category) {
      showFormError('카테고리를 입력해주세요.')
      return
    }
    if (nextProduct.price <= 0) {
      showFormError('가격은 1원 이상이어야 합니다.')
      return
    }
    if (nextProduct.stock < 0) {
      showFormError('재고는 0개 이상이어야 합니다.')
      return
    }

    const infoResponse = await apiRequest(`/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: nextProduct.name,
        category: nextProduct.category,
        price: nextProduct.price,
      }),
    })
    const stockResponse = await apiRequest(`/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: nextProduct.stock }),
    })
    const statusResponse = await apiRequest(`/products/${productId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextProduct.status }),
    })
    const failed = [infoResponse, stockResponse, statusResponse].find(isBackendError)
    if (failed) {
      showFormError(failed.message || '상품 수정에 실패했습니다.')
      return
    }

    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openProductStockEdit(productId) {
  const product = db.products.find((item) => item.productId === productId)
  if (!product) return

  openDialog(`
    <h2>상품 재고 수정</h2>
    <p class="muted">${product.name}</p>
    <div class="field"><label>재고</label><input id="editProductStock" type="number" value="${product.stock}" /></div>
    <div class="dialog-actions"><button class="btn ghost" data-close>취소</button><button class="btn" id="saveProductStock">저장</button></div>
  `)
  document.getElementById('saveProductStock').addEventListener('click', async () => {
    const stock = Number(document.getElementById('editProductStock').value || 0)
    await apiRequest(`/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock }),
    })
    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openOrderEdit(orderId) {
  const order = db.orders.find((item) => item.id === orderId)
  if (!order) return

  openDialog(`
    <h2>주문 상세 및 상태 수정</h2>
    <div class="detail-grid">
      ${detailItem('주문번호', order.orderNumber)}
      ${detailItem('고객', `${order.customerName} / ${order.customerEmail || '-'}`)}
      ${detailItem('상품', `${order.productName} x ${order.quantity}`)}
      ${detailItem('총금액', formatPrice(order.totalPrice))}
      ${detailItem('수령인', order.receiverName)}
      ${detailItem('연락처', order.receiverPhone)}
      ${detailItem('배송지', order.deliveryAddress)}
      ${detailItem('주문일', formatDate(order.createdAt))}
    </div>
    <div class="field">
      <label>상태</label>
      <select id="editOrderStatus">
        ${Object.entries(labels.orderStatus).map(([value, label]) => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div id="formMessage"></div>
    <div class="dialog-actions">
      ${order.status !== 'CANCELED' ? '<button class="btn danger" id="cancelOrderInDetail">주문 취소</button>' : ''}
      <button class="btn ghost" data-close>닫기</button>
      <button class="btn" id="saveOrderEdit">상태 저장</button>
    </div>
  `, true)
  document.getElementById('cancelOrderInDetail')?.addEventListener('click', () => cancelOrder(orderId))
  document.getElementById('saveOrderEdit').addEventListener('click', async () => {
    const nextStatus = document.getElementById('editOrderStatus').value
    const response = await apiRequest(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(nextStatus), // 서버 명세에 맞춰 수정 필요
    })
    if (isBackendError(response)) {
      showFormError(response.message || '주문 상태 수정에 실패했습니다.')
      return
    }

    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openProductDialog() {
  openDialog(`
    <h2>상품 등록</h2>
    <div class="field"><label>상품명</label><input id="productName" /></div>
    <div class="field"><label>카테고리</label><select id="productCategory">${['전자기기', '의류', '식품', '도서', '생활용품'].map((value) => `<option>${value}</option>`).join('')}</select></div>
    <div class="field"><label>가격</label><input id="productPrice" type="number" /></div>
    <div class="field"><label>재고</label><input id="productStock" type="number" min="1" /></div>
    <div id="formMessage"></div>
    <div class="dialog-actions"><button class="btn ghost" data-close>취소</button><button class="btn" id="saveProduct">등록</button></div>
  `)
  document.getElementById('saveProduct').addEventListener('click', async () => {
    const name = document.getElementById('productName').value.trim()
    const category = document.getElementById('productCategory').value
    const price = Number(document.getElementById('productPrice').value || 0)
    const stock = Number(document.getElementById('productStock').value || 0)
    
    if (!name) {
      showFormError('상품명을 입력해주세요.')
      return
    }
    if (price <= 0) {
      showFormError('가격은 1원 이상이어야 합니다.')
      return
    }
    if (stock < 1) {
      showFormError('상품 등록 시 재고는 1개 이상이어야 합니다.')
      return
    }

    const status = stock > 0 ? 'ON_SALE' : 'SOLD_OUT'
    const response = await apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify({ name, category, price, stock, status }),
    })
    if (isBackendError(response)) {
      showFormError(response.message || '상품 등록에 실패했습니다.')
      return
    }

    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openOrderDialog() {
  openDialog(`
    <h2>주문 생성</h2>
    <div class="field"><label>고객</label><select id="orderCustomer">${db.customers.map((item) => `<option value="${item.customerId}">${item.name} (${item.email})</option>`).join('')}</select></div>
    <div class="field"><label>상품</label><select id="orderProduct">${db.products.map((item) => `<option value="${item.productId}">${item.name} (${formatPrice(item.price)})</option>`).join('')}</select></div>
    <div class="field"><label>수량</label><input id="orderQuantity" type="number" value="1" min="1" /></div>
    <div class="field"><label>수령인</label><input id="receiverName" placeholder="수령인" /></div>
    <div class="field"><label>연락처</label><input id="receiverPhone" placeholder="010-0000-0000" /></div>
    <div class="field"><label>배송 주소</label><textarea id="deliveryAddress"></textarea></div>
    <div id="formMessage"></div>
    <div class="dialog-actions"><button class="btn ghost" data-close>취소</button><button class="btn" id="saveOrder">생성</button></div>
  `)
  document.getElementById('saveOrder').addEventListener('click', async () => {
    const customerId = Number(document.getElementById('orderCustomer').value)
    const productId = Number(document.getElementById('orderProduct').value)
    const quantity = Number(document.getElementById('orderQuantity').value || 1)
    const receiverName = document.getElementById('receiverName').value.trim()
    const receiverPhone = document.getElementById('receiverPhone').value.trim()
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim()
    
    if (!customerId || !productId) {
      showFormError('고객과 상품을 선택해주세요.')
      return
    }
    if (quantity < 1) {
      showFormError('주문 수량은 1개 이상이어야 합니다.')
      return
    }
    if (!receiverName) {
      showFormError('수령인 이름을 입력해주세요.')
      return
    }
    if (!isValidExactPhone(receiverPhone)) {
      showFormError('연락처는 010-1234-5678 형식이어야 합니다.')
      return
    }
    if (!deliveryAddress) {
      showFormError('배송지를 입력해주세요.')
      return
    }

    const response = await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        productId,
        quantity,
        receiverName,
        receiverPhone,
        deliveryAddress,
      }),
    })
    if (isBackendError(response)) {
      showFormError(response.message || '주문 생성에 실패했습니다.')
      return
    }

    await syncFromBackend();
    closeDialog()
    render()
  })
}

function openDialog(content, wide = false) {
  const wrapper = document.createElement('div')
  wrapper.className = 'modal-backdrop'
  wrapper.id = 'modal'
  wrapper.innerHTML = `<section class="dialog ${wide ? 'wide' : ''}">${content}</section>`
  document.body.appendChild(wrapper)
  wrapper.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeDialog))
}

function closeDialog() {
  document.getElementById('modal')?.remove()
}

function render() {
  if (!state.admin) {
    if (state.authView === 'signup') renderSignup()
    else renderLogin()
    return
  }
  if (!state.synced && !state.syncing) {
    state.syncing = true
    syncFromBackend().finally(() => {
      state.synced = true
      state.syncing = false
      render()
    })
  }
  if (state.page === 'admins') renderAdmins()
  else if (state.page === 'customers') renderCustomers()
  else if (state.page === 'products') renderProducts()
  else if (state.page === 'orders') renderOrders()
  else renderDashboard()
}

render()
