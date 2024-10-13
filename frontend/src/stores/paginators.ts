import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePaginatorsStore = defineStore('paginators', () => {
  const getLastPage = (total: number) =>
    Math.ceil(total / rowsPerPage.value) - 1;

  const rowsPerPage = ref<number>(
    Number(localStorage.getItem('rowsPerPage')) || 10
  );

  const rowsPerPageOptions = [10, 25, 50, 100];

  const setRowsPerPage = (value: number) => {
    localStorage.setItem('rowsPerPage', `${value}`);
    rowsPerPage.value = value;
  };

  return { getLastPage, rowsPerPage, rowsPerPageOptions, setRowsPerPage };
});
