<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Laporan Harian & Ekspor Dokumen</h2>
        <p class="page-subtitle">Rekapitulasi transaksi poliklinik dan ekspor dokumen</p>
      </div>
      <button class="btn btn-outline" @click="showExportModal = true">Ekspor Dokumen</button>
    </div>

    <div class="stack">
      <div class="card">
        <div class="toolbar" style="margin-bottom: 0;">
          <input
            v-model="searchFilter"
            class="input search-input"
            type="text"
            placeholder="Ketik kata kunci pencarian transaksi..."
          />
          <button class="btn btn-primary btn-sm" @click="fetchReports(1)">Terapkan Filter</button>
        </div>
      </div>

      <div v-if="summary" class="summary-banner">{{ summary }}</div>

      <div class="card">
        <div v-if="loading" class="state">Memuat laporan transaksi...</div>
        <div v-else-if="reports.length > 0" class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>No. Tagihan</th>
                <th>Pasien</th>
                <th>MRN</th>
                <th>Dokter</th>
                <th>Klinik</th>
                <th>Tanggal Kunjungan</th>
                <th>Nominal Tagihan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reports" :key="r.id">
                <td><strong>{{ r.invoice_number }}</strong></td>
                <td>{{ r.patient_name }}</td>
                <td class="mono text-xs muted">{{ r.mrn }}</td>
                <td>{{ r.doctor_name }}</td>
                <td><span class="badge badge-secondary">{{ r.clinic_name }}</span></td>
                <td class="nowrap">{{ r.visit_date }}</td>
                <td>Rp {{ Number(r.amount).toLocaleString('id-ID') }}</td>
                <td><span class="badge" :class="r.status === 'paid' ? 'badge-success' : 'badge-warning'">{{ r.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="state">Belum ada data laporan.</div>
        <Pager :pagination="pagination" @change="goToPage" />
      </div>
    </div>

    <div v-if="showExportModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Ekspor Dokumen Laporan</h3>
          <p class="modal-subtitle">Pilih tipe laporan dan format berkas yang diinginkan.</p>
        </div>

        <div class="modal-body">
          <div class="field">
            <label class="label" for="export_type">Tipe Laporan</label>
            <select id="export_type" v-model="exportType" class="select">
              <option value="daily_financial">Laporan Keuangan Harian (daily_financial)</option>
              <option value="visit_summary">Ringkasan Kunjungan Pasien (visit_summary)</option>
              <option value="claim_reimbursement">Rekapitulasi Klaim Asuransi (claim_reimbursement)</option>
            </select>
          </div>

          <div class="field">
            <label class="label" for="export_format">Format Berkas</label>
            <input id="export_format" v-model="exportFormat" class="input" type="text" placeholder="csv / text" />
            <div class="field-hint">Contoh standar: <code class="inline-code">csv</code> atau <code class="inline-code">text</code>.</div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button class="btn btn-primary btn-sm" @click="runExport" :disabled="exporting">
              {{ exporting ? 'Memproses...' : 'Jalankan Ekspor' }}
            </button>
          </div>

          <pre v-if="exportOutput" class="output-pre">{{ exportOutput }}</pre>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline btn-sm" @click="showExportModal = false">Tutup</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { apiFetch } from '../api';
import Pager from '../components/Pager.vue';
import type { PaginationMeta } from '../pagination';

const route = useRoute();
const reports = ref<any[]>([]);
const searchFilter = ref((route.query.filter as string) || '');
const summary = ref('');
const loading = ref(true);
const page = ref(1);
const pagination = ref<PaginationMeta | null>(null);

const showExportModal = ref(false);
const exportType = ref('daily_financial');
const exportFormat = ref('csv');
const exporting = ref(false);
const exportOutput = ref('');

async function fetchReports(targetPage = page.value) {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: String(targetPage) });
    if (searchFilter.value) params.set('filter', searchFilter.value);
    const res = await apiFetch(`/reports?${params}`);
    if (res.success) {
      reports.value = res.data;
      pagination.value = res.pagination ?? null;
      page.value = targetPage;
      summary.value = typeof res.summary === 'string' ? res.summary : '';
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function runExport() {
  exporting.value = true;
  exportOutput.value = '';
  try {
    const res = await apiFetch('/reports/export', {
      method: 'POST',
      body: JSON.stringify({
        type: exportType.value,
        format: exportFormat.value,
        filter: searchFilter.value || 'all',
      }),
    });

    if (res.success) {
      exportOutput.value = res.output;
    } else {
      exportOutput.value = `Gagal: ${res.error}`;
    }
  } catch (err: any) {
    exportOutput.value = `Error: ${err.message}`;
  } finally {
    exporting.value = false;
  }
}

function goToPage(target: number) {
  fetchReports(target);
}

onMounted(() => {
  fetchReports();
});
</script>
