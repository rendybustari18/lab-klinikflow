<template>
  <div>
    <div class="page-header">
      <div>
        <h2>Buku Pasien & Rekam Medis</h2>
        <p class="page-subtitle">Data identitas pasien untuk administrasi poliklinik</p>
      </div>
      <button v-if="canRegister" class="btn btn-primary" @click="showAddModal = true">+ Registrasi Pasien Baru</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input
          v-model="searchQuery"
          class="input search-input"
          type="text"
          placeholder="Cari berdasarkan MRN, nama pasien, atau nomor telepon..."
          @input="fetchPatients"
        />
      </div>

      <div v-if="loading" class="state">Memuat data pasien...</div>
      <div v-else-if="patients.length > 0" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>No. Rekam Medis (MRN)</th>
              <th>Nama Lengkap Pasien</th>
              <th>Gender</th>
              <th>Tgl Lahir</th>
              <th>Telepon</th>
              <th>Klinik Terdaftar</th>
              <th>Alamat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in patients" :key="p.id">
              <td class="mono nowrap" style="color: var(--primary-700); font-weight: 700;">{{ p.mrn }}</td>
              <td>{{ p.full_name }}</td>
              <td><span class="badge badge-secondary">{{ p.gender === 'L' ? 'Laki-laki' : 'Perempuan' }}</span></td>
              <td class="nowrap">{{ p.birth_date }}</td>
              <td class="nowrap">{{ p.phone }}</td>
              <td><span class="badge badge-secondary">{{ p.clinic_name }}</span></td>
              <td class="muted text-sm">{{ p.address }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="state">Tidak ada data pasien yang ditemukan.</div>
    </div>

    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal">
        <form @submit.prevent="submitPatient">
          <div class="modal-header">
            <h3 class="modal-title">Formulir Pendaftaran Pasien Baru</h3>
            <p class="modal-subtitle">Lengkapi data identitas pasien di bawah ini.</p>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="label" for="full_name">Nama Lengkap Pasien</label>
              <input id="full_name" v-model="form.full_name" class="input" type="text" required placeholder="Nama lengkap pasien" />
            </div>

            <div class="form-grid">
              <div class="field">
                <label class="label" for="birth_date">Tanggal Lahir</label>
                <input id="birth_date" v-model="form.birth_date" class="input" type="date" required />
              </div>
              <div class="field">
                <label class="label" for="gender">Jenis Kelamin</label>
                <select id="gender" v-model="form.gender" class="select">
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label class="label" for="phone">Nomor Telepon / WA</label>
              <input id="phone" v-model="form.phone" class="input" type="text" required placeholder="081xxxx" />
            </div>

            <div class="field">
              <label class="label" for="address">Alamat Domisili</label>
              <textarea id="address" v-model="form.address" class="textarea" rows="2"></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline btn-sm" @click="showAddModal = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="submitting">
              {{ submitting ? 'Menyimpan...' : 'Simpan Pasien' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch, getCurrentUser } from '../api';

const patients = ref<any[]>([]);
const canRegister = ['admin', 'manager', 'staff'].includes(getCurrentUser()?.role);
const searchQuery = ref('');
const loading = ref(true);
const showAddModal = ref(false);
const submitting = ref(false);

const form = ref({
  full_name: '',
  birth_date: '1990-01-01',
  gender: 'L',
  phone: '',
  address: '',
});

async function fetchPatients() {
  loading.value = true;
  try {
    const q = searchQuery.value ? `?search=${encodeURIComponent(searchQuery.value)}` : '';
    const res = await apiFetch(`/patients${q}`);
    if (res.success && res.data) {
      patients.value = res.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function submitPatient() {
  submitting.value = true;
  try {
    const res = await apiFetch('/patients', {
      method: 'POST',
      body: JSON.stringify(form.value),
    });

    if (res.success) {
      alert(`Pasien berhasil didaftarkan: ${res.mrn}`);
      showAddModal.value = false;
      form.value = { full_name: '', birth_date: '1990-01-01', gender: 'L', phone: '', address: '' };
      await fetchPatients();
    } else {
      alert(`Gagal: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchPatients();
});
</script>
