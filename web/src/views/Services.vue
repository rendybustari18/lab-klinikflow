<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Katalog Tindakan & Tarif Layanan</h2>
        <p class="page-subtitle">Daftar harga resmi pelayanan poliklinik dan laboratorium</p>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="state">Memuat katalog tarif...</div>
      <div v-else-if="services.length > 0" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Tindakan / Layanan</th>
              <th>Kategori</th>
              <th>Klinik Unit</th>
              <th>Tarif Biaya</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in services" :key="s.id">
              <td class="mono muted">{{ s.code }}</td>
              <td><strong>{{ s.name }}</strong></td>
              <td><span class="badge badge-secondary">{{ s.category }}</span></td>
              <td><span class="badge badge-secondary">{{ s.clinic_name }}</span></td>
              <td style="font-weight: 700; color: var(--primary-700);">
                Rp {{ Number(s.fee).toLocaleString('id-ID') }}
              </td>
              <td>
                <button class="btn btn-outline btn-sm" @click="openAdjustFeeModal(s)">Ubah Tarif</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="state">Belum ada data layanan.</div>
    </div>

    <div v-if="showAdjustModal" class="modal-overlay">
      <div class="modal modal-sm">
        <form @submit.prevent="submitFeeChange">
          <div class="modal-header">
            <h3 class="modal-title">Modifikasi Tarif Layanan Medis</h3>
            <p class="modal-subtitle">
              Layanan: <strong>{{ activeService?.name }}</strong>
            </p>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="label" for="service_id">ID Layanan Target</label>
              <input id="service_id" v-model.number="adjustForm.id" class="input" type="number" required />
            </div>

            <div class="field">
              <label class="label" for="service_fee">Nominal Tarif Baru (Rp)</label>
              <input id="service_fee" v-model.number="adjustForm.fee" class="input" type="number" step="1000" min="1000" required />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline btn-sm" @click="showAdjustModal = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="savingFee">
              {{ savingFee ? 'Menyimpan...' : 'Perbarui Tarif Layanan' }}
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

const services = ref<any[]>([]);
const loading = ref(true);
const showAdjustModal = ref(false);
const activeService = ref<any>(null);
const adjustForm = ref({ id: 0, fee: 0 });
const savingFee = ref(false);

async function fetchServices() {
  loading.value = true;
  try {
    const res = await apiFetch('/services');
    if (res.success && res.data) {
      services.value = res.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function openAdjustFeeModal(s: any) {
  activeService.value = s;
  adjustForm.value = { id: s.id, fee: parseFloat(s.fee) };
  showAdjustModal.value = true;
}

async function submitFeeChange() {
  savingFee.value = true;
  try {
    const res = await apiFetch('/services/update-fee', {
      method: 'POST',
      body: JSON.stringify(adjustForm.value),
    });

    if (res.success) {
      alert(res.message);
      showAdjustModal.value = false;
      await fetchServices();
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  } finally {
    savingFee.value = false;
  }
}

onMounted(() => {
  fetchServices();
});
</script>
