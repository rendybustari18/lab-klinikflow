<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Pencatatan & Jadwal Kunjungan</h2>
        <p class="page-subtitle">Manajemen registrasi, pemeriksaan dokter, dan status kunjungan</p>
      </div>
      <button class="btn btn-primary" @click="showAddModal = true">+ Catat Kunjungan Baru</button>
    </div>

    <div class="card">
      <div v-if="loading" class="state">Memuat riwayat kunjungan...</div>
      <div v-else-if="visits.length > 0" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>UUID Kunjungan</th>
              <th>Pasien</th>
              <th>MRN</th>
              <th>Dokter</th>
              <th>Klinik</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Catatan Klinis</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in visits" :key="v.id">
              <td class="mono text-xs nowrap" style="color: var(--primary-700); font-weight: 700;">{{ v.visit_uuid }}</td>
              <td><strong>{{ v.patient_name }}</strong></td>
              <td class="mono text-xs muted">{{ v.mrn }}</td>
              <td>{{ v.doctor_name }}</td>
              <td><span class="badge badge-secondary">{{ v.clinic_name }}</span></td>
              <td class="nowrap">{{ v.visit_date }}</td>
              <td><span class="badge" :class="statusBadge(v.status)">{{ v.status }}</span></td>
              <td class="muted text-sm">{{ v.notes || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="state">Belum ada data kunjungan.</div>
    </div>

    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal modal-sm">
        <form @submit.prevent="submitVisit">
          <div class="modal-header">
            <h3 class="modal-title">Pendaftaran Kunjungan Pasien</h3>
            <p class="modal-subtitle">Catat kunjungan baru ke poliklinik.</p>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="label" for="patient_id">Pilih Pasien Terdaftar</label>
              <select id="patient_id" v-model.number="form.patient_id" class="select" required>
                <option value="" disabled>-- Pilih Pasien --</option>
                <option v-for="p in patientList" :key="p.id" :value="p.id">
                  {{ p.full_name }} ({{ p.mrn }}) — {{ p.clinic_name }}
                </option>
              </select>
            </div>

            <div class="field">
              <label class="label" for="doctor_name">Dokter Pemeriksa</label>
              <input id="doctor_name" v-model="form.doctor_name" class="input" type="text" required />
            </div>

            <div class="field">
              <label class="label" for="visit_date">Tanggal Kunjungan</label>
              <input id="visit_date" v-model="form.visit_date" class="input" type="date" required />
            </div>

            <div class="field">
              <label class="label" for="notes">Keluhan / Catatan Awal</label>
              <textarea id="notes" v-model="form.notes" class="textarea" rows="2"></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline btn-sm" @click="showAddModal = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm">Simpan Kunjungan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api';

const visits = ref<any[]>([]);
const patientList = ref<any[]>([]);
const loading = ref(true);
const showAddModal = ref(false);

const form = ref({
  patient_id: 1,
  doctor_name: 'dr. Aris Wibowo',
  visit_date: new Date().toISOString().split('T')[0],
  notes: '',
});

async function fetchVisits() {
  loading.value = true;
  try {
    const res = await apiFetch('/visits');
    if (res.success && res.data) {
      visits.value = res.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadPatients() {
  try {
    const res = await apiFetch('/patients');
    if (res.success && res.data) {
      patientList.value = res.data;
    }
  } catch (err) {
    console.error(err);
  }
}

async function submitVisit() {
  try {
    const res = await apiFetch('/visits', {
      method: 'POST',
      body: JSON.stringify(form.value),
    });

    if (res.success) {
      alert(`Kunjungan berhasil dicatat dengan UUID: ${res.visit_uuid}`);
      showAddModal.value = false;
      await fetchVisits();
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'settled': return 'badge-success';
    case 'billed': return 'badge-warning';
    case 'examined': return 'badge-primary';
    case 'cancelled': return 'badge-danger';
    default: return 'badge-secondary';
  }
}

onMounted(() => {
  fetchVisits();
  loadPatients();
});
</script>
