<template>
  <div class="auth-wrap">
    <div class="card auth-card">
      <div class="auth-head">
        <span class="brand-mark">KF</span>
        <h2>Aktivasi Undangan Staf</h2>
      </div>
      <div v-if="message" class="alert" :class="success ? 'alert-success' : 'alert-danger'">{{ message }}</div>
      <form v-if="!success" @submit.prevent="activate">
        <div class="field"><label class="label" for="token">Token Undangan</label><input id="token" v-model="form.token" class="input" required /></div>
        <div class="field"><label class="label" for="name">Nama Lengkap</label><input id="name" v-model="form.name" class="input" maxlength="150" required /></div>
        <div class="field"><label class="label" for="phone">Telepon</label><input id="phone" v-model="form.phone" class="input" maxlength="30" /></div>
        <div class="field"><label class="label" for="password">Kata Sandi Baru</label><input id="password" v-model="form.password" class="input" type="password" minlength="12" required /></div>
        <button class="btn btn-primary btn-block" :disabled="loading">{{ loading ? 'Memproses...' : 'Aktifkan Akun' }}</button>
      </form>
      <p class="field-hint" style="text-align: center; margin-top: 14px"><router-link to="/login">Kembali ke login</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { apiFetch } from '../api';

const form = ref({ token: '', name: '', phone: '', password: '' });
const message = ref('');
const success = ref(false);
const loading = ref(false);

async function activate() {
  loading.value = true;
  message.value = '';
  try {
    const result = await apiFetch('/staff/accept-invitation', { method: 'POST', body: JSON.stringify(form.value) });
    success.value = !!result.success;
    message.value = result.message || result.error || 'Aktivasi gagal';
    if (success.value) form.value.password = '';
  } catch {
    message.value = 'Aktivasi gagal. Silakan coba lagi.';
  } finally {
    loading.value = false;
  }
}
</script>