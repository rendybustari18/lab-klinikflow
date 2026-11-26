import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { getCurrentUser } from './api';

import Login from './views/Login.vue';
import Dashboard from './views/Dashboard.vue';
import Patients from './views/Patients.vue';
import Visits from './views/Visits.vue';
import Services from './views/Services.vue';
import Invoices from './views/Invoices.vue';
import Claims from './views/Claims.vue';
import Reports from './views/Reports.vue';
import Staff from './views/Staff.vue';
import ActivateInvitation from './views/ActivateInvitation.vue';

const routes: RouteRecordRaw[] = [
  { path: '/login', component: Login, meta: { guest: true } },
  { path: '/activate', component: ActivateInvitation, meta: { guest: true } },
  { path: '/', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/patients', component: Patients, meta: { requiresAuth: true } },
  { path: '/visits', component: Visits, meta: { requiresAuth: true } },
  { path: '/services', component: Services, meta: { requiresAuth: true } },
  { path: '/invoices', component: Invoices, meta: { requiresAuth: true } },
  { path: '/claims', component: Claims, meta: { requiresAuth: true } },
  { path: '/reports', component: Reports, meta: { requiresAuth: true } },
  { path: '/staff', component: Staff, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const user = getCurrentUser();
  if (to.meta.requiresAuth && !user) {
    return next('/login');
  }
  if (to.meta.guest && user) {
    return next('/');
  }
  next();
});

export default router;

