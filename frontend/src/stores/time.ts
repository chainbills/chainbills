import { defineStore } from 'pinia';

export const useTimeStore = defineStore('time', () => {
  const display = (when: Date) => {
    const timeStr = when.toTimeString().split(':').slice(0, 2).join(':');

    const now = Math.round(Date.now() / 1000);
    const then = Math.round(Date.now() / 1000);
    if (now - 24 * 60 * 60 < then) return timeStr;

    const dateParts = when.toDateString().split(' ');
    const dateStr = [
      dateParts[2],
      dateParts[1],
      dateParts[3].split('').slice(2).join(''),
    ].join('/');
    return `${dateStr} ${timeStr}`;
  };

  return { display };
});
