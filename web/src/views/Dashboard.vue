<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Dashboard Administrasi Klinik</h2>
        <p class="page-subtitle">
          Selamat bertugas, <strong>{{ user?.name }}</strong> — {{ user?.clinic_name }}
        </p>
      </div>
      <router-link v-if="['admin', 'manager', 'staff'].includes(user?.role)" to="/patients" class="btn btn-primary">+ Registrasi Pasien</router-link>
    </div>

    <div v-if="user?.role === 'patient'" class="state">Data pasien belum terhubung ke akun ini.</div>
    <div v-else class="stack">
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-accent accent-blue"></span>
          <span class="stat-label">Total Pasien</span>
          <div class="stat-value">{{ stats.total_patients }}</div>
          <span class="stat-foot">Rekam medis aktif</span>
        </div>
        <div class="stat-card">
          <span class="stat-accent accent-green"></span>
          <span class="stat-label">Total Kunjungan</span>
          <div class="stat-value">{{ stats.total_visits }}</div>
          <span class="stat-foot">Kunjungan poliklinik</span>
        </div>
        <div class="stat-card">
          <span class="stat-accent accent-amber"></span>
          <span class="stat-label">Tagihan Belum Lunas</span>
          <div class="stat-value">{{ stats.unpaid_invoices }}</div>
          <span class="stat-foot">Menunggu pembayaran kasir</span>
        </div>
        <div class="stat-card">
          <span class="stat-accent accent-violet"></span>
          <span class="stat-label">Klaim Diajukan</span>
          <div class="stat-value">{{ stats.pending_claims }}</div>
          <span class="stat-foot">Dalam proses reimbursement</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Kunjungan Pasien Terbaru</h3>
          <router-link v-if="user?.role !== 'cashier'" to="/visits" class="text-sm">Lihat semua &rarr;</router-link>
        </div>

        <div v-if="loading" class="state">Memuat data...</div>
        <div v-else-if="stats.recent_visits && stats.recent_visits.length > 0" class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>UUID Kunjungan</th>
                <th>Nama Pasien</th>
                <th>Dokter Pemeriksa</th>
                <th>Klinik</th>
                <th>Tanggal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in stats.recent_visits" :key="v.id">
                <td class="mono text-xs muted">{{ v.visit_uuid }}</td>
                <td><strong>{{ v.patient_name }}</strong></td>
                <td>{{ v.doctor_name }}</td>
                <td><span class="badge badge-secondary">{{ v.clinic_name }}</span></td>
                <td class="nowrap">{{ v.visit_date }}</td>
                <td><span class="badge" :class="statusBadge(v.status)">{{ v.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="state">Belum ada riwayat kunjungan terbaru.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch, getCurrentUser } from '../api';

const user = ref(getCurrentUser());
const stats = ref<any>({ total_patients: 0, total_visits: 0, unpaid_invoices: 0, pending_claims: 0, recent_visits: [] });
const loading = ref(true);

onMounted(async () => {
  if (user.value?.role === 'patient') { loading.value = false; return; }
  try {
    const res = await apiFetch('/dashboard/stats');
    if (res.success && res.data) {
      stats.value = res.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
});

function statusBadge(status: string) {
  switch (status) {
    case 'settled': return 'badge-success';
    case 'billed': return 'badge-warning';
    case 'examined': return 'badge-primary';
    case 'cancelled': return 'badge-danger';
    default: return 'badge-secondary';
  }
}
</script>
