import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAnalyticsStore } from './analytics';

export const usePaginatorsStore = defineStore('paginators', () => {
  const analytics = useAnalyticsStore();

  const getLastPage = (total: number) => {
    const last = Math.ceil(total / rowsPerPage.value);
    return last == 0 ? 0 : last - 1;
  };

  const rowsPerPage = ref<number>(
    Number(localStorage.getItem('rowsPerPage')) || 10
  );

  const rowsPerPageOptions = [10, 25, 50, 100];

  const setRowsPerPage = (value: number) => {
    localStorage.setItem('rowsPerPage', `${value}`);
    rowsPerPage.value = value;
    analytics.recordEvent('set_rows_per_page_in_paginator', { value });
  };

  return { getLastPage, rowsPerPage, rowsPerPageOptions, setRowsPerPage };
});
