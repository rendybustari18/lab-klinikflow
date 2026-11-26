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

      <div class="auth-divider"><span>Pilih Akun Demo</span></div>

      <div class="account-list">
        <button class="btn btn-outline btn-sm btn-block" @click="fillAccount('admin@klinikflow.local')">
          Admin dr. Farhan — Klinik Mentari
        </button>
        <button class="btn btn-outline btn-sm btn-block" @click="fillAccount('manager@klinikflow.local')">
          Koordinator Siti Rahayu — Klinik Mentari
        </button>
        <button class="btn btn-outline btn-sm btn-block" @click="fillAccount('staf1@klinikflow.local')">
          Staf Pendaftaran Doni — Klinik Mentari
        </button>
        <button class="btn btn-outline btn-sm btn-block" @click="fillAccount('kasir1@klinikflow.local')">
          Kasir Maya — Klinik Mentari
        </button>
        <button class="btn btn-outline btn-sm btn-block" @click="fillAccount('staf2@klinikflow.local')">
          Staf Lia — Klinik Sehat Sentosa
        </button>
      </div>

      <p class="field-hint" style="text-align: center; margin-top: 14px;">
        Password seragam semua akun lab: <code class="inline-code">password123</code>
      </p>
      <p class="field-hint" style="text-align: center"><router-link to="/activate">Aktivasi undangan staf</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch, setCurrentUser } from '../api';

const router = useRouter();
const email = ref('staf1@klinikflow.local');
const password = ref('password123');
const errorMsg = ref('');
const loading = ref(false);

function fillAccount(accEmail: string) {
  email.value = accEmail;
  password.value = 'password123';
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
