<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Pengajuan Klaim Asuransi</h2>
        <p class="page-subtitle">Administrasi reimbursement dan verifikasi berkas klaim poliklinik</p>
      </div>
    </div>

    <div class="stack">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Daftar Pengajuan Klaim Asuransi</h3>
        </div>

        <div v-if="claims.length > 0" class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>UUID Klaim</th>
                <th>No. Klaim</th>
                <th>Klinik</th>
                <th>Pasien</th>
                <th>Penjamin / Asuransi</th>
                <th>Nominal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in claims" :key="c.id">
                <td class="mono text-xs muted">{{ c.claim_uuid }}</td>
                <td><strong>{{ c.claim_number }}</strong></td>
                <td><span class="badge badge-secondary">{{ c.clinic_name }}</span></td>
                <td>{{ c.patient_name }}</td>
                <td>{{ c.insurance_name }}</td>
                <td>Rp {{ Number(c.amount).toLocaleString('id-ID') }}</td>
                <td><span class="badge" :class="claimBadge(c.status)">{{ c.status }}</span></td>
                <td>
                  <button v-if="canApprove" class="btn btn-outline btn-sm" :disabled="c.status !== 'submitted'" @click="approveClaim(c)">Setujui</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="state">Belum ada pengajuan klaim.</div>
        <Pager :pagination="pagination" @change="goToPage" />
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Pencarian Lampiran Berkas Klaim</h3>
        </div>
        <p class="page-subtitle" style="margin-bottom: 14px;">
          Masukkan UUID lampiran untuk membuka berkas klaim.
        </p>

        <div class="toolbar" style="margin-bottom: 0;">
          <input v-model="targetAttachmentUuid" class="input search-input" type="text" placeholder="UUID Lampiran" />
          <button class="btn btn-outline" @click="fetchAttachment">Buka Berkas</button>
        </div>

        <div v-if="attachmentData" class="result-panel">
          <div class="result-panel-title">Berkas Ditemukan</div>
          <div class="result-row">
            <span>Nama Berkas</span>
            <b>{{ attachmentData.file_name }} ({{ attachmentData.file_type }})</b>
          </div>
          <div class="result-row">
            <span>No. Klaim Terkait</span>
            <b>{{ attachmentData.claim_number }} — {{ attachmentData.insurance_name }}</b>
          </div>
          <div class="result-row">
            <span>Klinik Pemilik</span>
            <span class="badge badge-secondary">{{ attachmentData.clinic_name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch, getCurrentUser } from '../api';
import Pager from '../components/Pager.vue';
import type { PaginationMeta } from '../pagination';

const claims = ref<any[]>([]);
const targetAttachmentUuid = ref('att-e5d6-7c8b-0004');
const attachmentData = ref<any>(null);
const canApprove = ['admin', 'manager'].includes(getCurrentUser()?.role);
const page = ref(1);
const pagination = ref<PaginationMeta | null>(null);

async function fetchClaims(targetPage = page.value) {
  try {
    const res = await apiFetch(`/claims?page=${targetPage}`);
    if (res.success && res.data) {
      claims.value = res.data;
      pagination.value = res.pagination ?? null;
      page.value = targetPage;
    }
  } catch (err) {
    console.error(err);
  }
}

async function approveClaim(c: any) {
  if (!confirm(`Setujui klaim ${c.claim_number} sebesar Rp ${Number(c.amount).toLocaleString('id-ID')}?`)) return;
  try {
    const res = await apiFetch('/claims/approve', {
      method: 'POST',
      body: JSON.stringify({ claim_id: c.id }),
    });

    if (res.success) {
      alert(`[APPROVAL BERHASIL] ${res.message}\nStatus Sebelumnya: ${res.previous_status}`);
      await fetchClaims();
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  }
}

async function fetchAttachment() {
  if (!targetAttachmentUuid.value.trim()) return;
  try {
    const res = await apiFetch(`/attachments/${encodeURIComponent(targetAttachmentUuid.value.trim())}`);
    if (res.success && res.data) {
      attachmentData.value = res.data;
      alert(`[BERKAS DIBUKA] Berhasil membaca lampiran milik ${res.data.clinic_name}:\nNama File: ${res.data.file_name}\nKlaim: ${res.data.claim_number}`);
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  }
}

function claimBadge(status: string) {
  switch (status) {
    case 'approved': return 'badge-success';
    case 'submitted': return 'badge-warning';
    case 'rejected': return 'badge-danger';
    default: return 'badge-secondary';
  }
}

function goToPage(target: number) {
  fetchClaims(target);
}

onMounted(() => {
  fetchClaims();
});
</script>
