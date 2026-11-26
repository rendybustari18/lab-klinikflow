<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Tagihan Medis & Kasir Pembayaran</h2>
        <p class="page-subtitle">Simulasi pencatatan pembayaran tagihan poliklinik</p>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="state">Memuat data tagihan...</div>
      <div v-else-if="invoices.length > 0" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>No. Tagihan</th>
              <th>Pasien</th>
              <th>Dokter</th>
              <th>Klinik</th>
              <th>Total Tagihan</th>
              <th>Status</th>
              <th>Tgl Terbit</th>
              <th>Aksi Kasir</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in invoices" :key="inv.id">
              <td><strong>{{ inv.invoice_number }}</strong></td>
              <td>{{ inv.patient_name }}</td>
              <td>{{ inv.doctor_name }}</td>
              <td><span class="badge badge-secondary">{{ inv.clinic_name }}</span></td>
              <td style="font-weight: 700;">Rp {{ Number(inv.amount).toLocaleString('id-ID') }}</td>
              <td><span class="badge" :class="statusBadge(inv.status)">{{ inv.status }}</span></td>
              <td class="muted text-sm nowrap">{{ inv.issued_at }}</td>
              <td>
                <button class="btn btn-outline btn-sm" :disabled="!['unpaid', 'partially_paid'].includes(inv.status) || Number(inv.outstanding_amount) <= 0" @click="openPaymentModal(inv)">Proses Bayar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="state">Belum ada data tagihan.</div>
      <Pager :pagination="pagination" @change="goToPage" />
    </div>

    <div v-if="showPaymentModal" class="modal-overlay">
      <div class="modal modal-sm">
        <form @submit.prevent="submitPayment">
          <div class="modal-header">
            <h3 class="modal-title">Simulasi Pembayaran Tagihan</h3>
            <p class="modal-subtitle">
              Faktur <strong>{{ activeInvoice?.invoice_number }}</strong> — {{ activeInvoice?.patient_name }}
            </p>
          </div>

          <div class="modal-body">
            <div class="result-panel" style="margin-top: 0; margin-bottom: 16px;">
              <div class="result-row">
                <span>Total Tagihan</span>
                <b>Rp {{ Number(activeInvoice?.amount).toLocaleString('id-ID') }}</b>
              </div>
              <div class="result-row">
                <span>Status Saat Ini</span>
                <span class="badge" :class="statusBadge(activeInvoice?.status)">{{ activeInvoice?.status }}</span>
              </div>
              <div class="result-row">
                <span>Sisa Tagihan</span>
                <b>Rp {{ Number(activeInvoice?.outstanding_amount).toLocaleString('id-ID') }}</b>
              </div>
            </div>

            <div class="field">
              <label class="label" for="pay_method">Metode Pembayaran</label>
              <select id="pay_method" v-model="payMethod" class="select">
                <option value="qris">QRIS Statis / Dinamis</option>
                <option value="cash">Tunai (Cash)</option>
                <option value="bank_transfer">Transfer Bank Virtual Account</option>
              </select>
            </div>

            <div class="field">
              <label class="label" for="pay_amount">Nominal yang Disetorkan (Rp)</label>
              <input id="pay_amount" v-model.number="payAmount" class="input" type="number" required />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline btn-sm" @click="showPaymentModal = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="submittingPay">
              {{ submittingPay ? 'Memproses...' : 'Konfirmasi Pembayaran Kasir' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api';
import Pager from '../components/Pager.vue';
import type { PaginationMeta } from '../pagination';

const invoices = ref<any[]>([]);
const loading = ref(true);
const showPaymentModal = ref(false);
const activeInvoice = ref<any>(null);
const payAmount = ref(0);
const payMethod = ref('qris');
const submittingPay = ref(false);
const paymentRequestId = ref('');
const page = ref(1);
const pagination = ref<PaginationMeta | null>(null);

async function fetchInvoices(targetPage = page.value) {
  loading.value = true;
  try {
    const res = await apiFetch(`/invoices?page=${targetPage}`);
    if (res.success && res.data) {
      invoices.value = res.data;
      pagination.value = res.pagination ?? null;
      page.value = targetPage;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function openPaymentModal(inv: any) {
  activeInvoice.value = inv;
  payAmount.value = parseFloat(inv.outstanding_amount);
  paymentRequestId.value = crypto.randomUUID();
  showPaymentModal.value = true;
}

async function submitPayment() {
  submittingPay.value = true;
  try {
    const res = await apiFetch('/payments/process', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id: activeInvoice.value.id,
        amount: payAmount.value,
        method: payMethod.value,
        request_id: paymentRequestId.value,
      }),
    });

    if (res.success) {
      alert(`[SUKSES BAYAR] ${res.message}\nRef: ${res.payment_ref}`);
      showPaymentModal.value = false;
      await fetchInvoices();
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  } finally {
    submittingPay.value = false;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid': return 'badge-success';
    case 'unpaid': return 'badge-warning';
    case 'partially_paid': return 'badge-primary';
    case 'cancelled': return 'badge-danger';
    default: return 'badge-secondary';
  }
}

function goToPage(target: number) {
  fetchInvoices(target);
}

onMounted(() => {
  fetchInvoices();
});
</script>
