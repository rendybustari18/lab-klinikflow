<template>
  <div>
    <div class="app-banner">
      Local Security Training Lab — Data Dummy & Lingkungan Isolasi
    </div>

    <div v-if="user" class="app-shell">
      <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
        <router-link to="/" class="sidebar-brand" @click="sidebarOpen = false">
          <span class="brand-mark">KF</span>
          <span class="brand-text">
            <span class="brand-name">KlinikFlow</span>
            <span class="brand-sub">{{ user.clinic_name }}</span>
          </span>
        </router-link>

        <div class="sidebar-label">Menu</div>
        <nav class="sidebar-nav">
          <router-link
            v-for="item in visibleMenus"
            :key="item.to"
            :to="item.to"
            class="sidebar-link"
            @click="sidebarOpen = false"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path :d="item.icon" />
            </svg>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <span class="user-avatar">{{ userInitial }}</span>
            <div class="sidebar-user-meta">
              <strong>{{ user.name }}</strong>
              <span>{{ roleLabel }}</span>
            </div>
            <span class="badge" :class="roleBadgeClass">{{ user.role }}</span>
          </div>
          <button class="btn btn-outline btn-sm" @click="logout">Keluar</button>
        </div>
      </aside>

      <div v-if="sidebarOpen" class="sidebar-backdrop show" @click="sidebarOpen = false"></div>

      <div class="app-main">
        <div class="mobile-topbar">
          <button class="icon-btn" aria-label="Buka menu" @click="sidebarOpen = true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span class="brand-mark" style="width: 30px; height: 30px; font-size: 12px;">KF</span>
          <span class="mobile-title">KlinikFlow</span>
          <span class="mobile-spacer"></span>
          <span class="badge" :class="roleBadgeClass">{{ roleLabel }}</span>
        </div>

        <div class="app-content">
          <router-view />
        </div>
      </div>
    </div>

    <main v-else class="container-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch, clearToken, getCurrentUser, setCurrentUser } from './api';

const router = useRouter();
const user = ref<any>(null);
const sidebarOpen = ref(false);

const menuItems = [
  {
    to: '/',
    label: 'Dashboard',
    roles: ['admin', 'manager', 'staff', 'cashier', 'patient'],
    icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
  },
  {
    to: '/patients',
    label: 'Pasien',
    roles: ['admin', 'manager', 'staff', 'cashier'],
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  },
  {
    to: '/visits',
    label: 'Kunjungan',
    roles: ['admin', 'manager', 'staff'],
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
  {
    to: '/services',
    label: 'Tarif Layanan',
    roles: ['admin', 'manager'],
    icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
  },
  {
    to: '/invoices',
    label: 'Tagihan & Kasir',
    roles: ['admin', 'manager', 'cashier'],
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    to: '/claims',
    label: 'Klaim Asuransi',
    roles: ['admin', 'manager', 'staff', 'cashier'],
    icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  },
  {
    to: '/reports',
    label: 'Laporan',
    roles: ['admin', 'manager'],
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  },
  {
    to: '/staff',
    label: 'Staf & Undangan',
    roles: ['admin', 'manager'],
    icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  },
];

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manajer',
  staff: 'Staf Pendaftaran',
  cashier: 'Kasir',
  patient: 'Pasien',
};

const visibleMenus = computed(() => {
  const role = user.value?.role;
  if (!role) return [];
  return menuItems.filter((item) => item.roles.includes(role));
});

const roleLabel = computed(() => {
  const role = user.value?.role;
  return role ? roleLabels[role] || role : '';
});

const userInitial = computed(() => {
  const name = user.value?.name || '?';
  return name.charAt(0);
});

function refreshUser() {
  user.value = getCurrentUser();
}

onMounted(async () => {
  localStorage.removeItem('klinikflow_token');
  try {
    const result = await apiFetch('/auth/me');
    if (result.success) setCurrentUser(result.user);
    else clearToken();
  } catch {
    clearToken();
  }
  refreshUser();
  if (!user.value && !router.currentRoute.value.meta.guest) router.push('/login');
  window.addEventListener('storage', refreshUser);
  window.addEventListener('user-updated', refreshUser);
});

const roleBadgeClass = computed(() => {
  if (!user.value) return 'badge-secondary';
  switch (user.value.role) {
    case 'admin': return 'badge-danger';
    case 'manager': return 'badge-warning';
    case 'staff': return 'badge-primary';
    case 'cashier': return 'badge-success';
    default: return 'badge-secondary';
  }
});

async function logout() {
  try {
    const result = await apiFetch('/auth/logout', { method: 'POST' });
    if (!result.success && result.status !== 401) throw new Error(result.error || 'Logout gagal');
    clearToken();
    user.value = null;
    sidebarOpen.value = false;
    router.push('/login');
  } catch {
    alert('Logout gagal. Silakan coba lagi.');
  }
}
</script>
