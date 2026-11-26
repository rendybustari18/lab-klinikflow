<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Manajemen Staf & Registrasi Undangan</h2>
        <p class="page-subtitle">Kelola data staf klinik dan aktivasi akun melalui token undangan</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Staf Terdaftar</h3>
        </div>

        <div v-if="staffList.length > 0">
          <div
            v-for="s in staffList"
            :key="s.id"
            style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--border);"
          >
            <div>
              <div style="font-weight: 600;">{{ s.name }}</div>
              <div class="muted text-xs">{{ s.email }} — {{ s.clinic_name }}</div>
            </div>
            <span class="badge" :class="roleBadge(s.role)">{{ s.role }}</span>
          </div>
        </div>
        <div v-else class="state" style="padding: 24px 0;">
          Gunakan akun admin atau manajer untuk melihat daftar lengkap staf.
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Buat Undangan Staf</h3>
        </div>
        <p class="page-subtitle" style="margin-bottom: 16px;">
          Token berlaku selama 24 jam dan hanya ditampilkan sekali.
        </p>

        <form @submit.prevent="submitInvitation">
          <div class="field">
            <label class="label" for="invite_email">Email Calon Staf</label>
            <input id="invite_email" v-model="inviteForm.email" class="input" type="email" required />
          </div>

          <div class="field">
            <label class="label" for="invite_role">Role Hak Akses</label>
            <select id="invite_role" v-model="inviteForm.role" class="select">
              <option value="staff">staff (Staf Pendaftaran)</option>
              <option value="cashier">cashier (Kasir Poliklinik)</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary btn-sm" :disabled="claiming">
              {{ claiming ? 'Membuat...' : 'Buat Undangan' }}
            </button>
          </div>
        </form>
        <div v-if="createdToken" class="result-panel">
          <div class="result-panel-title">Token Undangan</div>
          <code style="overflow-wrap: anywhere">{{ createdToken }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api';

const staffList = ref<any[]>([]);
const claiming = ref(false);
const createdToken = ref('');

const inviteForm = ref({
  email: '',
  role: 'staff',
});

async function fetchStaff() {
  try {
    const res = await apiFetch('/staff');
    if (res.success && res.data) {
      staffList.value = res.data;
    }
  } catch (err) {
    console.error(err);
  }
}

async function submitInvitation() {
  claiming.value = true;
  createdToken.value = '';
  try {
    const res = await apiFetch('/staff/invitations', {
      method: 'POST',
      body: JSON.stringify(inviteForm.value),
    });

    if (res.success) {
      createdToken.value = res.token;
      inviteForm.value.email = '';
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  } finally {
    claiming.value = false;
  }
}

function roleBadge(role: string) {
  switch (role) {
    case 'admin': return 'badge-danger';
    case 'manager': return 'badge-warning';
    case 'staff': return 'badge-primary';
    case 'cashier': return 'badge-success';
    default: return 'badge-secondary';
  }
}

onMounted(() => {
  fetchStaff();
});
</script>
