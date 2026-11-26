<template>
  <div v-if="pagination && pagination.total_pages > 1" class="pager">
    <button class="btn btn-outline btn-sm" :disabled="pagination.page <= 1" @click="emit('change', pagination.page - 1)">
      &larr; Sebelumnya
    </button>
    <span class="muted text-sm">
      Halaman {{ pagination.page }} dari {{ pagination.total_pages }} &middot; {{ pagination.total }} data
    </span>
    <button class="btn btn-outline btn-sm" :disabled="pagination.page >= pagination.total_pages" @click="emit('change', pagination.page + 1)">
      Berikutnya &rarr;
    </button>
  </div>
</template>

<script setup lang="ts">
// T22: navigasi halaman untuk respons daftar { data, pagination }.
import type { PaginationMeta } from '../pagination';

defineProps<{ pagination: PaginationMeta | null }>();
const emit = defineEmits<{ (e: 'change', page: number): void }>();
</script>
