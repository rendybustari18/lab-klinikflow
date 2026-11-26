<template>
  <div class="auth-wrap">
    <div class="card auth-card">
      <div class="auth-head">
        <span class="brand-mark">KF</span>
        <h2>Masuk ke KlinikFlow</h2>
        <p class="page-subtitle">Sistem Administrasi Klinik, Tagihan & Klaim</p>
      </div>

      <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

      <form @submit.prevent="submitLogin">
        <div class="field">
          <label class="label" for="email">Email Akun</label>
          <input id="email" v-model="email" class="input" type="email" required placeholder="nama@klinikflow.local" />
        </div>

        <div class="field">
          <label class="label" for="password">Kata Sandi</label>
          <input id="password" v-model="password" class="input" type="password" required placeholder="Kata sandi akun" />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? 'Memproses...' : 'Masuk Sekarang' }}
        </button>
      </form>

      <template v-if="labMode">
        <div class="auth-divider"><span>Pilih Akun Demo</span></div>

        <div class="account-list">
          <button
            v-for="account in labAccounts"
            :key="account.email"
            class="btn btn-outline btn-sm btn-block"
            @click="fillAccount(account.email)"
          >
            {{ account.label }}
          </button>
        </div>

        <p class="field-hint" style="text-align: center; margin-top: 14px;">
          Password seragam semua akun lab: <code class="inline-code">{{ labPassword }}</code>
        </p>
      </template>
      <p class="field-hint" style="text-align: center"><router-link to="/activate">Aktivasi undangan staf</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch, setCurrentUser } from '../api';

const router = useRouter();

// T02: akun demo dan sandi bawaan hanya untuk build lab (VITE_LAB_MODE=true).
// Perbandingan ditulis langsung pada setiap ekspresi agar Vite/esbuild dapat
// menghapus data demo dari bundle ketika mode lab tidak aktif.
const labMode = import.meta.env.VITE_LAB_MODE === 'true';
const labPassword = import.meta.env.VITE_LAB_MODE === 'true' ? 'password123' : '';
const labAccounts = import.meta.env.VITE_LAB_MODE === 'true'
  ? [
      { email: 'admin@klinikflow.local', label: 'Admin dr. Farhan — Klinik Mentari' },
      { email: 'manager@klinikflow.local', label: 'Koordinator Siti Rahayu — Klinik Mentari' },
      { email: 'staf1@klinikflow.local', label: 'Staf Pendaftaran Doni — Klinik Mentari' },
      { email: 'kasir1@klinikflow.local', label: 'Kasir Maya — Klinik Mentari' },
      { email: 'staf2@klinikflow.local', label: 'Staf Lia — Klinik Sehat Sentosa' },
    ]
  : [];

const email = ref(import.meta.env.VITE_LAB_MODE === 'true' ? 'staf1@klinikflow.local' : '');
const password = ref(labPassword);
const errorMsg = ref('');
const loading = ref(false);

function fillAccount(accEmail: string) {
  email.value = accEmail;
  password.value = labPassword;
}

async function submitLogin() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value, password: password.value }),
    });

    if (res.success && res.user) {
      setCurrentUser(res.user);
      window.dispatchEvent(new Event('user-updated'));
      router.push('/');
    } else {
      errorMsg.value = res.error || 'Login gagal, periksa email dan password.';
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Terjadi kesalahan jaringan';
  } finally {
    loading.value = false;
  }
}
</script>
