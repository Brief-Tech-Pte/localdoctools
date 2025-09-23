import type { RouteRecordRaw } from 'vue-router'
import { toolRoutes } from 'src/tools'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      {
        path: 'terms-of-use',
        name: 'terms-of-use',
        component: () => import('pages/TermsOfUsePage.vue'),
      },
      {
        path: 'privacy-notice',
        name: 'privacy-notice',
        component: () => import('pages/PrivacyNoticePage.vue'),
      },
      ...toolRoutes,
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
